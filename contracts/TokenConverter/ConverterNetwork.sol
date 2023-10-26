// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { ensureNonzeroAddress } from "../Utils/Validators.sol";
import { sort } from "../Utils/ArrayHelpers.sol";
import { AbstractTokenConverter } from "./AbstractTokenConverter.sol";
import { IConverterNetwork } from "../Interfaces/IConverterNetwork.sol";

/// @title ConverterNetwork
/// @author Venus
/// @notice ConverterNetwork keeps track of all the converters and is used to fetch valid converters which provide conversions according to token addresses provided
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract ConverterNetwork is IConverterNetwork, AccessControlledV8 {
    /// @notice Array holding all the converters
    AbstractTokenConverter[] public allConverters;

    /// @notice Emitted when new converter is added
    event ConverterAdded(address indexed converter);

    /// @notice Emitted when converter is removed
    event ConverterRemoved(address indexed converter);

    /// @notice Error thrown when converter already exists
    error ConverterAlreadyExists();

    /// @notice Error thrown converter does not exist
    error ConverterDoesNotExist();

    /// @notice ConverterNetwork initializer
    /// @param _accessControlManager The address of ACM contract
    /// @param _converters Addresses of the converters
    /// @custom:event ConverterAdded is emitted for each converter added on success
    function initialize(address _accessControlManager, AbstractTokenConverter[] calldata _converters)
        external
        initializer
    {
        ensureNonzeroAddress(_accessControlManager);
        __AccessControlled_init(_accessControlManager);

        uint128 convertsLength = uint128(_converters.length);
        for (uint128 i; i < convertsLength; ) {
            _addTokenConverter(_converters[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Adds new converter to the array
    /// @param _tokenConverter Address of the token converter
    /// @custom:event ConverterAdded is emitted on success
    /// @custom:access Only Governance
    function addTokenConverter(AbstractTokenConverter _tokenConverter) external {
        _checkAccessAllowed("addTokenConverter(AbstractTokenConverter)");
        _addTokenConverter(_tokenConverter);
    }

    /// @notice Removes converter from the array
    /// @param _tokenConverter Address of the token converter
    /// @custom:error ConverterDoesNotExist is thrown when converter to remove does not exist
    /// @custom:event ConverterRemoved is emitted on success
    /// @custom:access Only Governance
    function removeTokenConverter(AbstractTokenConverter _tokenConverter) external {
        _checkAccessAllowed("removeTokenConverter(AbstractTokenConverter)");
        ensureNonzeroAddress(address(_tokenConverter));

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
    /// @param _tokenAddressIn Address of tokenIn
    /// @param _tokenAddressOut Address of tokenOut
    /// @return Array of converters and their corresponding balances with respect to token out
    function findTokenConverter(address _tokenAddressIn, address _tokenAddressOut)
        external
        view
        returns (address[] memory, uint256[] memory)
    {
        uint128 convertersLength = uint128(allConverters.length);

        // Create a dynamic array to store the matching converters
        address[] memory converters = new address[](convertersLength);
        uint256[] memory convertersBalance = new uint256[](convertersLength);
        uint128 count;

        for (uint128 i; i < convertersLength; ) {
            AbstractTokenConverter converter = allConverters[i];
            (, bool enabled, ) = converter.conversionConfigurations(_tokenAddressIn, _tokenAddressOut);

            if (enabled && msg.sender != address(converter)) {
                converters[count] = address(converter);
                convertersBalance[count] = IERC20Upgradeable(_tokenAddressOut).balanceOf(address(converter));
                ++count;
            }
            unchecked {
                ++i;
            }
        }

        // Resize the array to the actual number of matching converters
        assembly {
            mstore(converters, count)
            mstore(convertersBalance, count)
        }
        sort(convertersBalance, converters);
        return (converters, convertersBalance);
    }

    /// @notice This function returns the array containing all the converters addresses
    /// @return Array containing all the converters addresses
    function getAllConverters() external view returns (AbstractTokenConverter[] memory) {
        return allConverters;
    }

    /// @notice This function checks for given address is converter or not
    /// @param _tokenConverter Address of the token converter
    /// @return boolean true if given address is converter otherwise false
    function isTokenConverter(address _tokenConverter) external view returns (bool) {
        uint128 index = _findConverterIndex(AbstractTokenConverter(_tokenConverter));

        if (index == type(uint128).max) return false;
        return true;
    }

    /// @notice Adds new converter contract to the array
    /// @param _tokenConverter Address of the token converter
    /// @custom:error ConverterAlreadyExists is thrown when new tokenconverter to add already exists
    /// @custom:event ConverterAdded is emitted on success
    function _addTokenConverter(AbstractTokenConverter _tokenConverter) internal {
        ensureNonzeroAddress(address(_tokenConverter));

        uint128 index = _findConverterIndex(_tokenConverter);
        if (index != type(uint128).max) revert ConverterAlreadyExists();

        allConverters.push(_tokenConverter);
        emit ConverterAdded(address(_tokenConverter));
    }

    /// @notice Used to get the index of the converter stored in the array
    /// This will return the index if the converter exists in the array otherwise will return type(uint128).max
    /// @param _tokenConverter Address of the token converter
    function _findConverterIndex(AbstractTokenConverter _tokenConverter) internal view returns (uint128) {
        uint128 convertLength = uint128(allConverters.length);
        for (uint128 i; i < convertLength; ) {
            if (allConverters[i] == _tokenConverter) {
                return i;
            }
            unchecked {
                ++i;
            }
        }
        return type(uint128).max; // Not found, return a large value
    }
}
