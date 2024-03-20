// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.20;

import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";
import { IConverterNetwork } from "../Interfaces/IConverterNetwork.sol";

/// @notice Interface for AbstractTokenConverter
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
interface IAbstractTokenConverter {
    /// @notice This enum define the all possible ways of conversion can happen
    enum ConversionAccessibility {
        NONE, // Conversion is disable for the pair
        ALL, // Conversion is enable for private conversion and users
        ONLY_FOR_CONVERTERS, // Conversion is enable only for private conversion
        ONLY_FOR_USERS // Conversion is enable only for users
    }

    /// @notice This struct represents the configuration for a token conversion.
    struct ConversionConfig {
        /// incentive on conversion of tokens in mantissa i.e 10% incentive would be 0.1 * 1e18
        uint256 incentive;
        /// enable or disable conversion for users or converters or both or none
        ConversionAccessibility conversionAccess;
    }

    /// @notice Pause conversion of tokens
    function pauseConversion() external;

    /// @notice Resume conversion of tokens.
    function resumeConversion() external;

    /// @notice Sets a new price oracle
    /// @param priceOracle_ Address of the new price oracle to set
    function setPriceOracle(ResilientOracle priceOracle_) external;

    /// @notice Set the configuration for new or existing convert pair
    /// @param tokenAddressIn Address of tokenIn
    /// @param tokenAddressOut Address of tokenOut
    /// @param conversionConfig ConversionConfig config details to update
    function setConversionConfig(
        address tokenAddressIn,
        address tokenAddressOut,
        ConversionConfig calldata conversionConfig
    ) external;

    /// @notice Convert exact amount of tokenAddressIn for tokenAddressOut
    /// @dev Method does not support deflationary tokens transfer
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @param to Address of the tokenAddressOut receiver
    function convertExactTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external returns (uint256 actualAmountIn, uint256 actualAmountOut);

    /// @notice Convert tokens for tokenAddressIn for exact amount of tokenAddressOut
    /// @dev Method does not support deflationary tokens transfer
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @param to Address of the tokenAddressOut receiver
    function convertForExactTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external returns (uint256 actualAmountIn, uint256 actualAmountOut);

    /// @notice Convert exact amount of tokenAddressIn for tokenAddressOut
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @param to Address of the tokenAddressOut receiver
    function convertExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external returns (uint256 actualAmountIn, uint256 actualAmountOut);

    /// @notice Convert tokens for tokenAddressIn for exact amount of tokenAddressOut
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @param to Address of the tokenAddressOut receiver
    function convertForExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external returns (uint256 actualAmountIn, uint256 actualAmountOut);

    /// @notice Get the configuration for the pair of the tokens
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @return incentives Percentage of incentives to be distributed for the pair of tokens
    /// @return conversionAccess Accessibility for the pair of tokens
    function conversionConfigurations(address tokenAddressIn, address tokenAddressOut)
        external
        returns (uint256 incentives, ConversionAccessibility conversionAccess);

    /// @notice Get the address of the converterNetwork
    function converterNetwork() external returns (IConverterNetwork converterNetwork);

    /// @notice To get the amount of tokenAddressOut tokens sender could receive on providing amountInMantissa tokens of tokenAddressIn
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @return amountConvertedMantissa Amount of tokenAddressIn should be transferred after conversion
    /// @return amountOutMantissa Amount of the tokenAddressOut sender should receive after conversion
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when conversion is disabled or config does not exist for given pair
    function getUpdatedAmountOut(
        uint256 amountInMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) external returns (uint256 amountConvertedMantissa, uint256 amountOutMantissa);

    /// @notice To get the amount of tokenAddressIn tokens sender would send on receiving amountOutMantissa tokens of tokenAddressOut
    /// @param amountOutMantissa Amount of tokenAddressOut user wants to receive
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @return amountConvertedMantissa Amount of tokenAddressOut should be transferred after conversion
    /// @return amountInMantissa Amount of the tokenAddressIn sender would send to contract before conversion
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when conversion is disabled or config does not exist for given pair
    function getUpdatedAmountIn(
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) external returns (uint256 amountConvertedMantissa, uint256 amountInMantissa);

    /// @notice To get the amount of tokenAddressIn tokens sender would send on receiving amountOutMantissa tokens of tokenAddressOut
    /// @dev This function retrieves values without altering token prices.
    /// @param amountOutMantissa Amount of tokenAddressOut user wants to receive
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @return amountConvertedMantissa Amount of tokenAddressOut should be transferred after conversion
    /// @return amountInMantissa Amount of the tokenAddressIn sender would send to contract before conversion
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when conversion is disabled or config does not exist for given pair
    function getAmountIn(
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) external view returns (uint256 amountConvertedMantissa, uint256 amountInMantissa);

    /// @notice To get the amount of tokenAddressOut tokens sender could receive on providing amountInMantissa tokens of tokenAddressIn
    /// @dev This function retrieves values without altering token prices.
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @return amountConvertedMantissa Amount of tokenAddressIn should be transferred after conversion
    /// @return amountOutMantissa Amount of the tokenAddressOut sender should receive after conversion
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when conversion is disabled or config does not exist for given pair
    function getAmountOut(
        uint256 amountInMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) external view returns (uint256 amountConvertedMantissa, uint256 amountOutMantissa);

    /// @notice Get the balance for specific token
    /// @param token Address of the token
    /// @return tokenBalance Balance of the token the contract has
    function balanceOf(address token) external view returns (uint256 tokenBalance);
}
