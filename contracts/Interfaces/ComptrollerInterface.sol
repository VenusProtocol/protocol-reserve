// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

interface ComptrollerInterface {
    struct Market {
        bool isListed;
    }

    function markets(address market) external view returns (Market memory);

    function isComptroller() external view returns (bool);
}
