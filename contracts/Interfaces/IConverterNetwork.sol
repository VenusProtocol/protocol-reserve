// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { AbstractTokenConverter } from "../TokenConverter/AbstractTokenConverter.sol";

/**
 * @title IConverterNetwork
 * @author Venus
 * @notice Interface implemented by `ConverterNetwork`.
 */
interface IConverterNetwork {
    /// @notice Adds new converter to the array
    /// @param _tokenConverter Address of the token converter
    function addTokenConverter(AbstractTokenConverter _tokenConverter) external;

    /// @notice Removes converter from the array
    /// @param _tokenConverter Address of the token converter
    function removeTokenConverter(AbstractTokenConverter _tokenConverter) external;

    /// @notice Used to get the array of converters supporting conversions, arranged in descending order based on token balances
    /// @param _tokenAddressIn Address of tokenIn
    /// @param _tokenAddressOut Address of tokenOut
    /// @return Array of converters and their corresponding balances with respect to token out
    function findTokenConverter(address _tokenAddressIn, address _tokenAddressOut)
        external
        view
        returns (address[] memory, uint256[] memory);

    /// @notice This function returns the array containing all the converters addresses
    /// @return Array containing all the converters addresses
    function getAllConverters() external view returns (AbstractTokenConverter[] memory);

    /// @notice This function checks for given address is converter or not
    /// @param _tokenConverter Address of the token converter
    /// @return boolean true if given address is converter otherwise false
    function isTokenConverter(AbstractTokenConverter _tokenConverter) external view returns (bool);
}
