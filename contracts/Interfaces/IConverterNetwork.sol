// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { IAbstractTokenConverter } from "../TokenConverter/IAbstractTokenConverter.sol";

/**
 * @title IConverterNetwork
 * @author Venus
 * @notice Interface implemented by `ConverterNetwork`.
 */
interface IConverterNetwork {
    /// @notice Adds new converter to the array
    /// @param _tokenConverter Address of the token converter
    function addTokenConverter(IAbstractTokenConverter _tokenConverter) external;

    /// @notice Removes converter from the array
    /// @param _tokenConverter Address of the token converter
    function removeTokenConverter(IAbstractTokenConverter _tokenConverter) external;

    /// @notice Used to get the array of converters supporting conversions, arranged in descending order based on token balances
    /// @param _tokenAddressIn Address of tokenIn
    /// @param _tokenAddressOut Address of tokenOut
    /// @return converters Array of the conveters on the basis of the tokens pair
    /// @return convertersBalance Array of balances with respect to token out
    function findTokenConverters(address _tokenAddressIn, address _tokenAddressOut)
        external
        returns (address[] memory converters, uint256[] memory convertersBalance);

    /// @notice Used to get the array of converters supporting conversions, arranged in descending order based on token balances
    /// @param _tokenAddressIn Address of tokenIn
    /// @param _tokenAddressOut Address of tokenOut
    /// @return converters Array of the conveters on the basis of the tokens pair
    /// @return convertersBalance Array of balances with respect to token out
    function findTokenConvertersForConverters(address _tokenAddressIn, address _tokenAddressOut)
        external
        returns (address[] memory converters, uint256[] memory convertersBalance);

    /// @notice This function returns the array containing all the converters addresses
    /// @return Array containing all the converters addresses
    function getAllConverters() external view returns (IAbstractTokenConverter[] memory);

    /// @notice This function checks for given address is converter or not
    /// @param _tokenConverter Address of the token converter
    /// @return boolean true if given address is converter otherwise false
    function isTokenConverter(address _tokenConverter) external view returns (bool);
}
