// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { AbstractTokenConverter } from "./AbstractTokenConverter.sol";

/// @title SingleTokenConverter
/// @author Venus
/// @notice SingleTokenConverter used for token conversions and sends received tokens
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract SingleTokenConverter is AbstractTokenConverter {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Address of the base asset token
    address public baseAsset;

    /// @notice Emitted when base asset is updated
    event BaseAssetUpdated(address indexed oldBaseAsset, address indexed newBaseAsset);

    /// @notice Emmitted after the funds transferred to the destination address
    event AssetTransferredToDestination(
        address indexed receiver,
        address indexed comptroller,
        address indexed asset,
        uint256 amount
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

    /// @param accessControlManager_ Access control manager contract address
    /// @param priceOracle_ Resilient oracle address
    /// @param destinationAddress_  Address at all incoming tokens will transferred to
    /// @param baseAsset_ Address of the base asset
    /// @param minAmountToConvert_ Minimum amount to convert
    function initialize(
        address accessControlManager_,
        ResilientOracle priceOracle_,
        address destinationAddress_,
        address baseAsset_,
        uint256 minAmountToConvert_
    ) public initializer {
        _setBaseAsset(baseAsset_);

        // Initialize AbstractTokenConverter
        __AbstractTokenConverter_init(accessControlManager_, priceOracle_, destinationAddress_, minAmountToConvert_);
    }

    /// @notice Sets the base asset for the contract
    /// @param baseAsset_ The new address of the base asset
    /// @custom:access Only Governance
    function setBaseAsset(address baseAsset_) external onlyOwner {
        _setBaseAsset(baseAsset_);
    }

    /// @notice Get the balance for specific token
    /// @param tokenAddress Address of the token
    /// @return tokenBalance Balance of the token the contract has
    function balanceOf(address tokenAddress) public view override returns (uint256 tokenBalance) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        tokenBalance = token.balanceOf(address(this));
    }

    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address.
    /// @return balanceLeft Amount of asset, for _privateConversion
    // solhint-disable-next-line
    function _updateAssetsState(address comptroller, address asset) internal override returns (uint256 balanceLeft) {
        IERC20Upgradeable token = IERC20Upgradeable(asset);
        uint256 balance = token.balanceOf(address(this));
        balanceLeft = balance;

        if (asset == baseAsset) {
            balanceLeft = 0;
            token.safeTransfer(destinationAddress, balance);
            emit AssetTransferredToDestination(destinationAddress, comptroller, asset, balance);
        }
    }

    function _postPrivateConversionHook(
        address comptroller,
        address tokenAddressIn,
        uint256 convertedTokenInBalance,
        address,
        uint256
    ) internal override {
        if (convertedTokenInBalance > 0) {
            emit AssetTransferredToDestination(
                destinationAddress,
                comptroller,
                tokenAddressIn,
                convertedTokenInBalance
            );
        }
    }

    /// @dev Sets the base asset for the contract
    /// @param baseAsset_ The new address of the base asset
    /// @custom:error ZeroAddressNotAllowed is thrown when address is zero
    /// @custom:event BaseAssetUpdated is emitted on success
    function _setBaseAsset(address baseAsset_) internal {
        ensureNonzeroAddress(baseAsset_);
        emit BaseAssetUpdated(baseAsset, baseAsset_);
        baseAsset = baseAsset_;
    }

    /// @dev Get base asset address
    /// @return destinationBaseAsset Address of the base asset(baseAsset)
    function _getDestinationBaseAsset() internal view override returns (address destinationBaseAsset) {
        destinationBaseAsset = baseAsset;
    }
}
