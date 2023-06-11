// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

interface IVToken {
    function underlying() external returns (address);
}