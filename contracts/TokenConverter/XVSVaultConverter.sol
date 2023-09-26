// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

import { AbstractTokenConverter } from "./AbstractTokenConverter.sol";

/// @title XVSVaultConverter
/// @author Venus
/// @notice XVSVaultConverter used for token conversions and sends received token to XVSVaultTreasury
contract XVSVaultConverter is AbstractTokenConverter {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @param accessControlManager_ Access control manager contract address
    /// @param priceOracle_ Resilient oracle address
    /// @param destinationAddress_  Address at all incoming tokens will transferred to
    function initialize(
        address accessControlManager_,
        ResilientOracle priceOracle_,
        address destinationAddress_
    ) public initializer {
        // Initialize AbstractTokenConverter
        __AbstractTokenConverter_init(accessControlManager_, priceOracle_, destinationAddress_);
    }

    /// @dev This function is called by protocolShareReserve
    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address.
    function updateAssetsState(address comptroller, address asset) public {}

    /// @notice Get the balance for specific token
    /// @param tokenAddress Address of the token
    function balanceOf(address tokenAddress) public view override returns (uint256 tokenBalance) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        tokenBalance = token.balanceOf(address(this));
    }
}
