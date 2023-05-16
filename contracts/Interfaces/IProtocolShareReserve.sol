// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import {IReserveHelpers} from  "./IReserveHelpers.sol";

interface IProtocolShareReserve is IReserveHelpers {
    function updateAssetsState(address comptroller, address asset, IncomeType incomeType) external;
}


