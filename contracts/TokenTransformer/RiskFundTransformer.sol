// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

import { AbstractTokenTransformer } from "./AbstractTokenTransformer.sol";
import { ReserveHelpers } from "../Helpers/ReserveHelpers.sol";
import { ensureNonzeroAddress } from "../Utils/Validators.sol";
import { PoolRegistryInterface } from "../Interfaces/PoolRegistryInterface.sol";
import { IRiskFund } from "../Interfaces/IRiskFund.sol";
import { EXP_SCALE } from "../Utils/Constants.sol";

contract RiskFundTransformer is AbstractTokenTransformer, ReserveHelpers {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Emitted when pool registry address is updated
    event PoolRegistryUpdated(address indexed oldPoolRegistry, address indexed newPoolRegistry);

    /// @param accessControlManager_ Access control manager contract address
    /// @param priceOracle_ Resilient oracle address
    /// @param destinationAddress_  Address at all incoming tokens will transferred to
    function initialize(
        address accessControlManager_,
        ResilientOracle priceOracle_,
        address destinationAddress_
    ) public override {
        // Initialize AbstractTokenTransformer
        super.initialize(accessControlManager_, priceOracle_, destinationAddress_);
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

    /// @notice Get the balance for specific token
    /// @param tokenAddress Address of the token
    function balanceOf(address tokenAddress) external view override returns (uint256 tokenBalance) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        tokenBalance = token.balanceOf(address(this));
    }

    /// @notice Hook to perform after tranforming tokens
    /// @param tokenInAddress Address of the tokenIn
    /// @param amountIn Amount of tokenIn transformered
    /// @param amountOut Amount of tokenOut transformered
    function postTransformationHook(address tokenInAddress, uint256 amountIn, uint256 amountOut) internal override {
        address[] memory pools = PoolRegistryInterface(poolRegistry).getPoolsSupportedByAsset(tokenInAddress);

        for (uint256 i; i < pools.length; ++i) {
            uint256 poolShare = (poolsAssetsReserves[pools[i]][tokenInAddress] * EXP_SCALE) /
                assetsReserves[tokenInAddress];
            uint256 poolAmountInShare = (poolShare * amountIn) / EXP_SCALE;
            uint256 poolAmountOutShare = (poolShare * amountOut) / EXP_SCALE;

            poolsAssetsReserves[pools[i]][tokenInAddress] -= poolAmountInShare;
            IRiskFund(destinationAddress).updatePoolState(pools[i], poolAmountOutShare);
        }

        assetsReserves[tokenInAddress] -= amountIn;
    }
}
