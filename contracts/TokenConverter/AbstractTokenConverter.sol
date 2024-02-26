// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { MANTISSA_ONE, EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

import { IAbstractTokenConverter } from "./IAbstractTokenConverter.sol";
import { IConverterNetwork } from "../Interfaces/IConverterNetwork.sol";

/// @title AbstractTokenConverter
/// @author Venus
/// @notice Abstract contract will be extended by SingleTokenConverter and RiskFundConverter
/*
 * This contract specifies four functions for converting tokens, each applicable under following circumstances:
 *
 * Case I: TokenIn -> deflationary token, TokenOut -> deflationary token
 * In this scenario, functions supporting fees can only be utilized to convert tokens which are:
 * a. convertExactTokensSupportingFeeOnTransferTokens
 * b. convertForExactTokensSupportingFeeOnTransferTokens
 *
 * Case II: TokenIn -> deflationary token, TokenOut -> non-deflationary token
 * In this scenario, functions supporting fee can only be utilized to convert tokens which are:
 * similar to Case I.
 *
 * Case III: TokenIn -> non-deflationary token, TokenOut -> deflationary token
 * In this scenario, functions with or without supporting fee can be utilized to convert tokens which are:
 * a. convertExactTokens
 * b. convertForExactTokens
 * c. convertExactTokensSupportingFeeOnTransferTokens
 * d. convertForExactTokensSupportingFeeOnTransferTokens
 *
 * Case IV: TokenIn -> non-deflationary token, TokenOut -> non-deflationary token
 * In this scenario, functions with or without supporting fee can be utilized to convert tokens which are:
 * similar to Case III.
 *
 * ------------------------------------------------------------------------------------------------------------------------------------
 * Example 1:-
 *    tokenInAddress - 0xaaaa.....
 *    tokenOutAddress - 0xbbbb.....
 *    tokenInAmount - 100
 *    tokenOutMinAmount - minimum amount desired by the user(let's say 70)
 * Here user can use `convertExactTokens` or `convertExactTokensSupportingFeeOnTransferTokens`, if tokenIn is deflationary
 * then `convertExactTokensSupportingFeeOnTransferTokens` should be used(let's suppose `convertExactTokens` is used).
 * Now first tokenInAddress tokens will be transferred from the user to the contract, on the basis of amount
 * received(as tokenInAddress can be deflationary token) tokenAmountOut will be calculated and will be transferred
 * to the user and if amount sent is less than tokenOutMinAmount, tx will revert. If amount sent is satisfied(let's say
 * 80 or even 70) then at last the actual amount received and the amount that was supposed to be received by the contract will
 * be compared, if they differ then the whole tx will revert as user was supposed to use `convertExactTokensSupportingFeeOnTransferTokens`
 * function for tokenIn as deflationary token.
 *
 * Example 2:-
 *    tokenInAddress - 0xaaaa.....
 *    tokenOutAddress - 0xbbbb.....
 *    tokenInMaxAmount - maximum amount user is willing to provide(let's say 100)
 *    tokenOutAmount - 70
 * Here user can use `convertForExactTokens` or `convertForExactTokensSupportingFeeOnTransferTokens`, if tokenIn is deflationary
 * then `convertForExactTokensSupportingFeeOnTransferTokens` should be used(let's suppose `convertForExactTokens` is used),
 * which on the basis of tokenOutAmount provided will calculate tokenInAmount based on the tokens prices and will transfer
 * tokens from the user to the contract, now the actual amount received(as tokenInAddress can be deflationary token) will be
 * compared with tokenInMaxAmount if it is greater, tx will revert. If In amount is satisfied(let's say 90 or even 100) then
 * new tokenOutAmount will be calculated, and tokenOutAddress tokens will be transferred to the user, but at last the
 * old tokenOutAmount and new tokenOutAmount will be compared and if they differ whole tx will revert, because user was
 * supposed to use `convertForExactTokensSupportingFeeOnTransferTokens` function for tokenIn as deflationary token.
 * ------------------------------------------------------------------------------------------------------------------------------------
 *
 * This contract also supports private conversion between the converters:
 * Private conversions:
 * Private conversions is designed in order to convert the maximum amount of tokens received from PSR(to any converter) between
 * existing converters to save incentive and lower the dependency of users for conversion. So Private Conversion will be executed
 * by converters on it's own whenever funds are received from PSR. No incentive will be offered during private conversion.
 *
 * It will execute on updateAssetsState() function call in Converter Contracts. After this function call, converter will first
 * check for the amount received. If base asset is received then it will be directly sent to the destination address and no private
 * conversion will happen otherwise converter will interact with ConverterNetwork contract to find other valid converters who are providing the conversion for:
 *
 * tokenAddressIn: As asset received by that converter on updateAssetsState() function call.
 * tokenAddressOut: As base asset of that converter.
 *
 * ConverterNetwork:
 * This contract will contain all the converters, and will provide valid converters which can perform the execution according to tokenAddressIn
 * and tokenAddressOut provided.
 *
 * findTokenConverters():
 * It will return an array of converter addresses along with their corresponding balances, sorted in descending order based on the converter's balances
 * relative to tokenAddressOut. This function filter the converter addresses on the basis of the conversionAccess(for users).
 *
 * findTokenConvertersForConverters():
 * It will return an array of converter addresses along with their corresponding balances, sorted in descending order based on the converter's balances
 * relative to tokenAddressOut. This function filter the converter addresses on the basis of the conversionAccess(for converters).
 */

