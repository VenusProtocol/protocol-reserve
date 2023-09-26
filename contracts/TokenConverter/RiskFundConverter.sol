// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

import { AbstractTokenConverter } from "./AbstractTokenConverter.sol";
import { ensureNonzeroAddress } from "../Utils/Validators.sol";
import { IPoolRegistry } from "../Interfaces/IPoolRegistry.sol";
import { IComptroller } from "../Interfaces/IComptroller.sol";
import { IRiskFund } from "../Interfaces/IRiskFund.sol";
import { IVToken } from "../Interfaces/IVToken.sol";
import { EXP_SCALE } from "../Utils/Constants.sol";

/// @title RiskFundConverter
/// @author Venus
/// @notice RiskFundConverter used for token conversions and sends received token to RiskFund
contract RiskFundConverter is AbstractTokenConverter {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Address of the core pool comptroller
    address public immutable corePoolComptroller;

    ///@notice Address of the vBNB
    ///@dev This address is used to exclude the BNB market while in getPools method
    address public immutable vBNB;

    ///@notice Address of the native wrapped currency
    address public immutable NATIVE_WRAPPED;

    /// @notice Store the previous state for the asset transferred to ProtocolShareReserve combined(for all pools)
    mapping(address => uint256) internal assetsReserves;

    /// @notice Store the asset's reserve per pool in the ProtocolShareReserve
    /// @dev Comptroller(pool) -> Asset -> amount
    mapping(address => mapping(address => uint256)) internal poolsAssetsReserves;

    /// @notice Address of pool registry contract
    address public poolRegistry;

    /// @notice This mapping would contain the assets for the pool which would be send to RiskFund directly
    /// @dev Comptroller(pool) -> Asset -> bool(should transfer directly on true)
    mapping(address => mapping(address => bool)) public poolsAssetsDirectTransfer;

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain
    uint256[46] private __gap;

    /// @notice Emitted when pool registry address is updated
    event PoolRegistryUpdated(address indexed oldPoolRegistry, address indexed newPoolRegistry);

    /// @notice Emitted after the updation of the assets reserves
    /// amount -> reserve increased by amount
    event AssetsReservesUpdated(address indexed comptroller, address indexed asset, uint256 amount);

    /// @notice Emmitted after the funds transferred to the destination address
    event AssetTransferredToDestination(address indexed comptroller, address indexed asset, uint256 amount);

    /// @notice Emitted after the poolsAssetsDirectTransfer mapping is updated
    event PoolAssetsDirectTransferUpdated(address indexed comptroller, address indexed asset, bool value);

    // Error thrown when comptrollers array length is not equal to assets array length
    error InvalidArguments();

    /// @param corePoolComptroller_ Address of the Comptroller pool
    /// @param vBNB_ Address of the vBNB
    /// @param nativeWrapped_ Address of the wrapped native currency
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address corePoolComptroller_, address vBNB_, address nativeWrapped_) {
        ensureNonzeroAddress(corePoolComptroller_);
        ensureNonzeroAddress(vBNB_);
        ensureNonzeroAddress(nativeWrapped_);

        corePoolComptroller = corePoolComptroller_;
        vBNB = vBNB_;
        NATIVE_WRAPPED = nativeWrapped_;
    }

    /// @param accessControlManager_ Access control manager contract address
    /// @param priceOracle_ Resilient oracle address
    /// @param destinationAddress_  Address at all incoming tokens will transferred to
    /// @param poolRegistry_ Address of the pool registry
    function initialize(
        address accessControlManager_,
        ResilientOracle priceOracle_,
        address destinationAddress_,
        address poolRegistry_
    ) public initializer {
        // Initialize AbstractTokenConverter
        __AbstractTokenConverter_init(accessControlManager_, priceOracle_, destinationAddress_);
        ensureNonzeroAddress(poolRegistry_);
        poolRegistry = poolRegistry_;
    }

    /// @dev Pool registry setter
    /// @param poolRegistry_ Address of the pool registry
    /// @custom:event PoolRegistryUpdated emits on success
    /// @custom:error ZeroAddressNotAllowed is thrown when pool registry address is zero
    function setPoolRegistry(address poolRegistry_) external onlyOwner {
        ensureNonzeroAddress(poolRegistry_);
        address oldPoolRegistry = poolRegistry;
        poolRegistry = poolRegistry_;
        emit PoolRegistryUpdated(oldPoolRegistry, poolRegistry_);
    }

    /// @notice Update the poolsAssetsDirectTransfer mapping
    /// @param comptrollers Addresses of the pools
    /// @param assets Addresses of the assets need to be added for direct transfer
    /// @custom:error InvalidArguments thrown when comptrollers array length is not equal to assets array length
    /// @custom:access Restricted by ACM
    function setPoolsAssetsDirectTransfer(
        address[] calldata comptrollers,
        address[][] calldata assets,
        bool[][] calldata values
    ) external {
        _checkAccessAllowed("setPoolsAssetsDirectTransfer(address[],address[][],bool[][])");

        uint256 comptrollersLength = comptrollers.length;

        if ((comptrollersLength != assets.length) || (comptrollersLength != values.length)) {
            revert InvalidArguments();
        }

        for (uint256 i; i < comptrollersLength; ++i) {
            address[] memory poolAssets = assets[i];
            bool[] memory assetsValues = values[i];

            if (poolAssets.length != assetsValues.length) {
                revert InvalidArguments();
            }

            for (uint256 j; j < poolAssets.length; ++j) {
                poolsAssetsDirectTransfer[comptrollers[i]][poolAssets[j]] = assetsValues[j];
                emit PoolAssetsDirectTransferUpdated(comptrollers[i], poolAssets[j], assetsValues[j]);
            }
        }
    }

    /// @dev Get the Amount of the asset in the risk fund for the specific pool
    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address
    /// @return Asset's reserve in risk fund
    function getPoolAssetReserve(address comptroller, address asset) external view returns (uint256) {
        require(IComptroller(comptroller).isComptroller(), "ReserveHelpers: Comptroller address invalid");
        ensureNonzeroAddress(asset);
        return poolsAssetsReserves[comptroller][asset];
    }

    /// @dev Update the reserve of the asset for the specific pool after transferring to risk fund
    /// and transferring funds to the protocol share reserve
    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address
    function updateAssetsState(address comptroller, address asset) public {
        require(IComptroller(comptroller).isComptroller(), "ReserveHelpers: Comptroller address invalid");
        ensureNonzeroAddress(asset);

        require(ensureAssetListed(comptroller, asset), "ReserveHelpers: The pool doesn't support the asset");

        IERC20Upgradeable token = IERC20Upgradeable(asset);
        uint256 currentBalance = token.balanceOf(address(this));
        uint256 assetReserve = assetsReserves[asset];
        if (currentBalance > assetReserve) {
            uint256 balanceDifference;
            unchecked {
                balanceDifference = currentBalance - assetReserve;
            }
            if (poolsAssetsDirectTransfer[comptroller][asset]) {
                token.safeTransfer(destinationAddress, balanceDifference);
                emit AssetTransferredToDestination(comptroller, asset, balanceDifference);
                IRiskFund(destinationAddress).updatePoolState(comptroller, asset, balanceDifference);
            } else {
                assetsReserves[asset] += balanceDifference;
                poolsAssetsReserves[comptroller][asset] += balanceDifference;
                emit AssetsReservesUpdated(comptroller, asset, balanceDifference);
            }
        }
    }

    /// @notice Get the balance for specific token
    /// @param tokenAddress Address of the token
    function balanceOf(address tokenAddress) public view override returns (uint256 tokenBalance) {
        return assetsReserves[tokenAddress];
    }

    /// @notice Hook to perform after converting tokens
    /// @dev After transformation poolsAssetsReserves are settled by pool's reserves fraction
    /// @param tokenInAddress Address of the tokenIn
    /// @param tokenOutAddress Address of the tokenOut
    /// @param amountIn Amount of tokenIn transferred
    /// @param amountOut Amount of tokenOut transferred
    function postConversionHook(
        address tokenInAddress,
        address tokenOutAddress,
        uint256 amountIn,
        uint256 amountOut
    ) internal override {
        address[] memory pools = getPools(tokenOutAddress);
        uint256 assetReserve = assetsReserves[tokenOutAddress];
        for (uint256 i; i < pools.length; ++i) {
            uint256 poolShare = (poolsAssetsReserves[pools[i]][tokenOutAddress] * EXP_SCALE) / assetReserve;
            if (poolShare == 0) continue;
            updatePoolAssetsReserve(pools[i], tokenOutAddress, amountOut, poolShare);
            uint256 poolAmountInShare = (poolShare * amountIn) / EXP_SCALE;
            IRiskFund(destinationAddress).updatePoolState(pools[i], tokenInAddress, poolAmountInShare);
        }

        assetsReserves[tokenOutAddress] -= amountOut;
    }

    /// @notice Operations to perform after sweepToken
    /// @param tokenAddress Address of the token
    /// @param amount Amount transferred to address(to)
    function postSweepToken(address tokenAddress, uint256 amount) internal override {
        uint256 balance = IERC20Upgradeable(tokenAddress).balanceOf(address(this));
        require(balance >= amount, "Insufficient Balance");
        uint256 balanceDiff = balance - assetsReserves[tokenAddress];

        if (balanceDiff < amount) {
            uint256 amountDiff = amount - balanceDiff;
            address[] memory pools = getPools(tokenAddress);
            uint256 assetReserve = assetsReserves[tokenAddress];
            for (uint256 i; i < pools.length; ++i) {
                uint256 poolShare = (poolsAssetsReserves[pools[i]][tokenAddress] * EXP_SCALE) / assetReserve;
                if (poolShare == 0) continue;
                updatePoolAssetsReserve(pools[i], tokenAddress, amountDiff, poolShare);
            }
            assetsReserves[tokenAddress] -= amountDiff;
        }
    }

    /// @notice Update the poolAssetsReserves upon transferring the tokens
    /// @param pool Address of the pool
    /// @param tokenAddress Address of the token
    /// @param amount Amount transferred to address(to)
    /// @param poolShare share for corresponding pool
    function updatePoolAssetsReserve(address pool, address tokenAddress, uint256 amount, uint256 poolShare) internal {
        uint256 poolAmountShare = (poolShare * amount) / EXP_SCALE;
        poolsAssetsReserves[pool][tokenAddress] -= poolAmountShare;
    }

    /// @notice Get the array of all pools addresses
    /// @param tokenAddress Address of the token
    function getPools(address tokenAddress) internal view returns (address[] memory) {
        address[] memory pools = IPoolRegistry(poolRegistry).getPoolsSupportedByAsset(tokenAddress);

        if (isAssetListedInCore(tokenAddress)) {
            uint256 poolsLength = pools.length;
            address[] memory poolsWithCore = new address[](poolsLength + 1);

            for (uint256 i; i < poolsLength; ++i) {
                poolsWithCore[i] = pools[i];
            }
            poolsWithCore[poolsLength] = corePoolComptroller;
            return poolsWithCore;
        }

        return pools;
    }

    function isAssetListedInCore(address tokenAddress) internal view returns (bool isAssetListed) {
        address[] memory coreMarkets = IComptroller(corePoolComptroller).getAllMarkets();

        for (uint256 i; i < coreMarkets.length; ++i) {
            isAssetListed = (vBNB == coreMarkets[i])
                ? (tokenAddress == NATIVE_WRAPPED)
                : (IVToken(coreMarkets[i]).underlying() == tokenAddress);

            if (isAssetListed) {
                break;
            }
        }
    }

    /// @notice This function checks for the given asset is listed or not
    /// @param comptroller Address of the comptroller
    /// @param asset Address of the asset
    function ensureAssetListed(address comptroller, address asset) internal view returns (bool) {
        if (comptroller == corePoolComptroller) {
            return isAssetListedInCore(asset);
        }

        return IPoolRegistry(poolRegistry).getVTokenForAsset(comptroller, asset) != address(0);
    }
}
