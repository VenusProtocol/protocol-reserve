// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

interface PoolRegistryInterface {
    /*** get VToken in the Pool for an Asset ***/
    function getVTokenForAsset(address comptroller, address asset) external view returns (address);
}
