// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.20;

/**
 * @title IRiskFund
 * @author Venus
 * @notice Interface implemented by `RiskFund`.
 */
interface IRiskFund {
    function transferReserveForAuction(address comptroller, uint256 amount) external returns (uint256);

    function updatePoolState(
        address comptroller,
        address asset,
        uint256 amount
    ) external;

    function getPoolsBaseAssetReserves(address comptroller) external view returns (uint256);
}

/**
 * @title IRiskFundGetters
 * @author Venus
 * @notice Interface implemented by `RiskFund` for getter methods.
 */
interface IRiskFundGetters {
    function convertibleBaseAsset() external view returns (address);
}
