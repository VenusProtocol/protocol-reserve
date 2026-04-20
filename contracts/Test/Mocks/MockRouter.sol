// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockRouter
/// @notice Minimal DEX router mock for testing TokenBuyback.
///         Pulls tokenIn via transferFrom and sends tokenOut to recipient.
///         `shouldFail` flag lets tests simulate router failures.
///         `skipTransfer` flag lets tests simulate a router that pulls input but sends no output (amountOut = 0 path).
contract MockRouter {
    bool public shouldFail;
    bool public skipTransfer;

    error RouterForcedFailure();

    function setShouldFail(bool value) external {
        shouldFail = value;
    }

    function setSkipTransfer(bool value) external {
        skipTransfer = value;
    }

    /// @notice Simulates a DEX swap
    /// @param tokenIn Token pulled from caller
    /// @param amountIn Amount pulled
    /// @param tokenOut Token sent to recipient
    /// @param amountOut Amount sent
    /// @param recipient Where tokenOut is delivered
    function swap(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut,
        address recipient
    ) external {
        if (shouldFail) {
            revert RouterForcedFailure();
        }

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        if (!skipTransfer) {
            IERC20(tokenOut).transfer(recipient, amountOut);
        }
    }

    /// @notice Fund the router with tokenOut so it can deliver swap output in tests
    function fund(address token, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }
}
