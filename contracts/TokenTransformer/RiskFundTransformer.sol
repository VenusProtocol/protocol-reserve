// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

import { AbstractTokenTransformer } from "./AbstractTokenTransformer.sol";
import { ensureNonzeroAddress } from "../Utils/Validators.sol";
import { IPoolRegistry } from "../Interfaces/IPoolRegistry.sol";
import { IComptroller } from "../Interfaces/IComptroller.sol";
import { IRiskFund } from "../Interfaces/IRiskFund.sol";
import { EXP_SCALE } from "../Utils/Constants.sol";

contract RiskFundTransformer is AbstractTokenTransformer {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Store the previous state for the asset transferred to ProtocolShareReserve combined(for all pools).
    mapping(address => uint256) internal assetsReserves;

    // Store the asset's reserve per pool in the ProtocolShareReserve.
    // Comptroller(pool) -> Asset -> amount
    mapping(address => mapping(address => uint256)) internal poolsAssetsReserves;

    // Address of pool registry contract
    address public poolRegistry;

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain.
    uint256[47] private __gap;

    /// @notice Emitted when pool registry address is updated
    event PoolRegistryUpdated(address indexed oldPoolRegistry, address indexed newPoolRegistry);

    // Event emitted after the updation of the assets reserves.
    // amount -> reserve increased by amount.
    event AssetsReservesUpdated(address indexed comptroller, address indexed asset, uint256 amount);

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

    /// @dev Get the Amount of the asset in the risk fund for the specific pool.
    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address.
    /// @return Asset's reserve in risk fund.
    function getPoolAssetReserve(address comptroller, address asset) external view returns (uint256) {
        require(IComptroller(comptroller).isComptroller(), "ReserveHelpers: Comptroller address invalid");
        require(asset != address(0), "ReserveHelpers: Asset address invalid");
        return poolsAssetsReserves[comptroller][asset];
    }

    /// @param accessControlManager_ Access control manager contract address
    /// @param priceOracle_ Resilient oracle address
    /// @param destinationAddress_  Address at all incoming tokens will transferred to
    function initialize(
        address accessControlManager_,
        ResilientOracle priceOracle_,
        address destinationAddress_
    ) public initializer {
        // Initialize AbstractTokenTransformer
        __AbstractTokenTransformer_init(accessControlManager_, priceOracle_, destinationAddress_);
    }

    /// @dev Update the reserve of the asset for the specific pool after transferring to risk fund
    /// and transferring funds to the protocol share reserve
    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address.
    function updateAssetsState(address comptroller, address asset) public {
        require(IComptroller(comptroller).isComptroller(), "ReserveHelpers: Comptroller address invalid");
        require(asset != address(0), "ReserveHelpers: Asset address invalid");
        require(poolRegistry != address(0), "ReserveHelpers: Pool Registry address is not set");
        require(
            IPoolRegistry(poolRegistry).getVTokenForAsset(comptroller, asset) != address(0),
            "ReserveHelpers: The pool doesn't support the asset"
        );

        uint256 currentBalance = IERC20Upgradeable(asset).balanceOf(address(this));
        uint256 assetReserve = assetsReserves[asset];
        if (currentBalance > assetReserve) {
            uint256 balanceDifference;
            unchecked {
                balanceDifference = currentBalance - assetReserve;
            }
            assetsReserves[asset] += balanceDifference;
            poolsAssetsReserves[comptroller][asset] += balanceDifference;
            emit AssetsReservesUpdated(comptroller, asset, balanceDifference);
        }
    }

    /// @notice Operations to perform after sweepToken
    /// @param tokenAddress Address of the token
    /// @param amount Amount transferred to address(to)
    function postSweepToken(address tokenAddress, uint256 amount) public override {
        uint256 balance = IERC20Upgradeable(tokenAddress).balanceOf(address(this));
        uint256 balanceDiff = balance - assetsReserves[tokenAddress];

        uint256 amountDiff = amount - balanceDiff;
        if (amountDiff > 0) {
            address[] memory pools = IPoolRegistry(poolRegistry).getPoolsSupportedByAsset(tokenAddress);
            uint256 assetReserve = assetsReserves[tokenAddress];
            for (uint256 i; i < pools.length; ++i) {
                uint256 poolShare = (poolsAssetsReserves[pools[i]][tokenAddress] * EXP_SCALE) / assetReserve;
                if (poolShare == 0) continue;
                updatePoolAssetsReserve(pools[i], tokenAddress, amount, poolShare);
            }
            assetsReserves[tokenAddress] -= amountDiff;
        }
    }

    /// @notice Get the balance for specific token
    /// @param tokenAddress Address of the token
    function balanceOf(address tokenAddress) public view override returns (uint256 tokenBalance) {
        return assetsReserves[tokenAddress];
    }

    /// @notice Hook to perform after transforming tokens
    /// @dev After transfromation poolsAssetsReserves are settled by pool's reserves fraction
    /// @param tokenInAddress Address of the tokenIn
    /// @param amountIn Amount of tokenIn transformered
    /// @param amountOut Amount of tokenOut transformered
    function postTransformationHook(address tokenInAddress, uint256 amountIn, uint256 amountOut) internal override {
        address[] memory pools = IPoolRegistry(poolRegistry).getPoolsSupportedByAsset(tokenInAddress);
        uint256 assetReserve = assetsReserves[tokenInAddress];
        for (uint256 i; i < pools.length; ++i) {
            uint256 poolShare = (poolsAssetsReserves[pools[i]][tokenInAddress] * EXP_SCALE) / assetReserve;
            if (poolShare == 0) continue;
            updatePoolAssetsReserve(pools[i], tokenInAddress, amountIn, poolShare);
            uint256 poolAmountOutShare = (poolShare * amountOut) / EXP_SCALE;
            IRiskFund(destinationAddress).updatePoolState(pools[i], poolAmountOutShare);
        }

        assetsReserves[tokenInAddress] -= amountIn;
    }

    /// @notice Update the poolAssetsResreves upon transferring the tokens
    /// @param pool Address of the pool
    /// @param tokenAddress Address of the token
    /// @param amount Amount transferred to address(to)
    /// @param poolShare share for corresponding pool
    function updatePoolAssetsReserve(address pool, address tokenAddress, uint256 amount, uint256 poolShare) internal {
        uint256 poolAmountShare = (poolShare * amount) / EXP_SCALE;
        poolsAssetsReserves[pool][tokenAddress] -= poolAmountShare;
    }
}
