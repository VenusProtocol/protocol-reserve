// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

/// @notice Interface for AbstractTokenConverter
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
interface IAbstractTokenConverter {
    /// @notice This struct represents the configuration for a token conversion.
    struct ConversionConfig {
        /// incentive on conversion of tokens in mantissa i.e 10% incentive would be 0.1 * 1e18
        uint256 incentive;
        /// whether the conversion is enabled
        bool enabled;
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
    ) external;

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
    ) external;

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
    ) external;

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
    ) external;

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
