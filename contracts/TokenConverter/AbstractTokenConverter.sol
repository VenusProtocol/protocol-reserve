// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

import { MANTISSA_ONE, EXP_SCALE } from "../Utils/Constants.sol";
import { ensureNonzeroAddress } from "../Utils/Validators.sol";
import { IAbstractTokenConverter } from "./IAbstractTokenConverter.sol";

/// @title AbstractTokenConverter
/// @author Venus
/// @notice Abstract contract will be extended by XVSVaultConverter and RiskFundConverter
abstract contract AbstractTokenConverter is AccessControlledV8, IAbstractTokenConverter, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Maximum incentive could be
    uint256 public constant MAX_INCENTIVE = 0.5e18;

    /// @notice Venus price oracle contract
    ResilientOracle public priceOracle;

    /// @notice conversion configurations for the existing pairs
    /// @dev tokenAddressIn => tokenAddressOut => ConversionConfig
    mapping(address => mapping(address => ConversionConfig)) public convertConfigurations;

    /// @notice Address at all incoming tokens are transferred to
    address public destinationAddress;

    /// @notice Boolean of if convert is paused
    bool public conversionPaused;

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain.
    /// See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    uint256[47] private __gap;

    /// @notice Emitted when config is updated for tokens pair
    event ConversionConfigUpdated(
        address indexed tokenAddressIn,
        address indexed tokenAddressOut,
        uint256 oldIncentive,
        uint256 newIncentive,
        bool oldEnabled,
        bool newEnabled
    );
    /// @notice Emitted when price oracle address is updated
    event PriceOracleUpdated(ResilientOracle oldPriceOracle, ResilientOracle priceOracle);

    /// @notice Emitted when destination address is updated
    event DestinationAddressUpdated(address oldDestinationAddress, address destinationAddress);

    /// @notice Emitted when exact amount of tokens are convert for tokens
    event ConvertExactTokens(uint256 amountIn, uint256 amountOut);

    /// @notice Emitted when tokens are convert for exact amount of tokens
    event ConvertForExactTokens(uint256 amountIn, uint256 amountOut);

    /// @notice Emitted when exact amount of tokens are convert for tokens, for deflationary tokens
    event ConvertExactTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOut);

    /// @notice Emitted when tokens are convert for exact amount of tokens, for deflationary tokens
    event ConvertForExactTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOut);

    /// @notice Emitted when conversion is paused
    event ConversionPaused(address sender);

    /// @notice Emitted when conversion is unpaused
    event ConversionResumed(address sender);

    /// @notice Event emitted when tokens are swept
    event SweepToken(address indexed token);

    /// @notice Thrown when given input amount is zero
    error InsufficientInputAmount();

    /// @notice Thrown when conversion is disabled or config does not exist for given pair
    error ConversionConfigNotEnabled();

    /// @notice Thrown when incentive is higher than the MAX_INCENTIVE
    error IncentiveTooHigh(uint256 incentive, uint256 maxIncentive);

    /// @notice Thrown when amountOut is lower than amountOutMin
    error AmountOutLowerThanMinRequired(uint256 amountOutMantissa, uint256 amountOutMinMantissa);

    /// @notice Thrown when actual amountIn or amountOut is lower than expected
    error AmountInOrAmountOutMismatched(
        uint256 actualAmountIn,
        uint256 requiredAmountIn,
        uint256 actualAmountOut,
        uint256 requiredAmountOut
    );

    /// @notice Thrown when amountIn is higher than amountInMax
    error AmountInHigherThanMax(uint256 amountInMantissa, uint256 amountInMaxMantissa);

    /// @notice Thrown when conversion is paused
    error ConversionTokensPaused();

    /// @notice Thrown when conversion is Active
    error ConversionTokensActive();

    /// @notice Pause conversion of tokens
    /// @custom:event Emits ConversionPaused on success
    /// @custom:error ConversionTokensPaused thrown when convert is already paused
    /// @custom:access Restricted by ACM
    function pauseConversion() external {
        _checkAccessAllowed("pauseConversion()");
        _checkConversionPaused();
        conversionPaused = true;
        emit ConversionPaused(msg.sender);
    }

    /// @notice Resume conversion of tokens.
    /// @custom:event Emits ConversionResumed on success
    /// @custom:error ConversionTokensActive thrown when convert is already active
    /// @custom:access Restricted by ACM
    function resumeConversion() external {
        _checkAccessAllowed("resumeConversion()");
        if (!conversionPaused) {
            revert ConversionTokensActive();
        }

        conversionPaused = false;
        emit ConversionResumed(msg.sender);
    }

    /// @notice Sets a new price oracle
    /// @param priceOracle_ Address of the new price oracle to set
    /// @custom:access Only Governance
    function setPriceOracle(ResilientOracle priceOracle_) external onlyOwner {
        _setPriceOracle(priceOracle_);
    }

    /// @notice Sets a new destination address
    /// @param destinationAddress_ Address of the new price oracle to set
    /// @custom:access Only Governance
    function setDestination(address destinationAddress_) external onlyOwner {
        _setDestination(destinationAddress_);
    }

    /// @notice Set the configuration for new or existing convert pair
    /// @param conversionConfig ConversionConfig config details to update
    /// @custom:event Emits ConversionConfigUpdated event on success
    /// @custom:error Unauthorized error is thrown when the call is not authorized by AccessControlManager
    /// @custom:error ZeroAddressNotAllowed is thrown when pool registry address is zero
    /// @custom:access Controlled by AccessControlManager
    function setConversionConfig(ConversionConfig calldata conversionConfig) external {
        _checkAccessAllowed("setConversionConfig(ConversionConfig)");
        ensureNonzeroAddress(conversionConfig.tokenAddressIn);
        ensureNonzeroAddress(conversionConfig.tokenAddressOut);

        if (conversionConfig.incentive > MAX_INCENTIVE) {
            revert IncentiveTooHigh(conversionConfig.incentive, MAX_INCENTIVE);
        }

        ConversionConfig storage configuration = convertConfigurations[conversionConfig.tokenAddressIn][
            conversionConfig.tokenAddressOut
        ];

        uint256 oldIncentive = configuration.incentive;
        bool oldEnabled = configuration.enabled;

        configuration.tokenAddressIn = conversionConfig.tokenAddressIn;
        configuration.tokenAddressOut = conversionConfig.tokenAddressOut;
        configuration.incentive = conversionConfig.incentive;
        configuration.enabled = conversionConfig.enabled;

        emit ConversionConfigUpdated(
            conversionConfig.tokenAddressIn,
            conversionConfig.tokenAddressOut,
            oldIncentive,
            conversionConfig.incentive,
            oldEnabled,
            conversionConfig.enabled
        );
    }

    /// @notice Convert exact amount of tokenAddressIn for tokenAddressOut
    /// @dev Method does not support deflationary tokens transfer
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @param to Address of the tokenAddressOut receiver
    /// @custom:event Emits ConvertExactTokens event on success
    /// @custom:error AmountOutLowerThanMinRequired error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    /// @custom:error AmountInOrAmountOutMismatched error is thrown when Amount of tokenAddressIn or tokenAddressOut is lower than expected fater transfer
    function convertExactTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external nonReentrant {
        _checkConversionPaused();
        uint256 actualAmountIn;
        uint256 amountConvertedMantissa;
        uint256 actualAmountOut;
        uint256 amountOutMantissa;

        (actualAmountIn, amountConvertedMantissa, actualAmountOut, amountOutMantissa) = _convertExactTokensForTokens(
            amountInMantissa,
            amountOutMinMantissa,
            tokenAddressIn,
            tokenAddressOut,
            to
        );

        if ((actualAmountIn < amountConvertedMantissa) || (actualAmountOut < amountOutMantissa)) {
            revert AmountInOrAmountOutMismatched(
                actualAmountIn,
                amountConvertedMantissa,
                actualAmountOut,
                amountOutMantissa
            );
        }

        postConversionHook(tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);

        emit ConvertExactTokens(actualAmountIn, actualAmountOut);
    }

    /// @notice Convert tokens for tokenAddressIn for exact amount of tokenAddressOut
    /// @dev Method does not support deflationary tokens transfer
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @param to Address of the tokenAddressOut receiver
    /// @custom:event Emits ConvertForExactTokens event on success
    /// @custom:error AmountInHigherThanMax error is thrown when amount of tokenAddressIn is higher than amountInMaxMantissa
    /// @custom:error AmountInOrAmountOutMismatched error is thrown when Amount of tokenAddressIn or tokenAddressOut is lower than expected fater transfer
    function convertForExactTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external nonReentrant {
        _checkConversionPaused();
        uint256 actualAmountIn;
        uint256 amountInMantissa;
        uint256 actualAmountOut;
        uint256 amountConvertedMantissa;

        (actualAmountIn, amountInMantissa, actualAmountOut, amountConvertedMantissa) = _convertForExactTokens(
            amountInMaxMantissa,
            amountOutMantissa,
            tokenAddressIn,
            tokenAddressOut,
            to
        );

        if ((actualAmountIn < amountInMantissa) || (actualAmountOut < amountConvertedMantissa)) {
            revert AmountInOrAmountOutMismatched(
                actualAmountIn,
                amountInMantissa,
                actualAmountOut,
                amountConvertedMantissa
            );
        }

        postConversionHook(tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);

        emit ConvertForExactTokens(actualAmountIn, actualAmountOut);
    }

    /// @notice Convert exact amount of tokenAddressIn for tokenAddressOut
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @param to Address of the tokenAddressOut receiver
    /// @custom:event Emits ConvertExactTokensSupportingFeeOnTransferTokens event on success
    /// @custom:error AmountOutLowerThanMinRequired error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    function convertExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external nonReentrant {
        _checkConversionPaused();
        uint256 actualAmountIn;
        uint256 amountConvertedMantissa;
        uint256 actualAmountOut;
        uint256 amountOutMantissa;

        (actualAmountIn, amountConvertedMantissa, actualAmountOut, amountOutMantissa) = _convertExactTokensForTokens(
            amountInMantissa,
            amountOutMinMantissa,
            tokenAddressIn,
            tokenAddressOut,
            to
        );

        postConversionHook(tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);

        emit ConvertExactTokensSupportingFeeOnTransferTokens(actualAmountIn, actualAmountOut);
    }

    /// @notice Convert tokens for tokenAddressIn for exact amount of tokenAddressOut
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @param to Address of the tokenAddressOut receiver
    /// @custom:event Emits ConvertForExactTokensSupportingFeeOnTransferTokens event on success
    /// @custom:error AmountInHigherThanMax error is thrown when amount of tokenAddressIn is higher than amountInMaxMantissa
    function convertForExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external nonReentrant {
        _checkConversionPaused();
        uint256 actualAmountIn;
        uint256 amountInMantissa;
        uint256 actualAmountOut;
        uint256 amountConvertedMantissa;

        (actualAmountIn, amountInMantissa, actualAmountOut, amountConvertedMantissa) = _convertForExactTokens(
            amountInMaxMantissa,
            amountOutMantissa,
            tokenAddressIn,
            tokenAddressOut,
            to
        );

        postConversionHook(tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);

        emit ConvertForExactTokensSupportingFeeOnTransferTokens(actualAmountIn, actualAmountOut);
    }

    /// @notice A public function to sweep ERC20 tokens and transfer them to user(to address)
    /// @param tokenAddress The address of the ERC-20 token to sweep
    /// @custom:event Emits SweepToken event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when tokenAddress/to address is zero
    /// @custom:access Only Governance
    function sweepToken(address tokenAddress, address to, uint256 amount) external onlyOwner nonReentrant {
        ensureNonzeroAddress(tokenAddress);
        ensureNonzeroAddress(to);

        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        postSweepToken(tokenAddress, amount);
        token.safeTransfer(to, amount);

        emit SweepToken(address(token));
    }

    /// @notice To get the amount of tokenAddressOut tokens sender could receive on providing amountInMantissa tokens of tokenAddressIn
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @return amountConvertedMantissa Amount of tokenAddressIn should be transferred after convert
    /// @return amountOutMantissa Amount of the tokenAddressOut sender should receive after convert
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when convert is disabled or config does not exist for given pair
    function getUpdatedAmountOut(
        uint256 amountInMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) public returns (uint256 amountConvertedMantissa, uint256 amountOutMantissa) {
        priceOracle.updateAssetPrice(tokenAddressIn);
        priceOracle.updateAssetPrice(tokenAddressOut);
        (amountConvertedMantissa, amountOutMantissa) = getAmountOut(amountInMantissa, tokenAddressIn, tokenAddressOut);
    }

    /// @notice To get the amount of tokenAddressIn tokens sender would send on receiving amountOutMantissa tokens of tokenAddressOut
    /// @param amountOutMantissa Amount of tokenAddressOut user wants to receive
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @return amountConvertedMantissa Amount of tokenAddressOut should be transferred after convert
    /// @return amountInMantissa Amount of the tokenAddressIn sender would send to contract before convert
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when convert is disabled or config does not exist for given pair
    function getUpdatedAmountIn(
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) public returns (uint256 amountConvertedMantissa, uint256 amountInMantissa) {
        priceOracle.updateAssetPrice(tokenAddressIn);
        priceOracle.updateAssetPrice(tokenAddressOut);
        (amountConvertedMantissa, amountInMantissa) = getAmountIn(amountOutMantissa, tokenAddressIn, tokenAddressOut);
    }

    /// @notice To get the amount of tokenAddressOut tokens sender could receive on providing amountInMantissa tokens of tokenAddressIn
    /// @dev This function retrieves values without altering token prices.
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @return amountConvertedMantissa Amount of tokenAddressIn should be transferred after convert
    /// @return amountOutMantissa Amount of the tokenAddressOut sender should receive after convert
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when convert is disabled or config does not exist for given pair
    function getAmountOut(
        uint256 amountInMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) public view returns (uint256 amountConvertedMantissa, uint256 amountOutMantissa) {
        if (amountInMantissa == 0) {
            revert InsufficientInputAmount();
        }

        ConversionConfig memory configuration = convertConfigurations[tokenAddressIn][tokenAddressOut];

        if (!configuration.enabled) {
            revert ConversionConfigNotEnabled();
        }

        uint256 maxTokenOutReserve = balanceOf(tokenAddressOut);
        uint256 tokenInUnderlyingPrice = priceOracle.getPrice(tokenAddressIn);
        uint256 tokenOutUnderlyingPrice = priceOracle.getPrice(tokenAddressOut);

        /// amount of tokenAddressOut after including incentive
        uint256 conversionWithIncentive = MANTISSA_ONE + configuration.incentive;
        /// conversion rate after considering incentive(conversionWithIncentive)
        uint256 tokenInToOutConversion = (tokenInUnderlyingPrice * conversionWithIncentive) / tokenOutUnderlyingPrice;

        amountOutMantissa = (amountInMantissa * tokenInToOutConversion) / EXP_SCALE;
        amountConvertedMantissa = amountInMantissa;

        /// If contract has less liquity for tokenAddressOut than amountOutMantissa
        if (maxTokenOutReserve < amountOutMantissa) {
            amountConvertedMantissa =
                ((maxTokenOutReserve * EXP_SCALE) + tokenInToOutConversion - 1) /
                tokenInToOutConversion; //round-up
            amountOutMantissa = maxTokenOutReserve;
        }
    }

    /// @notice To get the amount of tokenAddressIn tokens sender would send on receiving amountOutMantissa tokens of tokenAddressOut
    /// @dev This function retrieves values without altering token prices.
    /// @param amountOutMantissa Amount of tokenAddressOut user wants to receive
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @return amountConvertedMantissa Amount of tokenAddressOut should be transferred after convert
    /// @return amountInMantissa Amount of the tokenAddressIn sender would send to contract before convert
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when convert is disabled or config does not exist for given pair
    function getAmountIn(
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) public view returns (uint256 amountConvertedMantissa, uint256 amountInMantissa) {
        if (amountOutMantissa == 0) {
            revert InsufficientInputAmount();
        }

        ConversionConfig memory configuration = convertConfigurations[tokenAddressIn][tokenAddressOut];

        if (!configuration.enabled) {
            revert ConversionConfigNotEnabled();
        }

        uint256 maxTokenOutReserve = balanceOf(tokenAddressOut);
        uint256 tokenInUnderlyingPrice = priceOracle.getPrice(tokenAddressIn);
        uint256 tokenOutUnderlyingPrice = priceOracle.getPrice(tokenAddressOut);

        /// amount of tokenAddressOut after including incentive
        uint256 conversionWithIncentive = MANTISSA_ONE + configuration.incentive;
        /// conversion rate after considering incentive(conversionWithIncentive)
        uint256 tokenInToOutConversion = (tokenInUnderlyingPrice * conversionWithIncentive) / tokenOutUnderlyingPrice;

        /// If contract has less liquity for tokenAddressOut than amountOutMantissa
        if (maxTokenOutReserve < amountOutMantissa) {
            amountInMantissa = ((maxTokenOutReserve * EXP_SCALE) + tokenInToOutConversion - 1) / tokenInToOutConversion; //round-up
            amountConvertedMantissa = maxTokenOutReserve;
        } else {
            amountInMantissa = ((amountOutMantissa * EXP_SCALE) + tokenInToOutConversion - 1) / tokenInToOutConversion; //round-up
            amountConvertedMantissa = amountOutMantissa;
        }
    }

    /// @notice Get the balance for specific token
    /// @param token Address of the token
    function balanceOf(address token) public view virtual returns (uint256 tokenBalance) {}

    /// @notice Operations to perform after sweepToken
    /// @param token Address of the token
    /// @param amount Amount transferred to address(to)
    function postSweepToken(address token, uint256 amount) internal virtual {}

    /// @notice Convert exact amount of tokenAddressIn for tokenAddressOut
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount of tokenAddressIn transferred
    /// @return amountConvertedMantissa Amount of tokenAddressIn supposed to get transferred
    /// @return actualAmountOut Actual amount of tokenAddressOut transferred
    /// @return amountOutMantissa Amount of tokenAddressOut supposed to get transferred
    /// @custom:error AmountOutLowerThanMinRequired error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    function _convertExactTokensForTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    )
        internal
        returns (
            uint256 actualAmountIn,
            uint256 amountConvertedMantissa,
            uint256 actualAmountOut,
            uint256 amountOutMantissa
        )
    {
        (amountConvertedMantissa, amountOutMantissa) = getUpdatedAmountOut(
            amountInMantissa,
            tokenAddressIn,
            tokenAddressOut
        );

        if (amountOutMantissa < amountOutMinMantissa) {
            revert AmountOutLowerThanMinRequired(amountOutMantissa, amountOutMinMantissa);
        }
        (actualAmountIn, actualAmountOut) = _actualAmounts(
            tokenAddressIn,
            tokenAddressOut,
            to,
            amountConvertedMantissa,
            amountOutMantissa
        );
    }

    /// @notice Convert tokens for tokenAddressIn for exact amount of tokenAddressOut
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount of tokenAddressIn transferred
    /// @return amountInMantissa Amount of tokenAddressIn supposed to get transferred
    /// @return actualAmountOut Actual amount of tokenAddressOut transferred
    /// @return amountConvertedMantissa Amount of tokenAddressOut supposed to get transferred
    /// @custom:error AmountInHigherThanMax error is thrown when amount of tokenAddressIn is higher than amountInMaxMantissa
    function _convertForExactTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    )
        internal
        returns (
            uint256 actualAmountIn,
            uint256 amountInMantissa,
            uint256 actualAmountOut,
            uint256 amountConvertedMantissa
        )
    {
        (amountConvertedMantissa, amountInMantissa) = getUpdatedAmountIn(
            amountOutMantissa,
            tokenAddressIn,
            tokenAddressOut
        );

        if (amountInMantissa > amountInMaxMantissa) {
            revert AmountInHigherThanMax(amountInMantissa, amountInMaxMantissa);
        }
        (actualAmountIn, actualAmountOut) = _actualAmounts(
            tokenAddressIn,
            tokenAddressOut,
            to,
            amountInMantissa,
            amountConvertedMantissa
        );
    }

    /// @notice return actualAmounts from reserves for tokenAddressIn and tokenAddressOut
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after convert
    /// @param to Address of the tokenAddressOut receiver
    /// @param amountInMantissa Amount of tokenAddressIn supposed to get transferred
    /// @param amountConvertedMantissa Amount of tokenAddressOut supposed to get transferred
    /// @return actualAmountIn Actual amount of tokenAddressIn transferred
    /// @return actualAmountOut Actual amount of tokenAddressOut transferred
    function _actualAmounts(
        address tokenAddressIn,
        address tokenAddressOut,
        address to,
        uint256 amountInMantissa,
        uint256 amountConvertedMantissa
    ) internal returns (uint256 actualAmountIn, uint256 actualAmountOut) {
        IERC20Upgradeable tokenIn = IERC20Upgradeable(tokenAddressIn);
        uint256 balanceBeforeDestination = tokenIn.balanceOf(destinationAddress);
        tokenIn.safeTransferFrom(msg.sender, destinationAddress, amountInMantissa);
        uint256 balanceAfterDestination = tokenIn.balanceOf(destinationAddress);

        IERC20Upgradeable tokenOut = IERC20Upgradeable(tokenAddressOut);
        uint256 balanceBeforeTo = tokenOut.balanceOf(to);
        tokenOut.safeTransfer(to, amountConvertedMantissa);
        uint256 balanceAfterTo = tokenOut.balanceOf(to);

        actualAmountIn = balanceAfterDestination - balanceBeforeDestination;
        actualAmountOut = balanceAfterTo - balanceBeforeTo;
    }

    /// @notice Sets a new price oracle
    /// @param priceOracle_ Address of the new price oracle to set
    /// @custom:event Emits PriceOracleUpdated event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when price oracle address is zero
    function _setPriceOracle(ResilientOracle priceOracle_) internal {
        ensureNonzeroAddress(address(priceOracle_));

        ResilientOracle oldPriceOracle = priceOracle;
        priceOracle = priceOracle_;

        emit PriceOracleUpdated(oldPriceOracle, priceOracle);
    }

    /// @notice Sets a new destination address
    /// @param destinationAddress_ Address of the new price oracle to set
    /// @custom:event Emits DestinationAddressUpdated event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when destination address is zero
    function _setDestination(address destinationAddress_) internal {
        ensureNonzeroAddress(destinationAddress_);

        address oldDestinationAddress = destinationAddress;
        destinationAddress = destinationAddress_;

        emit DestinationAddressUpdated(oldDestinationAddress, destinationAddress);
    }

    /// @notice Hook to perform after converting tokens
    /// @param tokenInAddress Address of the token
    /// @param amountIn Amount of tokenIn converted
    /// @param amountOut Amount of tokenOut converted
    function postConversionHook(
        address tokenInAddress,
        address tokenAddressOut,
        uint256 amountIn,
        uint256 amountOut
    ) internal virtual {}

    /// @param accessControlManager_ Access control manager contract address
    /// @param priceOracle_ Resilient oracle address
    /// @param destinationAddress_  Address at all incoming tokens will transferred to
    function __AbstractTokenConverter_init(
        address accessControlManager_,
        ResilientOracle priceOracle_,
        address destinationAddress_
    ) internal onlyInitializing {
        __AccessControlled_init(accessControlManager_);
        __ReentrancyGuard_init();
        __AbstractTokenConverter_init_unchained(priceOracle_, destinationAddress_);
    }

    /// @param priceOracle_ Resilient oracle address
    /// @param destinationAddress_  Address at all incoming tokens will transferred to
    function __AbstractTokenConverter_init_unchained(
        ResilientOracle priceOracle_,
        address destinationAddress_
    ) internal onlyInitializing {
        _setPriceOracle(priceOracle_);
        _setDestination(destinationAddress_);
        conversionPaused = false;
    }

    /// @notice To check, is convert paused
    function _checkConversionPaused() internal view {
        if (conversionPaused) {
            revert ConversionTokensPaused();
        }
    }
}
