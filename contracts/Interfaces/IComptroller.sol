// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

interface IComptroller {
    function isComptroller() external view returns (bool);

    function markets(address) external view returns (bool);

    function getAllMarkets() external view returns (address[] memory);
}
