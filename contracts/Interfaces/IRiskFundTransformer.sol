// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

interface IRiskFundTransformer {
    function updateAssetsState(address comptroller, address asset) external;
}
