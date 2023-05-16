// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

interface IPrime {
    struct Market {
        uint256 lastUpdated;
    }

    function markets(address market) external view returns (Market memory);
}
