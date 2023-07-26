// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

import { AbstractTokenTransformer } from "./AbstractTokenTransformer.sol";
import { ReserveHelpers } from "../Helpers/ReserveHelpers.sol";
import { ensureNonzeroAddress } from "../Utils/Validators.sol";
import { IPoolRegistry } from "../Interfaces/IPoolRegistry.sol";
import { IRiskFund } from "../Interfaces/IRiskFund.sol";
import { EXP_SCALE } from "../Utils/Constants.sol";

contract RiskFundTransformer is AbstractTokenTransformer, ReserveHelpers {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Emitted when pool registry address is updated
    event PoolRegistryUpdated(address indexed oldPoolRegistry, address indexed newPoolRegistry);

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

    /// @notice Get the balance for specific token
    /// @param tokenAddress Address of the token
    function balanceOf(address tokenAddress) public view override returns (uint256 tokenBalance) {
        return assetsReserves[tokenAddress];
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

    /// @notice Hook to perform after transforming tokens
    /// @dev After transfromation poolsAssetsReserves are settled by pool's reserves fraction
    /// @param tokenInAddress Address of the tokenIn
    /// @param amountIn Amount of tokenIn transformered
    /// @param amountOut Amount of tokenOut transformered
    function postTransformationHook(address tokenInAddress, uint256 amountIn, uint256 amountOut) internal override {
        address[] memory pools = IPoolRegistry(poolRegistry).getPoolsSupportedByAsset(tokenInAddress);

        for (uint256 i; i < pools.length; ++i) {
            uint256 poolShare = (poolsAssetsReserves[pools[i]][tokenInAddress] * EXP_SCALE) /
                assetsReserves[tokenInAddress];
            if (poolShare == 0) continue;
            updatePoolAssetsReserve(pools[i], tokenInAddress, amountIn, poolShare);
            uint256 poolAmountOutShare = (poolShare * amountOut) / EXP_SCALE;
            IRiskFund(destinationAddress).updatePoolState(pools[i], poolAmountOutShare);
        }

        assetsReserves[tokenInAddress] -= amountIn;
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

            for (uint256 i; i < pools.length; ++i) {
                uint256 poolShare = (poolsAssetsReserves[pools[i]][tokenAddress] * EXP_SCALE) /
                    assetsReserves[tokenAddress];
                if (poolShare == 0) continue;
                updatePoolAssetsReserve(pools[i], tokenAddress, amount, poolShare);
            }
            assetsReserves[tokenAddress] -= amountDiff;
        }
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
