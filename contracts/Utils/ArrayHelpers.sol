// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

/// @notice Used to sort addresses array based on their token balances
/// @param arr Array of token balances of different addresses
/// @param addrs Array containing these addresses
function sort(uint256[] memory arr, address[] memory addrs) pure {
    if (arr.length > 1) {
        return quickSortDescending(arr, addrs, 0, arr.length - 1);
    }
}

/// @notice Used to sort addresses array based on their token balances
/// @param arr Array of token balances of different addresses
/// @param addrs Array containing these addresses
/// @param left index of first value
/// @param right index of last value
function quickSortDescending(
    uint256[] memory arr,
    address[] memory addrs,
    uint256 left,
    uint256 right
) pure {
    if (left >= right) return;
    uint256 p = arr[(left + right) / 2]; // p = the pivot element
    uint256 i = left;
    uint256 j = right;
    while (i < j) {
        while (arr[i] > p) ++i;
        while (arr[j] < p) --j; // arr[j] < p means p still to the right, so j > 0
        if (arr[i] < arr[j]) {
            (arr[i], arr[j]) = (arr[j], arr[i]);
            (addrs[i], addrs[j]) = (addrs[j], addrs[i]);
        } else {
            ++i;
        }
    }

    if (j > left) quickSortDescending(arr, addrs, left, j - 1); // j > left, so j > 0
    quickSortDescending(arr, addrs, j + 1, right);
}
