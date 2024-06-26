// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

interface IVToken {
    function underlying() external view returns (address);
}
