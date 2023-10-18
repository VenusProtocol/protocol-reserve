// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

import { AbstractTokenConverter } from "./AbstractTokenConverter.sol";
import { ensureNonzeroAddress } from "../Utils/Validators.sol";

/// @title SingleTokenConverter
/// @author Venus
/// @notice SingleTokenConverter used for token conversions and sends received tokens
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract SingleTokenConverter is AbstractTokenConverter {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Address of the BASE_ASSET token
    address public immutable BASE_ASSET;

    /// @notice Emmitted after the funds transferred to the destination address
    event AssetTransferredToDestination(uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    /// @param baseAsset_ Address of the BASE_ASSET token
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address baseAsset_) {
        ensureNonzeroAddress(baseAsset_);
        BASE_ASSET = baseAsset_;

        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

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
    // solhint-disable-next-line
    function updateAssetsState(address comptroller, address asset) public {
        uint256 balance;
        if (asset == BASE_ASSET) {
            IERC20Upgradeable token = IERC20Upgradeable(BASE_ASSET);
            balance = token.balanceOf(address(this));

            token.safeTransfer(destinationAddress, balance);
        }

        emit AssetTransferredToDestination(balance);
    }

    /// @notice Get the balance for specific token
    /// @param tokenAddress Address of the token
    /// @return tokenBalance Balance of the token the contract has
    function balanceOf(address tokenAddress) public view override returns (uint256 tokenBalance) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        tokenBalance = token.balanceOf(address(this));
    }

    /// @notice Get base asset address
    function _getDestinationBaseAsset() internal view override returns (address) {
        return BASE_ASSET;
    }
}
