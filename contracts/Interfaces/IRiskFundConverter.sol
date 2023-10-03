// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

interface IRiskFundConverter {
    function updateAssetsState(address comptroller, address asset) external;

    function getPools(address asset) external view returns (address[] memory);
}
