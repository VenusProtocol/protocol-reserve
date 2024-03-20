// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.20;

import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { MaxLoopsLimitHelper } from "@venusprotocol/solidity-utilities/contracts/MaxLoopsLimitHelper.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { sort } from "../Utils/ArrayHelpers.sol";
import { IAbstractTokenConverter } from "./IAbstractTokenConverter.sol";
import { IConverterNetwork } from "../Interfaces/IConverterNetwork.sol";

/// @title ConverterNetwork
/// @author Venus
/// @notice ConverterNetwork keeps track of all the converters and is used to fetch valid converters which provide conversions according to token addresses provided
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract ConverterNetwork is IConverterNetwork, AccessControlledV8, MaxLoopsLimitHelper {
    /// @notice Array holding all the converters
    IAbstractTokenConverter[] public allConverters;

    /// @notice Emitted when new converter is added
    event ConverterAdded(address indexed converter);

    /// @notice Emitted when converter is removed
    event ConverterRemoved(address indexed converter);

    /// @notice Error thrown when converter already exists
    error ConverterAlreadyExists();

    /// @notice Error thrown converter does not exist
    error ConverterDoesNotExist();

    /// @notice Error thrown when converter address is invalid
    error InvalidTokenConverterAddress();

    /// @notice Error thrown when loops limit is invalid
    error InvalidMaxLoopsLimit(uint256 loopsLimit);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

    /// @notice ConverterNetwork initializer
    /// @param _accessControlManager The address of ACM contract
    /// @param _loopsLimit Limit for the loops in the contract to avoid DOS
    /// @custom:event ConverterAdded is emitted for each converter added on success
    /// @custom:error InvalidMaxLoopsLimit is thrown when when loops limit is invalid
    function initialize(address _accessControlManager, uint256 _loopsLimit) external initializer {
        ensureNonzeroAddress(_accessControlManager);
        __AccessControlled_init(_accessControlManager);

        if (_loopsLimit >= type(uint128).max) revert InvalidMaxLoopsLimit(_loopsLimit);
        _setMaxLoopsLimit(_loopsLimit);
    }

    /**
     * @notice Set the limit for the loops can iterate to avoid the DOS
     * @param limit Limit for the max loops can execute at a time
     * @custom:error InvalidMaxLoopsLimit is thrown when when loops limit is invalid
     * @custom:access Only owner
     */
    function setMaxLoopsLimit(uint256 limit) external onlyOwner {
        if (limit >= type(uint128).max) revert InvalidMaxLoopsLimit(limit);
        _setMaxLoopsLimit(limit);
    }

    /// @notice Adds new converter to the array
    /// @param _tokenConverter Address of the token converter
    /// @custom:event ConverterAdded is emitted on success
    /// @custom:access Only Governance
    function addTokenConverter(IAbstractTokenConverter _tokenConverter) external {
        _checkAccessAllowed("addTokenConverter(address)");
        _addTokenConverter(_tokenConverter);
    }

    /// @notice Removes converter from the array
    /// @param _tokenConverter Address of the token converter
    /// @custom:error ConverterDoesNotExist is thrown when converter to remove does not exist
    /// @custom:event ConverterRemoved is emitted on success
    /// @custom:access Only Governance
    function removeTokenConverter(IAbstractTokenConverter _tokenConverter) external {
        _checkAccessAllowed("removeTokenConverter(address)");

        // Find the index of the converter in the array
        uint128 indexToRemove = _findConverterIndex(_tokenConverter);

        // Ensure that the converter exists in the array
        if (indexToRemove == type(uint128).max) revert ConverterDoesNotExist();

        // Swap the element to remove with the last element
        allConverters[indexToRemove] = allConverters[allConverters.length - 1];

        // Remove the last element (which is now a duplicate)
        allConverters.pop();

        emit ConverterRemoved(address(_tokenConverter));
    }

    /// @notice Used to get the array of converters supporting conversions, arranged in descending order based on token balances
    /// It will return the converters which are open to users for conversion
    /// @param _tokenAddressIn Address of tokenIn
    /// @param _tokenAddressOut Address of tokenOut
    /// @return converters Array of the conveters on the basis of the tokens pair
    /// @return convertersBalance Array of balances with respect to token out
    function findTokenConverters(address _tokenAddressIn, address _tokenAddressOut)
        external
        returns (address[] memory converters, uint256[] memory convertersBalance)
    {
        (converters, convertersBalance) = _findTokenConverters(_tokenAddressIn, _tokenAddressOut, false);
    }

    /// @notice Used to get the array of converters supporting conversions, arranged in descending order based on token balances
    /// It will return the converters which are open to converters for conversion.
    /// @param _tokenAddressIn Address of tokenIn
    /// @param _tokenAddressOut Address of tokenOut
    /// @return converters Array of the conveters on the basis of the tokens pair
    /// @return convertersBalance Array of balances with respect to token out
    function findTokenConvertersForConverters(address _tokenAddressIn, address _tokenAddressOut)
        external
        returns (address[] memory converters, uint256[] memory convertersBalance)
    {
        (converters, convertersBalance) = _findTokenConverters(_tokenAddressIn, _tokenAddressOut, true);
    }

    /// @notice This function returns the array containing all the converters addresses
    /// @return converters Array containing all the converters addresses
    function getAllConverters() external view returns (IAbstractTokenConverter[] memory converters) {
        converters = allConverters;
    }

    /// @notice This function checks if the given address is a converter or not
    /// @param _tokenConverter Address of the token converter
    /// @return isConverter true if given address is converter otherwise false
    function isTokenConverter(address _tokenConverter) external view returns (bool isConverter) {
        uint128 index = _findConverterIndex(IAbstractTokenConverter(_tokenConverter));

        if (index != type(uint128).max) {
            isConverter = true;
        }
    }

    /// @notice Adds new converter contract to the array
    /// @param _tokenConverter Address of the token converter
    /// @custom:error ConverterAlreadyExists is thrown when new tokenconverter to add already exists
    /// @custom:event ConverterAdded is emitted on success
    function _addTokenConverter(IAbstractTokenConverter _tokenConverter) internal {
        if (
            (address(_tokenConverter) == address(0)) || (address(_tokenConverter.converterNetwork()) != address(this))
        ) {
            revert InvalidTokenConverterAddress();
        }

        uint128 index = _findConverterIndex(_tokenConverter);
        if (index != type(uint128).max) revert ConverterAlreadyExists();

        allConverters.push(_tokenConverter);
        _ensureMaxLoops(allConverters.length);

        emit ConverterAdded(address(_tokenConverter));
    }

    /// @notice Used to get the array of converters supporting conversions, arranged in descending order based on token balances
    /// @param _tokenAddressIn Address of tokenIn
    /// @param _tokenAddressOut Address of tokenOut
    /// @param forConverters Bool to filter out converters on the basis of the conversionAccess
    /// @return converters Array of converters
    /// @return convertersBalance Array of balances with respect to token out
    function _findTokenConverters(
        address _tokenAddressIn,
        address _tokenAddressOut,
        bool forConverters
    ) internal returns (address[] memory converters, uint256[] memory convertersBalance) {
        uint128 convertersLength = uint128(allConverters.length);

        // Create a dynamic array to store the matching converters
        converters = new address[](convertersLength);
        convertersBalance = new uint256[](convertersLength);
        uint128 count;

        for (uint128 i; i < convertersLength; ) {
            IAbstractTokenConverter converter = allConverters[i];

            unchecked {
                ++i;
            }

            if ((address(converter.converterNetwork()) != address(this)) || msg.sender == address(converter)) {
                continue;
            }

            (, IAbstractTokenConverter.ConversionAccessibility conversionAccess) = converter.conversionConfigurations(
                _tokenAddressIn,
                _tokenAddressOut
            );

            if (conversionAccess == IAbstractTokenConverter.ConversionAccessibility.ALL) {
                converters[count] = address(converter);
                convertersBalance[count] = converter.balanceOf(_tokenAddressOut);
                ++count;
            } else if (
                forConverters &&
                (conversionAccess == IAbstractTokenConverter.ConversionAccessibility.ONLY_FOR_CONVERTERS)
            ) {
                converters[count] = address(converter);
                convertersBalance[count] = converter.balanceOf(_tokenAddressOut);
                ++count;
            } else if (
                !forConverters && (conversionAccess == IAbstractTokenConverter.ConversionAccessibility.ONLY_FOR_USERS)
            ) {
                converters[count] = address(converter);
                convertersBalance[count] = converter.balanceOf(_tokenAddressOut);
                ++count;
            }
        }

        // Resize the array to the actual number of matching converters
        assembly {
            mstore(converters, count)
            mstore(convertersBalance, count)
        }
        sort(convertersBalance, converters);
    }

    /// @notice Used to get the index of the converter stored in the array
    /// This will return the index if the converter exists in the array otherwise will return type(uint128).max
    /// @param _tokenConverter Address of the token converter
    /// @return index of the converter address in the allConverters array
    function _findConverterIndex(IAbstractTokenConverter _tokenConverter) internal view returns (uint128 index) {
        index = type(uint128).max; // Not found, return a large value

        uint128 convertersLength = uint128(allConverters.length);
        for (uint128 i; i < convertersLength; ) {
            if (allConverters[i] == _tokenConverter) {
                index = i;
            }
            unchecked {
                ++i;
            }
        }
    }
}
