// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.20;
import { sort } from "../../Utils/ArrayHelpers.sol";

contract MockArraySorter {
    function sortArray(uint256[] memory balances, address[] memory addrs)
        external
        view
        returns (address[] memory, uint256[] memory)
    {
        sort(balances, addrs);
        return (addrs, balances);
    }
}
