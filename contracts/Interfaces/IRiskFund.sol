// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

/**
 * @title IRiskFund
 * @author Venus
 * @notice Interface implemented by `RiskFund`.
 */
interface IRiskFund {
    function transferReserveForAuction(
        address comptroller,
        address bidder,
        uint256 amount
    ) external returns (uint256);

    function updatePoolState(
        address comptroller,
        address asset,
        uint256 amount
    ) external;
}