/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
abstract contract AbstractTokenConverter is AccessControlledV8, IAbstractTokenConverter, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Maximum incentive could be
    uint256 public constant MAX_INCENTIVE = 0.5e18;

    /// @notice Min amount to convert for private conversions. Defined in USD, with 18 decimals
    uint256 public minAmountToConvert;

    /// @notice Venus price oracle contract
    ResilientOracle public priceOracle;

    /// @notice conversion configurations for the existing pairs
    /// @dev tokenAddressIn => tokenAddressOut => ConversionConfig
    mapping(address => mapping(address => ConversionConfig)) public conversionConfigurations;

    /// @notice Address that all incoming tokens are transferred to
    address public destinationAddress;

    /// @notice Boolean for if conversion is paused
    bool public conversionPaused;

    /// @notice Address of the converterNetwork contract
    IConverterNetwork public converterNetwork;

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain.
    /// See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    uint256[45] private __gap;

    /// @notice Emitted when config is updated for tokens pair
    event ConversionConfigUpdated(
        address indexed tokenAddressIn,
        address indexed tokenAddressOut,
        uint256 oldIncentive,
        uint256 newIncentive,
        ConversionAccessibility oldAccess,
        ConversionAccessibility newAccess
    );
    /// @notice Emitted when price oracle address is updated
    event PriceOracleUpdated(ResilientOracle indexed oldPriceOracle, ResilientOracle indexed priceOracle);

    /// @notice Emitted when destination address is updated
    event DestinationAddressUpdated(address indexed oldDestinationAddress, address indexed destinationAddress);

    /// @notice Emitted when converterNetwork address is updated
    event ConverterNetworkAddressUpdated(address indexed oldConverterNetwork, address indexed converterNetwork);

    /// @notice Emitted when exact amount of tokens are converted for tokens
    event ConvertedExactTokens(
        address indexed sender,
        address indexed receiver,
        address tokenAddressIn,
        address indexed tokenAddressOut,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @notice Emitted when tokens are converted for exact amount of tokens
    event ConvertedForExactTokens(
        address indexed sender,
        address indexed receiver,
        address tokenAddressIn,
        address indexed tokenAddressOut,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @notice Emitted when exact amount of tokens are converted for tokens, for deflationary tokens
    event ConvertedExactTokensSupportingFeeOnTransferTokens(
        address indexed sender,
        address indexed receiver,
        address tokenAddressIn,
        address indexed tokenAddressOut,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @notice Emitted when tokens are converted for exact amount of tokens, for deflationary tokens
    event ConvertedForExactTokensSupportingFeeOnTransferTokens(
        address indexed sender,
        address indexed receiver,
        address tokenAddressIn,
        address indexed tokenAddressOut,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @notice Emitted when conversion is paused
    event ConversionPaused(address indexed sender);

    /// @notice Emitted when conversion is unpaused
    event ConversionResumed(address indexed sender);

    /// @notice Event emitted when tokens are swept
    event SweepToken(address indexed token, address indexed to, uint256 amount);

    /// @notice Emitted when minimum amount to convert is updated
    event MinAmountToConvertUpdated(uint256 oldMinAmountToConvert, uint256 newMinAmountToConvert);

    /// @notice Thrown when actualAmountOut does not match with amountOutMantissa for convertForExactTokens
    error AmountOutMismatched();

    /// @notice Thrown when actualAmountIn does not match with amountInMantissa for convertForExactTokens
    error AmountInMismatched();

    /// @notice Thrown when given input amount is zero
    error InsufficientInputAmount();

    /// @notice Thrown when given output amount is zero
    error InsufficientOutputAmount();

    /// @notice Thrown when conversion is disabled or config does not exist for given pair
    error ConversionConfigNotEnabled();

    /// @notice Thrown when conversion is enabled only for private conversions
    error ConversionEnabledOnlyForPrivateConversions();

    /// @notice Thrown when address(to) is same as tokenAddressIn or tokenAddressOut
    error InvalidToAddress();

    /// @notice Thrown when incentive is higher than the MAX_INCENTIVE
    error IncentiveTooHigh(uint256 incentive, uint256 maxIncentive);

    /// @notice Thrown when amountOut is lower than amountOutMin
    error AmountOutLowerThanMinRequired(uint256 amountOutMantissa, uint256 amountOutMinMantissa);

    /// @notice Thrown when amountIn is higher than amountInMax
    error AmountInHigherThanMax(uint256 amountInMantissa, uint256 amountInMaxMantissa);

    /// @notice Thrown when conversion is paused
    error ConversionTokensPaused();

    /// @notice Thrown when conversion is Active
    error ConversionTokensActive();

    /// @notice Thrown when tokenInAddress is same as tokeOutAdress OR tokeInAddress is not the base asset of the destination
    error InvalidTokenConfigAddresses();

    ///  @notice Thrown when contract has less liquidity for tokenAddressOut than amountOutMantissa
    error InsufficientPoolLiquidity();

    /// @notice When address of the ConverterNetwork is not set or Zero address
    error InvalidConverterNetwork();

    /// @notice Thrown when trying to set non zero incentive for private conversion
    error NonZeroIncentiveForPrivateConversion();

    /// @notice Thrown when using convertForExactTokens deflationary tokens
    error DeflationaryTokenNotSupported();

    /// @notice Thrown when minimum amount to convert is zero
    error InvalidMinimumAmountToConvert();

    /// @notice Thrown when there is a mismatch in the length of input arrays
    error InputLengthMisMatch();

    /**
     * @notice Modifier to ensure valid conversion parameters for a token conversion
     * and check if conversion is paused or not
     * @param to The recipient address for the converted tokens
     * @param tokenAddressIn The input token address for the conversion
     * @param tokenAddressOut The output token address for the conversion
     */
    modifier validConversionParameters(
        address to,
        address tokenAddressIn,
        address tokenAddressOut
    ) {
        _checkConversionPaused();
        ensureNonzeroAddress(to);
        if (to == tokenAddressIn || to == tokenAddressOut) {
            revert InvalidToAddress();
        }
        _;
    }

    /// @notice Pause conversion of tokens
    /// @custom:event Emits ConversionPaused on success
    /// @custom:error ConversionTokensPaused thrown when conversion is already paused
    /// @custom:access Restricted by ACM
    function pauseConversion() external {
        _checkAccessAllowed("pauseConversion()");
        _checkConversionPaused();
        conversionPaused = true;
        emit ConversionPaused(msg.sender);
    }

    /// @notice Resume conversion of tokens.
    /// @custom:event Emits ConversionResumed on success
    /// @custom:error ConversionTokensActive thrown when conversion is already active
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
    /// @param destinationAddress_ The new destination address to be set
    /// @custom:access Only Governance
    function setDestination(address destinationAddress_) external onlyOwner {
        _setDestination(destinationAddress_);
    }

    /// @notice Sets a converter network contract address
    /// @param converterNetwork_ The converterNetwork address to be set
    /// @custom:access Only Governance
    function setConverterNetwork(IConverterNetwork converterNetwork_) external onlyOwner {
        _setConverterNetwork(converterNetwork_);
    }

    /// @notice Min amount to convert setter
    /// @param minAmountToConvert_ Min amount to convert
    /// @custom:access Only Governance
    function setMinAmountToConvert(uint256 minAmountToConvert_) external {
        _checkAccessAllowed("setMinAmountToConvert(uint256)");
        _setMinAmountToConvert(minAmountToConvert_);
    }

    /// @notice Batch sets the conversion configurations
    /// @param tokenAddressIn Address of tokenIn
    /// @param tokenAddressesOut Array of addresses of tokenOut
    /// @param conversionConfigs Array of conversionConfig config details to update
    /// @custom:error InputLengthMisMatch is thrown when tokenAddressesOut and conversionConfigs array length mismatches
    function setConversionConfigs(
        address tokenAddressIn,
        address[] calldata tokenAddressesOut,
        ConversionConfig[] calldata conversionConfigs
    ) external {
        uint256 tokenOutArrayLength = tokenAddressesOut.length;
        if (tokenOutArrayLength != conversionConfigs.length) revert InputLengthMisMatch();

        for (uint256 i; i < tokenOutArrayLength; ) {
            setConversionConfig(tokenAddressIn, tokenAddressesOut[i], conversionConfigs[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Converts exact amount of tokenAddressIn for tokenAddressOut if there is enough tokens held by the contract
    /// @dev Method does not support deflationary tokens transfer
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount transferred to destination
    /// @return actualAmountOut Actual amount transferred to user
    /// @custom:event Emits ConvertedExactTokens event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when to address is zero
    /// @custom:error InvalidToAddress error is thrown when address(to) is same as tokenAddressIn or tokenAddressOut
    /// @custom:error AmountOutLowerThanMinRequired error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    /// @custom:error AmountInMismatched error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    function convertExactTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    )
        external
        validConversionParameters(to, tokenAddressIn, tokenAddressOut)
        nonReentrant
        returns (uint256 actualAmountIn, uint256 actualAmountOut)
    {
        (actualAmountIn, actualAmountOut) = _convertExactTokens(
            amountInMantissa,
            amountOutMinMantissa,
            tokenAddressIn,
            tokenAddressOut,
            to
        );

        if (actualAmountIn != amountInMantissa) {
            revert AmountInMismatched();
        }

        _postConversionHook(tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);
        emit ConvertedExactTokens(msg.sender, to, tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);
    }

    /// @notice Converts tokens for tokenAddressIn for exact amount of tokenAddressOut if there is enough tokens held by the contract,
    /// otherwise the amount is adjusted
    /// @dev Method does not support deflationary tokens transfer
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount transferred to destination
    /// @return actualAmountOut Actual amount transferred to user
    /// @custom:event Emits ConvertedForExactTokens event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when to address is zero
    /// @custom:error InvalidToAddress error is thrown when address(to) is same as tokenAddressIn or tokenAddressOut
    /// @custom:error AmountInHigherThanMax error is thrown when amount of tokenAddressIn is higher than amountInMaxMantissa
    /// @custom:error AmountOutMismatched error is thrown when actualAmountOut is does not match amountOutMantissa
    function convertForExactTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    )
        external
        validConversionParameters(to, tokenAddressIn, tokenAddressOut)
        nonReentrant
        returns (uint256 actualAmountIn, uint256 actualAmountOut)
    {
        (actualAmountIn, actualAmountOut) = _convertForExactTokens(
            amountInMaxMantissa,
            amountOutMantissa,
            tokenAddressIn,
            tokenAddressOut,
            to
        );

        if (actualAmountOut != amountOutMantissa) {
            revert AmountOutMismatched();
        }

        _postConversionHook(tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);
        emit ConvertedForExactTokens(msg.sender, to, tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);
    }

    /// @notice Converts exact amount of tokenAddressIn for tokenAddressOut if there is enough tokens held by the contract
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount transferred to destination
    /// @return actualAmountOut Actual amount transferred to user
    /// @custom:event Emits ConvertedExactTokensSupportingFeeOnTransferTokens event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when to address is zero
    /// @custom:error InvalidToAddress error is thrown when address(to) is same as tokenAddressIn or tokenAddressOut
    /// @custom:error AmountOutLowerThanMinRequired error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    function convertExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    )
        external
        validConversionParameters(to, tokenAddressIn, tokenAddressOut)
        nonReentrant
        returns (uint256 actualAmountIn, uint256 actualAmountOut)
    {
        (actualAmountIn, actualAmountOut) = _convertExactTokens(
            amountInMantissa,
            amountOutMinMantissa,
            tokenAddressIn,
            tokenAddressOut,
            to
        );

        _postConversionHook(tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);
        emit ConvertedExactTokensSupportingFeeOnTransferTokens(
            msg.sender,
            to,
            tokenAddressIn,
            tokenAddressOut,
            actualAmountIn,
            actualAmountOut
        );
    }

    /// @notice Converts tokens for tokenAddressIn for amount of tokenAddressOut calculated on the basis of amount of
    /// tokenAddressIn received by the contract, if there is enough tokens held by the contract, otherwise the amount is adjusted.
    /// The user will be responsible for bearing any fees associated with token transfers, whether pulling in or pushing out tokens
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount transferred to destination
    /// @return actualAmountOut Actual amount transferred to user
    /// @custom:event Emits ConvertedForExactTokensSupportingFeeOnTransferTokens event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when to address is zero
    /// @custom:error InvalidToAddress error is thrown when address(to) is same as tokenAddressIn or tokenAddressOut
    /// @custom:error AmountInHigherThanMax error is thrown when amount of tokenAddressIn is higher than amountInMaxMantissa
    function convertForExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    )
        external
        validConversionParameters(to, tokenAddressIn, tokenAddressOut)
        nonReentrant
        returns (uint256 actualAmountIn, uint256 actualAmountOut)
    {
        (actualAmountIn, actualAmountOut) = _convertForExactTokensSupportingFeeOnTransferTokens(
            amountInMaxMantissa,
            amountOutMantissa,
            tokenAddressIn,
            tokenAddressOut,
            to
        );

        _postConversionHook(tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);
        emit ConvertedForExactTokensSupportingFeeOnTransferTokens(
            msg.sender,
            to,
            tokenAddressIn,
            tokenAddressOut,
            actualAmountIn,
            actualAmountOut
        );
    }

    /// @notice To sweep ERC20 tokens and transfer them to user(to address)
    /// @param tokenAddress The address of the ERC-20 token to sweep
    /// @param to The address to which tokens will be transferred
    /// @param amount The amount to transfer
    /// @custom:event Emits SweepToken event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when tokenAddress/to address is zero
    /// @custom:access Only Governance
    function sweepToken(
        address tokenAddress,
        address to,
        uint256 amount
    ) external onlyOwner nonReentrant {
        ensureNonzeroAddress(tokenAddress);
        ensureNonzeroAddress(to);
        ensureNonzeroValue(amount);

        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        preSweepToken(tokenAddress, amount);
        token.safeTransfer(to, amount);

        emit SweepToken(tokenAddress, to, amount);
    }

    /// @notice To get the amount of tokenAddressOut tokens sender could receive on providing amountInMantissa tokens of tokenAddressIn.
    /// This function does not account for potential token transfer fees(in case of deflationary tokens)
    /// @notice The amountInMantissa might be adjusted if amountOutMantissa is greater than the balance of the contract for tokenAddressOut
    /// @dev This function retrieves values without altering token prices
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @return amountConvertedMantissa Amount of tokenAddressIn should be transferred after conversion
    /// @return amountOutMantissa Amount of the tokenAddressOut sender should receive after conversion
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when conversion is disabled or config does not exist for given pair
    /// @custom:error ConversionEnabledOnlyForPrivateConversions is thrown when conversion is only enabled for private conversion
    function getAmountOut(
        uint256 amountInMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) external view returns (uint256 amountConvertedMantissa, uint256 amountOutMantissa) {
        if (
            conversionConfigurations[tokenAddressIn][tokenAddressOut].conversionAccess ==
            ConversionAccessibility.ONLY_FOR_CONVERTERS
        ) {
            revert ConversionEnabledOnlyForPrivateConversions();
        }

        amountConvertedMantissa = amountInMantissa;
        uint256 tokenInToOutConversion;
        (amountOutMantissa, tokenInToOutConversion) = _getAmountOut(amountInMantissa, tokenAddressIn, tokenAddressOut);

        uint256 maxTokenOutReserve = balanceOf(tokenAddressOut);

        /// If contract has less liquidity for tokenAddressOut than amountOutMantissa
        if (maxTokenOutReserve < amountOutMantissa) {
            amountConvertedMantissa =
                ((maxTokenOutReserve * EXP_SCALE) + tokenInToOutConversion - 1) /
                tokenInToOutConversion; //round-up
            amountOutMantissa = maxTokenOutReserve;
        }
    }

    /// @notice To get the amount of tokenAddressIn tokens sender would send on receiving amountOutMantissa tokens of tokenAddressOut.
    /// This function does not account for potential token transfer fees(in case of deflationary tokens)
    /// @dev This function retrieves values without altering token prices
    /// @param amountOutMantissa Amount of tokenAddressOut user wants to receive
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @return amountConvertedMantissa Amount of tokenAddressOut should be transferred after conversion
    /// @return amountInMantissa Amount of the tokenAddressIn sender would send to contract before conversion
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when conversion is disabled or config does not exist for given pair
    /// @custom:error ConversionEnabledOnlyForPrivateConversions is thrown when conversion is only enabled for private conversion
    function getAmountIn(
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) external view returns (uint256 amountConvertedMantissa, uint256 amountInMantissa) {
        if (
            conversionConfigurations[tokenAddressIn][tokenAddressOut].conversionAccess ==
            ConversionAccessibility.ONLY_FOR_CONVERTERS
        ) {
            revert ConversionEnabledOnlyForPrivateConversions();
        }

        uint256 maxTokenOutReserve = balanceOf(tokenAddressOut);

        /// If contract has less liquidity for tokenAddressOut than amountOutMantissa
        if (maxTokenOutReserve < amountOutMantissa) {
            amountOutMantissa = maxTokenOutReserve;
        }

        amountConvertedMantissa = amountOutMantissa;
        (amountInMantissa, ) = _getAmountIn(amountOutMantissa, tokenAddressIn, tokenAddressOut);
    }

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
    ) public returns (uint256 amountConvertedMantissa, uint256 amountOutMantissa) {
        priceOracle.updateAssetPrice(tokenAddressIn);
        priceOracle.updateAssetPrice(tokenAddressOut);

        (amountOutMantissa, ) = _getAmountOut(amountInMantissa, tokenAddressIn, tokenAddressOut);
        amountConvertedMantissa = amountInMantissa;
    }

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
    ) public returns (uint256 amountConvertedMantissa, uint256 amountInMantissa) {
        priceOracle.updateAssetPrice(tokenAddressIn);
        priceOracle.updateAssetPrice(tokenAddressOut);

        (amountInMantissa, ) = _getAmountIn(amountOutMantissa, tokenAddressIn, tokenAddressOut);
        amountConvertedMantissa = amountOutMantissa;
    }

    /// @notice This method updated the states of this contract after getting funds from PSR
    /// after settling the amount(if any) through privateConversion between converters
    /// @dev This function is called by protocolShareReserve
    /// @dev call _updateAssetsState to update the states related to the comptroller and asset transfer to the specific converter then
    /// it calls the _privateConversion which will convert the asset into destination's base asset and transfer it to destination address
    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address
    function updateAssetsState(address comptroller, address asset) public nonReentrant {
        uint256 balanceDiff = _updateAssetsState(comptroller, asset);
        if (balanceDiff > 0) {
            _privateConversion(comptroller, asset, balanceDiff);
        }
    }

    /// @notice Set the configuration for new or existing conversion pair
    /// @param tokenAddressIn Address of tokenIn
    /// @param tokenAddressOut Address of tokenOut
    /// @param conversionConfig ConversionConfig config details to update
    /// @custom:event Emits ConversionConfigUpdated event on success
    /// @custom:error Unauthorized error is thrown when the call is not authorized by AccessControlManager
    /// @custom:error ZeroAddressNotAllowed is thrown when pool registry address is zero
    /// @custom:error NonZeroIncentiveForPrivateConversion is thrown when incentive is non zero for private conversion
    /// @custom:access Controlled by AccessControlManager
    function setConversionConfig(
        address tokenAddressIn,
        address tokenAddressOut,
        ConversionConfig calldata conversionConfig
    ) public {
        _checkAccessAllowed("setConversionConfig(address,address,ConversionConfig)");
        ensureNonzeroAddress(tokenAddressIn);
        ensureNonzeroAddress(tokenAddressOut);

        if (conversionConfig.incentive > MAX_INCENTIVE) {
            revert IncentiveTooHigh(conversionConfig.incentive, MAX_INCENTIVE);
        }

        if (
            (tokenAddressIn == tokenAddressOut) ||
            (tokenAddressIn != _getDestinationBaseAsset()) ||
            conversionConfigurations[tokenAddressOut][tokenAddressIn].conversionAccess != ConversionAccessibility.NONE
        ) {
            revert InvalidTokenConfigAddresses();
        }

        if (
            (conversionConfig.conversionAccess == ConversionAccessibility.ONLY_FOR_CONVERTERS) &&
            conversionConfig.incentive != 0
        ) {
            revert NonZeroIncentiveForPrivateConversion();
        }

        if (
            ((conversionConfig.conversionAccess == ConversionAccessibility.ONLY_FOR_CONVERTERS) ||
                (conversionConfig.conversionAccess == ConversionAccessibility.ALL)) &&
            (address(converterNetwork) == address(0))
        ) {
            revert InvalidConverterNetwork();
        }

        ConversionConfig storage configuration = conversionConfigurations[tokenAddressIn][tokenAddressOut];

        emit ConversionConfigUpdated(
            tokenAddressIn,
            tokenAddressOut,
            configuration.incentive,
            conversionConfig.incentive,
            configuration.conversionAccess,
            conversionConfig.conversionAccess
        );

        if (conversionConfig.conversionAccess == ConversionAccessibility.NONE) {
            delete conversionConfigurations[tokenAddressIn][tokenAddressOut];
        } else {
            configuration.incentive = conversionConfig.incentive;
            configuration.conversionAccess = conversionConfig.conversionAccess;
        }
    }

    /// @notice Get the balance for specific token
    /// @param token Address of the token
    /// @return tokenBalance Balance of the token the contract has
    function balanceOf(address token) public view virtual returns (uint256 tokenBalance);

    /// @dev Operations to perform before sweeping tokens
    /// @param token Address of the token
    /// @param amount Amount transferred to address(to)
    function preSweepToken(address token, uint256 amount) internal virtual {}

    /// @dev Converts exact amount of tokenAddressIn for tokenAddressOut
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount of tokenAddressIn transferred
    /// @return amountOutMantissa Actual amount of tokenAddressOut transferred
    /// @custom:error AmountOutLowerThanMinRequired error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    function _convertExactTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) internal returns (uint256 actualAmountIn, uint256 amountOutMantissa) {
        _checkPrivateConversion(tokenAddressIn, tokenAddressOut);
        actualAmountIn = _doTransferIn(tokenAddressIn, amountInMantissa);

        (, amountOutMantissa) = getUpdatedAmountOut(actualAmountIn, tokenAddressIn, tokenAddressOut);

        if (amountOutMantissa < amountOutMinMantissa) {
            revert AmountOutLowerThanMinRequired(amountOutMantissa, amountOutMinMantissa);
        }

        _doTransferOut(tokenAddressOut, to, amountOutMantissa);
    }

    /// @dev Converts tokens for tokenAddressIn for exact amount of tokenAddressOut used for non deflationry tokens
    /// it is called by convertForExactTokens function
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount of tokenAddressIn transferred
    /// @return actualAmountOut Actual amount of tokenAddressOut transferred
    /// @custom:error DeflationaryTokenNotSupported is thrown if tokenAddressIn is deflationary token
    /// @custom:error AmountInHigherThanMax error is thrown when amount of tokenAddressIn is higher than amountInMaxMantissa
    function _convertForExactTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) internal returns (uint256 actualAmountIn, uint256 actualAmountOut) {
        _checkPrivateConversion(tokenAddressIn, tokenAddressOut);
        (, uint256 amountInMantissa) = getUpdatedAmountIn(amountOutMantissa, tokenAddressIn, tokenAddressOut);

        actualAmountIn = _doTransferIn(tokenAddressIn, amountInMantissa);

        if (actualAmountIn != amountInMantissa) {
            revert DeflationaryTokenNotSupported();
        }

        if (actualAmountIn > amountInMaxMantissa) {
            revert AmountInHigherThanMax(amountInMantissa, amountInMaxMantissa);
        }

        _doTransferOut(tokenAddressOut, to, amountOutMantissa);
        actualAmountOut = amountOutMantissa;
    }

    /// @dev Converts tokens for tokenAddressIn for the amount of tokenAddressOut used for deflationary tokens
    /// it is called by convertForExactTokensSupportingFeeOnTransferTokens function
    /// @notice Advising users to input a smaller amountOutMantissa to avoid potential transaction revert
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount of tokenAddressIn transferred
    /// @return actualAmountOut Actual amount of tokenAddressOut transferred
    /// @custom:error AmountInHigherThanMax error is thrown when amount of tokenAddressIn is higher than amountInMaxMantissa
    function _convertForExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) internal returns (uint256 actualAmountIn, uint256 actualAmountOut) {
        _checkPrivateConversion(tokenAddressIn, tokenAddressOut);
        (, uint256 amountInMantissa) = getUpdatedAmountIn(amountOutMantissa, tokenAddressIn, tokenAddressOut);

        if (amountInMantissa > amountInMaxMantissa) {
            revert AmountInHigherThanMax(amountInMantissa, amountInMaxMantissa);
        }

        actualAmountIn = _doTransferIn(tokenAddressIn, amountInMantissa);

        (, actualAmountOut) = getUpdatedAmountOut(actualAmountIn, tokenAddressIn, tokenAddressOut);

        _doTransferOut(tokenAddressOut, to, actualAmountOut);
    }

    /// @dev return actualAmountOut from reserves for tokenAddressOut
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @param amountConvertedMantissa Amount of tokenAddressOut supposed to get transferred
    /// @custom:error InsufficientPoolLiquidity If contract has less liquidity for tokenAddressOut than amountOutMantissa
    function _doTransferOut(
        address tokenAddressOut,
        address to,
        uint256 amountConvertedMantissa
    ) internal {
        uint256 maxTokenOutReserve = balanceOf(tokenAddressOut);

        /// If contract has less liquidity for tokenAddressOut than amountOutMantissa
        if (maxTokenOutReserve < amountConvertedMantissa) {
            revert InsufficientPoolLiquidity();
        }

        _preTransferHook(tokenAddressOut, amountConvertedMantissa);

        IERC20Upgradeable tokenOut = IERC20Upgradeable(tokenAddressOut);
        tokenOut.safeTransfer(to, amountConvertedMantissa);
    }

    /// @notice Transfer tokenAddressIn from user to destination
    /// @param tokenAddressIn Address of the token to convert
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @return actualAmountIn Actual amount transferred to destination
    function _doTransferIn(address tokenAddressIn, uint256 amountInMantissa) internal returns (uint256 actualAmountIn) {
        IERC20Upgradeable tokenIn = IERC20Upgradeable(tokenAddressIn);
        uint256 balanceBeforeDestination = tokenIn.balanceOf(destinationAddress);
        tokenIn.safeTransferFrom(msg.sender, destinationAddress, amountInMantissa);
        uint256 balanceAfterDestination = tokenIn.balanceOf(destinationAddress);
        actualAmountIn = balanceAfterDestination - balanceBeforeDestination;
    }

    /// @dev Sets a new price oracle
    /// @param priceOracle_ Address of the new price oracle to set
    /// @custom:event Emits PriceOracleUpdated event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when price oracle address is zero
    function _setPriceOracle(ResilientOracle priceOracle_) internal {
        ensureNonzeroAddress(address(priceOracle_));
        emit PriceOracleUpdated(priceOracle, priceOracle_);
        priceOracle = priceOracle_;
    }

    /// @dev Sets a new destination address
    /// @param destinationAddress_ The new destination address to be set
    /// @custom:event Emits DestinationAddressUpdated event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when destination address is zero
    function _setDestination(address destinationAddress_) internal {
        ensureNonzeroAddress(destinationAddress_);
        emit DestinationAddressUpdated(destinationAddress, destinationAddress_);
        destinationAddress = destinationAddress_;
    }

    /// @notice Sets a converter network contract address
    /// @param converterNetwork_ The converterNetwork address to be set
    /// @custom:event Emits ConverterNetworkAddressUpdated event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when address is zero
    function _setConverterNetwork(IConverterNetwork converterNetwork_) internal {
        ensureNonzeroAddress(address(converterNetwork_));
        emit ConverterNetworkAddressUpdated(address(converterNetwork), address(converterNetwork_));
        converterNetwork = converterNetwork_;
    }

    /// @notice Min amount to convert setter
    /// @param minAmountToConvert_ Min amount to convert
    /// @custom:event MinAmountToConvertUpdated is emitted in success
    /// @custom:error ZeroValueNotAllowed is thrown if the provided value is 0
    function _setMinAmountToConvert(uint256 minAmountToConvert_) internal {
        ensureNonzeroValue(minAmountToConvert_);
        emit MinAmountToConvertUpdated(minAmountToConvert, minAmountToConvert_);
        minAmountToConvert = minAmountToConvert_;
    }

    /// @dev Hook to perform after converting tokens
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param amountIn Amount of tokenIn converted
    /// @param amountOut Amount of tokenOut converted
    function _postConversionHook(
        address tokenAddressIn,
        address tokenAddressOut,
        uint256 amountIn,
        uint256 amountOut
    ) internal virtual {}

    /// @param accessControlManager_ Access control manager contract address
    /// @param priceOracle_ Resilient oracle address
    /// @param destinationAddress_  Address at all incoming tokens will transferred to
    /// @param minAmountToConvert_ minimum amount to convert
    function __AbstractTokenConverter_init(
        address accessControlManager_,
        ResilientOracle priceOracle_,
        address destinationAddress_,
        uint256 minAmountToConvert_
    ) internal onlyInitializing {
        __AccessControlled_init(accessControlManager_);
        __ReentrancyGuard_init();
        __AbstractTokenConverter_init_unchained(priceOracle_, destinationAddress_, minAmountToConvert_);
    }

    /// @param priceOracle_ Resilient oracle address
    /// @param destinationAddress_  Address at all incoming tokens will transferred to
    /// @param minAmountToConvert_ minimum amount to convert
    function __AbstractTokenConverter_init_unchained(
        ResilientOracle priceOracle_,
        address destinationAddress_,
        uint256 minAmountToConvert_
    ) internal onlyInitializing {
        _setPriceOracle(priceOracle_);
        _setDestination(destinationAddress_);
        _setMinAmountToConvert(minAmountToConvert_);
        conversionPaused = false;
    }

    /// @dev _updateAssetsState hook to update the states of reserves transferred for the specific comptroller
    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address
    /// @return Amount of asset, for _privateConversion
    function _updateAssetsState(address comptroller, address asset) internal virtual returns (uint256) {}

    /// @dev This method is used to convert asset into base asset by converting them with other converters which supports the pair and transfer the funds to
    /// destination contract as destination's base asset
    /// @param comptroller Comptroller address (pool)
    /// @param tokenAddressOut Address of the token transferred to converter, and through _privateConversion it will be converted into base asset
    /// @param amountToConvert Amount of the tokenAddressOut transferred to converter
    function _privateConversion(
        address comptroller,
        address tokenAddressOut,
        uint256 amountToConvert
    ) internal {
        address tokenAddressIn = _getDestinationBaseAsset();
        address _destinationAddress = destinationAddress;
        uint256 convertedTokenInBalance;
        if (address(converterNetwork) != address(0)) {
            (address[] memory converterAddresses, uint256[] memory converterBalances) = converterNetwork
            .findTokenConvertersForConverters(tokenAddressOut, tokenAddressIn);
            uint256 convertersLength = converterAddresses.length;
            for (uint256 i; i < convertersLength; ) {
                if (converterBalances[i] == 0) break;
                (, uint256 amountIn) = IAbstractTokenConverter(converterAddresses[i]).getUpdatedAmountIn(
                    converterBalances[i],
                    tokenAddressOut,
                    tokenAddressIn
                );
                if (amountIn > amountToConvert) {
                    amountIn = amountToConvert;
                }

                if (!_validateMinAmountToConvert(amountIn, tokenAddressOut)) {
                    break;
                }

                uint256 balanceBefore = IERC20Upgradeable(tokenAddressIn).balanceOf(_destinationAddress);

                IERC20Upgradeable(tokenAddressOut).approve(converterAddresses[i], amountIn);
                IAbstractTokenConverter(converterAddresses[i]).convertExactTokens(
                    amountIn,
                    0,
                    tokenAddressOut,
                    tokenAddressIn,
                    _destinationAddress
                );

                uint256 balanceAfter = IERC20Upgradeable(tokenAddressIn).balanceOf(_destinationAddress);
                amountToConvert -= amountIn;
                convertedTokenInBalance += (balanceAfter - balanceBefore);

                if (amountToConvert == 0) break;
                unchecked {
                    ++i;
                }
            }
        }

        _postPrivateConversionHook(
            comptroller,
            tokenAddressIn,
            convertedTokenInBalance,
            tokenAddressOut,
            amountToConvert
        );
    }

    /// @dev This hook is used to update states for the converter after the privateConversion
    /// @param comptroller Comptroller address (pool)
    /// @param tokenAddressIn Address of the destination's base asset
    /// @param convertedTokenInBalance Amount of the base asset received after the conversion
    /// @param tokenAddressOut Address of the asset transferred to other converter in exchange of base asset
    /// @param convertedTokenOutBalance Amount of tokenAddressOut transferred from this converter
    function _postPrivateConversionHook(
        address comptroller,
        address tokenAddressIn,
        uint256 convertedTokenInBalance,
        address tokenAddressOut,
        uint256 convertedTokenOutBalance
    ) internal virtual {}

    /// @notice This hook is used to update the state for asset reserves before transferring tokenOut to user
    /// @param tokenOutAddress Address of the asset to be transferred to the user
    /// @param amountOut Amount of tokenAddressOut transferred from this converter
    function _preTransferHook(address tokenOutAddress, uint256 amountOut) internal virtual {}

    /// @dev Checks if amount to convert is greater than minimum amount to convert or not
    /// @param amountIn The amount to convert
    /// @param tokenAddress Address of the token
    /// @return isValid true if amount to convert is greater than minimum amount to convert
    function _validateMinAmountToConvert(uint256 amountIn, address tokenAddress) internal returns (bool isValid) {
        priceOracle.updateAssetPrice(tokenAddress);
        uint256 amountInInUsd = (priceOracle.getPrice(tokenAddress) * amountIn) / EXP_SCALE;

        if (amountInInUsd >= minAmountToConvert) {
            isValid = true;
        }
    }

    /// @notice To get the amount of tokenAddressOut tokens sender could receive on providing amountInMantissa tokens of tokenAddressIn
    /// @dev This function retrieves values without altering token prices.
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @return amountOutMantissa Amount of the tokenAddressOut sender should receive after conversion
    /// @return tokenInToOutConversion Ratio of tokenIn price and incentive for conversion with tokenOut price
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when conversion is disabled or config does not exist for given pair
    function _getAmountOut(
        uint256 amountInMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) internal view returns (uint256 amountOutMantissa, uint256 tokenInToOutConversion) {
        if (amountInMantissa == 0) {
            revert InsufficientInputAmount();
        }

        ConversionConfig memory configuration = conversionConfigurations[tokenAddressIn][tokenAddressOut];

        if (configuration.conversionAccess == ConversionAccessibility.NONE) {
            revert ConversionConfigNotEnabled();
        }

        uint256 tokenInUnderlyingPrice = priceOracle.getPrice(tokenAddressIn);
        uint256 tokenOutUnderlyingPrice = priceOracle.getPrice(tokenAddressOut);

        uint256 incentive = configuration.incentive;
        if (address(converterNetwork) != address(0) && (converterNetwork.isTokenConverter(msg.sender))) {
            incentive = 0;
        }

        /// conversion rate after considering incentive(conversionWithIncentive)
        uint256 conversionWithIncentive = MANTISSA_ONE + incentive;

        /// amount of tokenAddressOut after including incentive as amountOutMantissa will be greater than actual as it gets
        /// multiplied by conversionWithIncentive which will be >= 1
        amountOutMantissa =
            (amountInMantissa * tokenInUnderlyingPrice * conversionWithIncentive) /
            (tokenOutUnderlyingPrice * EXP_SCALE);

        tokenInToOutConversion = (tokenInUnderlyingPrice * conversionWithIncentive) / tokenOutUnderlyingPrice;
    }

    /// @dev To get the amount of tokenAddressIn tokens sender would send on receiving amountOutMantissa tokens of tokenAddressOut
    /// @dev This function retrieves values without altering token prices.
    /// @dev For user conversions, the function returns an amountInMantissa that is rounded up, ensuring that the equivalent amountInMantissa
    /// is obtained from users for corresponding amountOutMantissa, preventing any losses to the protocol. However, no rounding up is required for private conversions
    /// @param amountOutMantissa Amount of tokenAddressOut user wants to receive
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @return amountInMantissa Amount of the tokenAddressIn sender would send to contract before conversion
    /// @return tokenInToOutConversion Ratio of tokenIn price and incentive for conversion with tokenOut price
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when conversion is disabled or config does not exist for given pair
    function _getAmountIn(
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) internal view returns (uint256 amountInMantissa, uint256 tokenInToOutConversion) {
        if (amountOutMantissa == 0) {
            revert InsufficientOutputAmount();
        }

        ConversionConfig memory configuration = conversionConfigurations[tokenAddressIn][tokenAddressOut];

        if (configuration.conversionAccess == ConversionAccessibility.NONE) {
            revert ConversionConfigNotEnabled();
        }

        uint256 tokenInUnderlyingPrice = priceOracle.getPrice(tokenAddressIn);
        uint256 tokenOutUnderlyingPrice = priceOracle.getPrice(tokenAddressOut);

        uint256 incentive = configuration.incentive;

        bool isPrivateConversion = address(converterNetwork) != address(0) &&
            converterNetwork.isTokenConverter(msg.sender);
        if (isPrivateConversion) {
            incentive = 0;
        }

        /// conversion rate after considering incentive(conversionWithIncentive)
        uint256 conversionWithIncentive = MANTISSA_ONE + incentive;

        /// amount of tokenAddressIn after considering incentive(i.e. amountInMantissa will be less than actual amountInMantissa if incentive > 0)
        if (isPrivateConversion) {
            amountInMantissa =
                (amountOutMantissa * tokenOutUnderlyingPrice * EXP_SCALE) /
                (tokenInUnderlyingPrice * conversionWithIncentive);
        } else {
            amountInMantissa =
                ((amountOutMantissa * tokenOutUnderlyingPrice * EXP_SCALE) +
                    (tokenInUnderlyingPrice * conversionWithIncentive) -
                    1) /
                (tokenInUnderlyingPrice * conversionWithIncentive); //round-up
        }

        tokenInToOutConversion = (tokenInUnderlyingPrice * conversionWithIncentive) / tokenOutUnderlyingPrice;
    }

    /// @dev Check if msg.sender is allowed to convert as per onlyForPrivateConversions flag
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @custom:error ConversionEnabledOnlyForPrivateConversions is thrown when conversion is only enabled for private conversion
    function _checkPrivateConversion(address tokenAddressIn, address tokenAddressOut) internal view {
        bool isConverter = (address(converterNetwork) != address(0)) && converterNetwork.isTokenConverter(msg.sender);
        if (
            (!(isConverter) &&
                (conversionConfigurations[tokenAddressIn][tokenAddressOut].conversionAccess ==
                    ConversionAccessibility.ONLY_FOR_CONVERTERS))
        ) {
            revert ConversionEnabledOnlyForPrivateConversions();
        }
    }

    /// @dev To check, is conversion paused
    /// @custom:error ConversionTokensPaused is thrown when token conversion is paused
    function _checkConversionPaused() internal view {
        if (conversionPaused) {
            revert ConversionTokensPaused();
        }
    }

    /// @dev Get base asset address of the destination contract
    /// @return Address of the base asset
    function _getDestinationBaseAsset() internal view virtual returns (address) {}
}
