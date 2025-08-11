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

    /// @notice The mapping contains the assets which are sent to destination directly
    /// @dev Asset -> bool(should transfer directly on true)
    mapping(address => bool) public assetsDirectTransfer;

    /// @notice Emitted when base asset is updated
    event BaseAssetUpdated(address indexed oldBaseAsset, address indexed newBaseAsset);

    /// @notice Emmitted after the funds transferred to the destination address
    event AssetTransferredToDestination(
        address indexed receiver,
        address indexed comptroller,
        address indexed asset,
        uint256 amount
    );

    /// @notice Emitted after the assetsDirectTransfer mapping is updated
    event AssetsDirectTransferUpdated(address indexed receiver, address indexed asset, bool value);

    /// @notice Thrown when the base asset is the same as the new base asset
    error SameBaseAssetNotAllowed();

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

    /// @notice Update the assetsDirectTransfer mapping
    /// @param assets Addresses of the assets need to be added for direct transfer
    /// @param values Boolean value to indicate whether direct transfer is allowed for each asset.
    /// @custom:event AssetsDirectTransferUpdated emits on success
    /// @custom:access Restricted by ACM
    function setAssetsDirectTransfer(address[] calldata assets, bool[] calldata values) external virtual {
        _checkAccessAllowed("setAssetsDirectTransfer(address[],bool[])");
        _setAssetsDirectTransfer(assets, values);
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

        if (asset == baseAsset || assetsDirectTransfer[asset]) {
            balanceLeft = 0;
            token.safeTransfer(destinationAddress, balance);
            emit AssetTransferredToDestination(destinationAddress, comptroller, asset, balance);
        }
    }

    /// @notice Hook called after a private conversion is completed
    /// @dev Emits an AssetTransferredToDestination event if Private Conversion happens
    /// @param comptroller The address of the comptroller (pool) associated with the conversion
    /// @param tokenAddressIn The address of the input token that was converted
    /// @param convertedTokenInBalance The amount of input token that was converted
    /// @custom:event AssetTransferredToDestination Emitted when convertedTokenInBalance > 0, indicating
    ///         the converted assets were transferred to the destination address
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

    /// @dev Update the assetsDirectTransfer mapping for destinationAddress
    /// @param assets Addresses of the assets need to be added for direct transfer
    /// @param values Boolean value to indicate whether direct transfer is allowed for each asset.
    /// @custom:event AssetsDirectTransferUpdated emits on success
    /// @custom:error InputLengthMisMatch thrown when assets and values array lengths don't match
    function _setAssetsDirectTransfer(address[] calldata assets, bool[] calldata values) internal {
        uint256 assetsLength = assets.length;

        if (assetsLength != values.length) {
            revert InputLengthMisMatch();
        }

        for (uint256 i; i < assetsLength; ++i) {
            assetsDirectTransfer[assets[i]] = values[i];
            emit AssetsDirectTransferUpdated(destinationAddress, assets[i], values[i]);
        }
    }

    /// @dev Sets the base asset for the contract
    /// @param baseAsset_ The new address of the base asset
    /// @custom:error ZeroAddressNotAllowed is thrown when address is zero
    /// @custom:error SameBaseAssetNotAllowed is thrown when `baseAsset_` is equal to the current base asset
    /// @custom:event BaseAssetUpdated is emitted on success
    function _setBaseAsset(address baseAsset_) internal {
        ensureNonzeroAddress(baseAsset_);

        if (baseAsset == baseAsset_) {
            revert SameBaseAssetNotAllowed();
        }

        emit BaseAssetUpdated(baseAsset, baseAsset_);
        baseAsset = baseAsset_;
    }

    /// @dev Get base asset address
    /// @return destinationBaseAsset Address of the base asset(baseAsset)
    function _getDestinationBaseAsset() internal view override returns (address destinationBaseAsset) {
        destinationBaseAsset = baseAsset;
    }
}
