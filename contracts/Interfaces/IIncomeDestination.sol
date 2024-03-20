// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.20;

interface IIncomeDestination {
    function updateAssetsState(address comptroller, address asset) external;
}
