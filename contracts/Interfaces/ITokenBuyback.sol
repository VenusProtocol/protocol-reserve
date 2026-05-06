// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

import { IIncomeDestination } from "./IIncomeDestination.sol";

/**
 * @title ITokenBuyback
 * @author Venus
 * @notice Interface implemented by `TokenBuyback`.
 */
interface ITokenBuyback is IIncomeDestination {
    /// @notice Executes a buyback by swapping accumulated tokens via a DEX router
    /// @param tokenIn Address of the token to swap
    /// @param amountIn Amount of tokenIn to swap
    /// @param minAmountOut Minimum acceptable amount of BASE_ASSET received
    /// @param deadline Unix timestamp after which the swap reverts
    /// @param router Address of the DEX router to use
    /// @param routerCalldata Encoded calldata for the router swap call (must send output to this contract)
    /// @param comptroller Address of the pool's comptroller, echoed in the BuybackExecuted event for off-chain attribution
    function executeBuyback(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        address router,
        bytes calldata routerCalldata,
        address comptroller
    ) external;

    /// @notice Forwards a caller-specified portion of accumulated BASE_ASSET to DESTINATION without swap
    /// @param comptroller Pool comptroller echoed in the BaseAssetForwarded event for off-chain attribution
    /// @param amount Amount of BASE_ASSET to forward
    function forwardBaseAsset(address comptroller, uint256 amount) external;

    /// @notice Adds or removes a DEX router from the allowlist
    /// @param router Address of the DEX router
    /// @param allowed Whether the router should be allowed
    function setAllowedRouter(address router, bool allowed) external;

    /// @notice Transfers tokens out of the contract (emergency recovery)
    /// @param token Address of the token to sweep
    /// @param to Recipient address
    /// @param amount Amount to transfer
    function sweepToken(
        address token,
        address to,
        uint256 amount
    ) external;

    /// @notice Updates the daily USD cap on tokenIn consumption (1e18-scaled)
    function setDailyCapUsd(uint256 newCap) external;

    /// @notice Updates the per-block USD cap on tokenIn consumption (1e18-scaled)
    function setPerBlockCapUsd(uint256 newCap) external;

    /// @notice Updates the absolute USD slippage threshold for AbnormalSlippage (1e18-scaled)
    function setSlippageEventUsd(uint256 newThreshold) external;
}
