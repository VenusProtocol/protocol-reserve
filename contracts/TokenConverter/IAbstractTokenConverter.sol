// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

interface IAbstractTokenConverter {
    struct ConversionConfig {
        /// tokenIn address
        address tokenAddressIn;
        /// tokenOut address
        address tokenAddressOut;
        /// incentive on conversion of tokens in mantissa i.e 10% incentive would be 0.1 * 1e18
        uint256 incentive;
        /// whether the conversion is enabled
        bool enabled;
    }

    function pauseConversion() external;

    function resumeConversion() external;

    function setPriceOracle(ResilientOracle priceOracle_) external;

    function setConversionConfig(ConversionConfig calldata conversionConfig) external;

    function convertExactTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external;

    function convertForExactTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external;

    function convertExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external;

    function convertForExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external;
}
