// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

interface IPoolRegistry {
    /// @notice Get VToken in the Pool for an Asset
    function getVTokenForAsset(address comptroller, address asset) external view returns (address);

    /// @notice Get the addresss of the Pools supported that include a market for the provided asset
    function getPoolsSupportedByAsset(address asset) external view returns (address[] memory);
}
