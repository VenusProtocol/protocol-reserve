// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

/// @title IXVSVaultProxy
/// @author Venus
/// @notice Interface implemented by `XVSVault`.
interface IXVSVault {
    function xvsStore() external view returns (address);
}
