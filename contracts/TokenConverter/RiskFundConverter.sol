// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

import { AbstractTokenConverter } from "./AbstractTokenConverter.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "../Utils/Validators.sol";
import { IPoolRegistry } from "../Interfaces/IPoolRegistry.sol";
import { IComptroller } from "../Interfaces/IComptroller.sol";
import { IRiskFund, IRiskFundGetters } from "../Interfaces/IRiskFund.sol";
import { IVToken } from "../Interfaces/IVToken.sol";

/// @title RiskFundConverter
/// @author Venus
/// @notice RiskFundConverter used for token conversions and sends received token to RiskFund
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract RiskFundConverter is AbstractTokenConverter {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Address of the core pool comptroller
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable CORE_POOL_COMPTROLLER;

    ///@notice Address of the vBNB
    ///@dev This address is used to include the BNB market while in getPools method
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable VBNB;

    ///@notice Address of the native wrapped currency
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable NATIVE_WRAPPED;

    /// @notice Store the previous state for the asset transferred to ProtocolShareReserve combined(for all pools)
    mapping(address => uint256) internal assetsReserves;

    /// @notice Store the asset's reserve per pool in the ProtocolShareReserve
    /// @dev Comptroller(pool) -> Asset -> amount
    mapping(address => mapping(address => uint256)) internal poolsAssetsReserves;

    /// @notice Address of pool registry contract
    address public poolRegistry;

    /// @notice The mapping contains the assets for each pool which are sent to RiskFund directly
    /// @dev Comptroller(pool) -> Asset -> bool(should transfer directly on true)
    mapping(address => mapping(address => bool)) public poolsAssetsDirectTransfer;

    /// @notice Emitted when pool registry address is updated
    event PoolRegistryUpdated(address indexed oldPoolRegistry, address indexed newPoolRegistry);

    /// @notice Emitted after updating of the assets reserves
    /// amount -> reserve increased by amount
    event AssetsReservesUpdated(address indexed comptroller, address indexed asset, uint256 amount);

    /// @notice Emmitted after the funds transferred to the destination address
    event AssetTransferredToDestination(
        address receiver,
        address indexed comptroller,
        address indexed asset,
        uint256 amount
    );

    /// @notice Emitted after the poolsAssetsDirectTransfer mapping is updated
    event PoolAssetsDirectTransferUpdated(address indexed comptroller, address indexed asset, bool value);

    // Error thrown when comptrollers array length is not equal to assets array length
    error InvalidArguments();

    /// @notice thrown when amount entered is greater than balance
    error InsufficientBalance();

    /// @notice thrown when asset does not exist in the pool
    error MarketNotExistInPool(address comptroller, address asset);

    /// @notice thrown to prevent reentrancy
    /// @dev This error is used to safeguard against reentrancy attacks, ensuring that a certain operation
    /// cannot be called recursively within the same transaction.
    error ReentrancyGuardError();

    /// @param corePoolComptroller_ Address of the Comptroller pool
    /// @param vBNB_ Address of the vBNB
    /// @param nativeWrapped_ Address of the wrapped native currency
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address corePoolComptroller_,
        address vBNB_,
        address nativeWrapped_
    ) {
        ensureNonzeroAddress(corePoolComptroller_);
        ensureNonzeroAddress(vBNB_);
        ensureNonzeroAddress(nativeWrapped_);

        CORE_POOL_COMPTROLLER = corePoolComptroller_;
        VBNB = vBNB_;
        NATIVE_WRAPPED = nativeWrapped_;

        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

    /// @param accessControlManager_ Access control manager contract address
    /// @param priceOracle_ Resilient oracle address
    /// @param destinationAddress_  Address at all incoming tokens will transferred to
    /// @param poolRegistry_ Address of the pool registry
    /// @param comptrollers Addresses of the pools
    /// @param assets Addresses of the assets need to be added for direct transfer
    /// @param values Boolean value to indicate whether direct transfer is allowed for each asset.
    /// @custom:event PoolAssetsDirectTransferUpdated emits on success
    function initialize(
        address accessControlManager_,
        ResilientOracle priceOracle_,
        address destinationAddress_,
        address poolRegistry_,
        address[] calldata comptrollers,
        address[][] calldata assets,
        bool[][] calldata values
    ) public initializer {
        // Initialize AbstractTokenConverter
        __AbstractTokenConverter_init(accessControlManager_, priceOracle_, destinationAddress_);
        ensureNonzeroAddress(poolRegistry_);
        poolRegistry = poolRegistry_;
        _setPoolsAssetsDirectTransfer(comptrollers, assets, values);
    }

    /// @dev Pool registry setter
    /// @param poolRegistry_ Address of the pool registry
    /// @custom:event PoolRegistryUpdated emits on success
    /// @custom:error ZeroAddressNotAllowed is thrown when pool registry address is zero
    /// @custom:access Only Governance
    function setPoolRegistry(address poolRegistry_) external onlyOwner {
        ensureNonzeroAddress(poolRegistry_);
        emit PoolRegistryUpdated(poolRegistry, poolRegistry_);
        poolRegistry = poolRegistry_;
    }

    /// @notice Update the poolsAssetsDirectTransfer mapping
    /// @param comptrollers Addresses of the pools
    /// @param assets Addresses of the assets need to be added for direct transfer
    /// @param values Boolean value to indicate whether direct transfer is allowed for each asset.
    /// @custom:event PoolAssetsDirectTransferUpdated emits on success
    /// @custom:access Restricted by ACM
    function setPoolsAssetsDirectTransfer(
        address[] calldata comptrollers,
        address[][] calldata assets,
        bool[][] calldata values
    ) external {
        _checkAccessAllowed("setPoolsAssetsDirectTransfer(address[],address[][],bool[][])");
        _setPoolsAssetsDirectTransfer(comptrollers, assets, values);
    }

    /// @dev Get the Amount of the asset in the risk fund for the specific pool
    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address
    /// @return reserves Asset's reserve in risk fund
    /// @custom:error MarketNotExistInPool When asset does not exist in the pool(comptroller)
    /// @custom:error ReentrancyGuardError thrown to prevent reentrancy during the function execution
    function getPoolAssetReserve(address comptroller, address asset) external view returns (uint256 reserves) {
        if (_reentrancyGuardEntered()) revert ReentrancyGuardError();
        if (!ensureAssetListed(comptroller, asset)) revert MarketNotExistInPool(comptroller, asset);

        reserves = poolsAssetsReserves[comptroller][asset];
    }

    /// @notice Get the balance for specific token
    /// @param tokenAddress Address of the token
    /// @return tokenBalance Reserves of the token the contract has
    function balanceOf(address tokenAddress) public view override returns (uint256 tokenBalance) {
        tokenBalance = assetsReserves[tokenAddress];
    }

    /// @notice Get the array of all pools addresses
    /// @param tokenAddress Address of the token
    /// @return poolsWithCore Array of the pools addresses in which token is available
    function getPools(address tokenAddress) public view returns (address[] memory poolsWithCore) {
        poolsWithCore = IPoolRegistry(poolRegistry).getPoolsSupportedByAsset(tokenAddress);

        if (isAssetListedInCore(tokenAddress)) {
            uint256 poolsLength = poolsWithCore.length;
            address[] memory extendedPools = new address[](poolsLength + 1);

            for (uint256 i; i < poolsLength; ) {
                extendedPools[i] = poolsWithCore[i];
                unchecked {
                    ++i;
                }
            }

            extendedPools[poolsLength] = CORE_POOL_COMPTROLLER;
            poolsWithCore = extendedPools;
        }
    }

    /// @dev This hook is used to update the state for asset reserves before transferring tokenOut to user
    /// @param tokenOutAddress Address of the asset to be transferred to the user
    /// @param amountOut Amount of tokenAddressOut transferred from this converter
    function _preTransferHook(address tokenOutAddress, uint256 amountOut) internal override {
        assetsReserves[tokenOutAddress] -= amountOut;
    }

    /// @notice Hook to perform after converting tokens
    /// @dev After transformation poolsAssetsReserves are settled by pool's reserves fraction
    /// @param tokenInAddress Address of the tokenIn
    /// @param tokenOutAddress Address of the tokenOut
    /// @param amountIn Amount of tokenIn transferred
    /// @param amountOut Amount of tokenOut transferred
    /// @custom:event AssetTransferredToDestination emits on success for each pool which has share
    function _postConversionHook(
        address tokenInAddress,
        address tokenOutAddress,
        uint256 amountIn,
        uint256 amountOut
    ) internal override {
        address[] memory pools = getPools(tokenOutAddress);
        uint256 assetReserve = assetsReserves[tokenOutAddress] + amountOut;
        ensureNonzeroValue(assetReserve);

        uint256 poolsLength = pools.length;
        uint256 distributedOutShare;
        uint256 poolAmountInShare;
        uint256 distributedInShare;

        for (uint256 i; i < poolsLength; ) {
            uint256 currentPoolsAssetsReserves = poolsAssetsReserves[pools[i]][tokenOutAddress];
            if (currentPoolsAssetsReserves != 0) {
                if (i < (poolsLength - 1)) {
                    distributedOutShare += updatePoolAssetsReserve(pools[i], tokenOutAddress, amountOut, assetReserve);
                    poolAmountInShare = (amountIn * currentPoolsAssetsReserves) / assetReserve;
                    distributedInShare += poolAmountInShare;
                } else {
                    uint256 distributedDiff = amountOut - distributedOutShare;
                    poolsAssetsReserves[pools[i]][tokenOutAddress] -= distributedDiff;
                    emit AssetsReservesUpdated(pools[i], tokenOutAddress, distributedDiff);
                    poolAmountInShare = amountIn - distributedInShare;
                }
                emit AssetTransferredToDestination(destinationAddress, pools[i], tokenInAddress, poolAmountInShare);
                IRiskFund(destinationAddress).updatePoolState(pools[i], tokenInAddress, poolAmountInShare);
            }
            unchecked {
                ++i;
            }
        }
    }

    /// @dev Operations to perform before sweeping tokens
    /// @param tokenAddress Address of the token
    /// @param amount Amount transferred to address(to)
    /// @custom:error InsufficientBalance is thrown when amount entered is greater than balance of token
    function preSweepToken(address tokenAddress, uint256 amount) internal override {
        uint256 balance = IERC20Upgradeable(tokenAddress).balanceOf(address(this));
        if (amount > balance) revert InsufficientBalance();
        uint256 balanceDiff = balance - assetsReserves[tokenAddress];

        if (balanceDiff < amount) {
            uint256 amountDiff;
            unchecked {
                amountDiff = amount - balanceDiff;
            }

            address[] memory pools = getPools(tokenAddress);
            uint256 assetReserve = assetsReserves[tokenAddress];
            uint256 poolsLength = pools.length;
            uint256 distributedShare;

            for (uint256 i; i < poolsLength; ) {
                if (poolsAssetsReserves[pools[i]][tokenAddress] != 0) {
                    if (i < (poolsLength - 1)) {
                        distributedShare += updatePoolAssetsReserve(pools[i], tokenAddress, amountDiff, assetReserve);
                    } else {
                        uint256 distributedDiff = amountDiff - distributedShare;
                        poolsAssetsReserves[pools[i]][tokenAddress] -= distributedDiff;
                        emit AssetsReservesUpdated(pools[i], tokenAddress, distributedDiff);
                    }
                }
                unchecked {
                    ++i;
                }
            }
            assetsReserves[tokenAddress] -= amountDiff;
        }
    }

    /// @dev Update the poolAssetsReserves upon transferring the tokens
    /// @param pool Address of the pool
    /// @param tokenAddress Address of the token
    /// @param amount Amount transferred to address(to)
    /// @param assetReserve Asset's reserve for the pool
    /// @return poolAmountShare Share of the pool as per it's reserve in compare to total reserves for the asset
    /// @custom:event AssetsReservesUpdated emits on success
    function updatePoolAssetsReserve(
        address pool,
        address tokenAddress,
        uint256 amount,
        uint256 assetReserve
    ) internal returns (uint256 poolAmountShare) {
        poolAmountShare = (poolsAssetsReserves[pool][tokenAddress] * amount) / assetReserve;
        poolsAssetsReserves[pool][tokenAddress] -= poolAmountShare;
        emit AssetsReservesUpdated(pool, tokenAddress, poolAmountShare);
    }

    /// @dev Update the poolsAssetsDirectTransfer mapping
    /// @param comptrollers Addresses of the pools
    /// @param assets Addresses of the assets need to be added for direct transfer
    /// @param values Boolean value to indicate whether direct transfer is allowed for each asset.
    /// @custom:event PoolAssetsDirectTransferUpdated emits on success
    /// @custom:error InvalidArguments thrown when comptrollers array length is not equal to assets array length
    function _setPoolsAssetsDirectTransfer(
        address[] calldata comptrollers,
        address[][] calldata assets,
        bool[][] calldata values
    ) internal {
        uint256 comptrollersLength = comptrollers.length;

        if ((comptrollersLength != assets.length) || (comptrollersLength != values.length)) {
            revert InvalidArguments();
        }

        for (uint256 i; i < comptrollersLength; ) {
            address[] memory poolAssets = assets[i];
            bool[] memory assetsValues = values[i];
            uint256 poolAssetsLength = poolAssets.length;

            if (poolAssetsLength != assetsValues.length) {
                revert InvalidArguments();
            }

            for (uint256 j; j < poolAssetsLength; ) {
                poolsAssetsDirectTransfer[comptrollers[i]][poolAssets[j]] = assetsValues[j];
                emit PoolAssetsDirectTransferUpdated(comptrollers[i], poolAssets[j], assetsValues[j]);
                unchecked {
                    ++j;
                }
            }

            unchecked {
                ++i;
            }
        }
    }

    /// @dev Update the reserve of the asset for the specific pool after transferring to risk fund
    /// and transferring funds to the protocol share reserve
    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address
    /// @return balanceDifference Amount of asset, for _privateConversion
    /// @custom:event AssetTransferredToDestination emits when poolsAssetsDirectTransfer is enabled for entered comptroller and asset
    /// @custom:error MarketNotExistInPool When asset does not exist in the pool(comptroller)
    function _updateAssetsState(address comptroller, address asset)
        internal
        override
        returns (uint256 balanceDifference)
    {
        if (!ensureAssetListed(comptroller, asset)) revert MarketNotExistInPool(comptroller, asset);

        IERC20Upgradeable token = IERC20Upgradeable(asset);
        uint256 currentBalance = token.balanceOf(address(this));
        uint256 assetReserve = assetsReserves[asset];
        if (currentBalance > assetReserve) {
            unchecked {
                balanceDifference = currentBalance - assetReserve;
            }
            if (poolsAssetsDirectTransfer[comptroller][asset]) {
                uint256 previousDestinationBalance = token.balanceOf(destinationAddress);
                token.safeTransfer(destinationAddress, balanceDifference);
                uint256 newDestinationBalance = token.balanceOf(destinationAddress);

                emit AssetTransferredToDestination(destinationAddress, comptroller, asset, balanceDifference);
                IRiskFund(destinationAddress).updatePoolState(
                    comptroller,
                    asset,
                    newDestinationBalance - previousDestinationBalance
                );
                balanceDifference = 0;
            }
        }
    }

    /// @dev This hook is used to update states for the converter after the privateConversion
    /// @param comptroller Comptroller address (pool)
    /// @param tokenAddressIn Address of the destination's base asset
    /// @param convertedTokenInBalance Amount of the base asset received after the conversion
    /// @param tokenAddressOut Address of the asset transferred to other converter in exchange of base asset
    /// @param convertedTokenOutBalance Amount of tokenAddressOut transferred from this converter
    function _postPrivateConversionHook(
        address comptroller,
        address tokenAddressIn,
        uint256 convertedTokenInBalance,
        address tokenAddressOut,
        uint256 convertedTokenOutBalance
    ) internal override {
        if (convertedTokenInBalance > 0) {
            emit AssetTransferredToDestination(
                destinationAddress,
                comptroller,
                tokenAddressIn,
                convertedTokenInBalance
            );
            IRiskFund(destinationAddress).updatePoolState(comptroller, tokenAddressIn, convertedTokenInBalance);
        }
        if (convertedTokenOutBalance > 0) {
            assetsReserves[tokenAddressOut] += convertedTokenOutBalance;
            poolsAssetsReserves[comptroller][tokenAddressOut] += convertedTokenOutBalance;
            emit AssetsReservesUpdated(comptroller, tokenAddressOut, convertedTokenOutBalance);
        }
    }

    /// @dev This function checks for the given asset is listed in core pool or not
    /// @param tokenAddress Address of the asset
    /// @return isAssetListed true if the asset is listed
    function isAssetListedInCore(address tokenAddress) internal view returns (bool isAssetListed) {
        address[] memory coreMarkets = IComptroller(CORE_POOL_COMPTROLLER).getAllMarkets();

        uint256 coreMarketsLength = coreMarkets.length;
        for (uint256 i; i < coreMarketsLength; ) {
            isAssetListed = (VBNB == coreMarkets[i])
                ? (tokenAddress == NATIVE_WRAPPED)
                : (IVToken(coreMarkets[i]).underlying() == tokenAddress);

            if (isAssetListed) {
                break;
            }

            unchecked {
                ++i;
            }
        }
    }

    /// @dev This function checks for the given asset is listed or not
    /// @param comptroller Address of the comptroller
    /// @param asset Address of the asset
    /// @return isListed true if the asset is listed
    function ensureAssetListed(address comptroller, address asset) internal view returns (bool isListed) {
        if (comptroller == CORE_POOL_COMPTROLLER) {
            isListed = isAssetListedInCore(asset);
        } else {
            isListed = IPoolRegistry(poolRegistry).getVTokenForAsset(comptroller, asset) != address(0);
        }
    }

    /// @dev Get base asset address of the RiskFund
    /// @return destinationBaseAsset Address of the base asset(RiskFund)
    function _getDestinationBaseAsset() internal view override returns (address destinationBaseAsset) {
        destinationBaseAsset = IRiskFundGetters(destinationAddress).convertibleBaseAsset();
    }
}
