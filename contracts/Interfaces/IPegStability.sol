// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

/**
 * @title IPegStability
 * @author Venus
 * @notice Minimal interface for the VAI Peg Stability Module (`PegStability`) consumed by
 *         `TreasuryTokenBuybackDistributor` to redeem VAI for the PSM's stable token (USDT).
 */
interface IPegStability {
    /// @notice Swaps VAI for the stable token, burning `stableTknAmount`-worth of VAI (plus the
    ///         outgoing fee) from the caller and sending `stableTknAmount` stable tokens to `receiver`.
    /// @param receiver The address that receives the stable token
    /// @param stableTknAmount The amount of stable tokens to receive
    /// @return The amount of VAI burnt from the caller
    function swapVAIForStable(address receiver, uint256 stableTknAmount) external returns (uint256);

    /// @notice The outgoing stable-coin fee in basis points (fee for swapVAIForStable)
    function feeOut() external view returns (uint256);

    /// @notice One dollar scaled to the stable token's oracle decimals (10 ** (36 - decimals))
    function ONE_DOLLAR() external view returns (uint256);

    /// @notice The ResilientOracle used to price the stable token
    function oracle() external view returns (address);

    /// @notice The stable token swapped against VAI (USDT)
    function STABLE_TOKEN_ADDRESS() external view returns (address);
}
