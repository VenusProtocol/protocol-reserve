// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

import { MANTISSA_ONE, EXP_SCALE } from "../Utils/Constants.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "../Utils/Validators.sol";
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
 */
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
abstract contract AbstractTokenConverter is AccessControlledV8, IAbstractTokenConverter, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Maximum incentive could be
    uint256 public constant MAX_INCENTIVE = 0.5e18;

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
    address public converterNetwork;

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain.
    /// See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    uint256[46] private __gap;

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
    event PriceOracleUpdated(ResilientOracle indexed oldPriceOracle, ResilientOracle indexed priceOracle);

    /// @notice Emitted when destination address is updated
    event DestinationAddressUpdated(address indexed oldDestinationAddress, address indexed destinationAddress);

    /// @notice Emitted when converterNetwork address is updated
    event ConverterNetworkAddressUpdated(address indexed oldconverterNetwork, address indexed converterNetwork);

    /// @notice Emitted when exact amount of tokens are converted for tokens
    event ConvertedExactTokens(uint256 amountIn, uint256 amountOut);

    /// @notice Emitted when tokens are converted for exact amount of tokens
    event ConvertedForExactTokens(uint256 amountIn, uint256 amountOut);

    /// @notice Emitted when exact amount of tokens are converted for tokens, for deflationary tokens
    event ConvertedExactTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOut);

    /// @notice Emitted when tokens are converted for exact amount of tokens, for deflationary tokens
    event ConvertedForExactTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOut);

    /// @notice Emitted when conversion is paused
    event ConversionPaused(address indexed sender);

    /// @notice Emitted when conversion is unpaused
    event ConversionResumed(address indexed sender);

    /// @notice Event emitted when tokens are swept
    event SweepToken(address indexed token, address indexed to, uint256 amount);

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

    error InsufficientPoolLiquidity();

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
    function setConverterNetwork(address converterNetwork_) external onlyOwner {
        _setConverterNetwork(converterNetwork_);
    }

    /// @notice Set the configuration for new or existing conversion pair
    /// @param tokenAddressIn Address of tokenIn
    /// @param tokenAddressOut Address of tokenOut
    /// @param conversionConfig ConversionConfig config details to update
    /// @custom:event Emits ConversionConfigUpdated event on success
    /// @custom:error Unauthorized error is thrown when the call is not authorized by AccessControlManager
    /// @custom:error ZeroAddressNotAllowed is thrown when pool registry address is zero
    /// @custom:access Controlled by AccessControlManager
    function setConversionConfig(
        address tokenAddressIn,
        address tokenAddressOut,
        ConversionConfig calldata conversionConfig
    ) external {
        _checkAccessAllowed("setConversionConfig(address,address,ConversionConfig)");
        ensureNonzeroAddress(tokenAddressIn);
        ensureNonzeroAddress(tokenAddressOut);

        if (conversionConfig.incentive > MAX_INCENTIVE) {
            revert IncentiveTooHigh(conversionConfig.incentive, MAX_INCENTIVE);
        }

        if (
            (tokenAddressIn == tokenAddressOut) ||
            (tokenAddressIn != _getDestinationBaseAsset()) ||
            conversionConfigurations[tokenAddressOut][tokenAddressIn].enabled
        ) {
            revert InvalidTokenConfigAddresses();
        }

        ConversionConfig storage configuration = conversionConfigurations[tokenAddressIn][tokenAddressOut];

        emit ConversionConfigUpdated(
            tokenAddressIn,
            tokenAddressOut,
            configuration.incentive,
            conversionConfig.incentive,
            configuration.enabled,
            conversionConfig.enabled
        );

        configuration.incentive = conversionConfig.incentive;
        configuration.enabled = conversionConfig.enabled;
        configuration.onlyForPrivateConversions = conversionConfig.onlyForPrivateConversions;
    }

    /// @notice Converts exact amount of tokenAddressIn for tokenAddressOut if there is enough tokens held by the contract
    /// @dev Method does not support deflationary tokens transfer
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @custom:event Emits ConvertedExactTokens event on success
    /// @custom:error InvalidToAddress error is thrown when address(to) is same as tokenAddressIn or tokenAddressOut
    /// @custom:error AmountOutLowerThanMinRequired error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    /// @custom:error AmountInMismatched error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    function convertExactTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external nonReentrant returns (uint256 actualAmountIn, uint256 actualAmountOut) {
        _checkConversionPaused();
        if (to == tokenAddressIn || to == tokenAddressOut) {
            revert InvalidToAddress();
        }

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

        postConversionHook(tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);

        emit ConvertedExactTokens(actualAmountIn, actualAmountOut);
    }

    /// @notice Converts tokens for tokenAddressIn for exact amount of tokenAddressOut if there is enough tokens held by the contract,
    ///         otherwise the amount is adjusted
    /// @dev Method does not support deflationary tokens transfer
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @custom:event Emits ConvertedForExactTokens event on success
    /// @custom:error InvalidToAddress error is thrown when address(to) is same as tokenAddressIn or tokenAddressOut
    /// @custom:error AmountInHigherThanMax error is thrown when amount of tokenAddressIn is higher than amountInMaxMantissa
    /// @custom:error AmountOutMismatched error is thrown when actualAmountOut is does not match amountOutMantissa
    function convertForExactTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external nonReentrant returns (uint256 actualAmountIn, uint256 actualAmountOut) {
        _checkConversionPaused();
        if (to == tokenAddressIn || to == tokenAddressOut) {
            revert InvalidToAddress();
        }

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

        postConversionHook(tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);
        emit ConvertedForExactTokens(actualAmountIn, actualAmountOut);
    }

    /// @notice Converts exact amount of tokenAddressIn for tokenAddressOut if there is enough tokens held by the contract
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @custom:event Emits ConvertedExactTokensSupportingFeeOnTransferTokens event on success
    /// @custom:error InvalidToAddress error is thrown when address(to) is same as tokenAddressIn or tokenAddressOut
    /// @custom:error AmountOutLowerThanMinRequired error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    function convertExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external nonReentrant returns (uint256 actualAmountIn, uint256 actualAmountOut) {
        _checkConversionPaused();
        if (to == tokenAddressIn || to == tokenAddressOut) {
            revert InvalidToAddress();
        }

        (actualAmountIn, actualAmountOut) = _convertExactTokens(
            amountInMantissa,
            amountOutMinMantissa,
            tokenAddressIn,
            tokenAddressOut,
            to
        );

        postConversionHook(tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);

        emit ConvertedExactTokensSupportingFeeOnTransferTokens(actualAmountIn, actualAmountOut);
    }

    /// @notice Converts tokens for tokenAddressIn for exact amount of tokenAddressOut if there is enough tokens held by the contract,
    ///         otherwise the amount is adjusted
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @custom:event Emits ConvertedForExactTokensSupportingFeeOnTransferTokens event on success
    /// @custom:error InvalidToAddress error is thrown when address(to) is same as tokenAddressIn or tokenAddressOut
    /// @custom:error AmountInHigherThanMax error is thrown when amount of tokenAddressIn is higher than amountInMaxMantissa
    function convertForExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external nonReentrant returns (uint256 actualAmountIn, uint256 actualAmountOut) {
        _checkConversionPaused();
        if (to == tokenAddressIn || to == tokenAddressOut) {
            revert InvalidToAddress();
        }

        (actualAmountIn, actualAmountOut) = _convertForExactTokens(
            amountInMaxMantissa,
            amountOutMantissa,
            tokenAddressIn,
            tokenAddressOut,
            to
        );

        postConversionHook(tokenAddressIn, tokenAddressOut, actualAmountIn, actualAmountOut);

        emit ConvertedForExactTokensSupportingFeeOnTransferTokens(actualAmountIn, actualAmountOut);
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
    ) external view returns (uint256 amountConvertedMantissa, uint256 amountOutMantissa) {
        if (!(conversionConfigurations[tokenAddressIn][tokenAddressOut].onlyForPrivateConversions)) {
            revert ConversionEnabledOnlyForPrivateConversions();
        }

        uint256 tokenInToOutConversion;
        (amountConvertedMantissa, amountOutMantissa, tokenInToOutConversion) = _getAmountOut(
            amountInMantissa,
            tokenAddressIn,
            tokenAddressOut
        );

        uint256 maxTokenOutReserve = balanceOf(tokenAddressOut);

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
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @return amountConvertedMantissa Amount of tokenAddressOut should be transferred after conversion
    /// @return amountInMantissa Amount of the tokenAddressIn sender would send to contract before conversion
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when conversion is disabled or config does not exist for given pair
    function getAmountIn(
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) external view returns (uint256 amountConvertedMantissa, uint256 amountInMantissa) {
        if (!(conversionConfigurations[tokenAddressIn][tokenAddressOut].onlyForPrivateConversions)) {
            revert ConversionEnabledOnlyForPrivateConversions();
        }

        uint256 tokenInToOutConversion;
        (amountConvertedMantissa, amountInMantissa, tokenInToOutConversion) = _getAmountIn(
            amountOutMantissa,
            tokenAddressIn,
            tokenAddressOut
        );
        uint256 maxTokenOutReserve = balanceOf(tokenAddressOut);

        /// If contract has less liquidity for tokenAddressOut than amountOutMantissa
        if (maxTokenOutReserve < amountOutMantissa) {
            amountInMantissa = ((maxTokenOutReserve * EXP_SCALE) + tokenInToOutConversion - 1) / tokenInToOutConversion; //round-up
            amountConvertedMantissa = maxTokenOutReserve;
        } else {
            amountInMantissa = ((amountOutMantissa * EXP_SCALE) + tokenInToOutConversion - 1) / tokenInToOutConversion; //round-up
            amountConvertedMantissa = amountOutMantissa;
        }
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
        (amountConvertedMantissa, amountOutMantissa, ) = _getAmountOut(
            amountInMantissa,
            tokenAddressIn,
            tokenAddressOut
        );
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

        (amountConvertedMantissa, amountInMantissa, ) = _getAmountIn(
            amountOutMantissa,
            tokenAddressIn,
            tokenAddressOut
        );
    }

    /// @dev call _updateAssetsState to update the states related to the comptroller and asset transfer to the specific converter then it
    /// it calls the _privateConversion which will convert the asset into destination's base asset and transfer it to destination address
    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address
    function updateAssetsState(address comptroller, address asset) public {
        uint256 balanceDiff = _updateAssetsState(comptroller, asset);
        if (balanceDiff > 0) {
            _privateConversion(comptroller, asset, balanceDiff);
        }
    }

    /// @notice Get the balance for specific token
    /// @param token Address of the token
    /// @return tokenBalance Balance of the token the contract has
    function balanceOf(address token) public view virtual returns (uint256 tokenBalance) {}

    /// @notice Operations to perform before sweeping tokens
    /// @param token Address of the token
    /// @param amount Amount transferred to address(to)
    function preSweepToken(address token, uint256 amount) internal virtual {}

    /// @notice Converts exact amount of tokenAddressIn for tokenAddressOut
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount of tokenAddressIn transferred
    /// @return actualAmountOut Actual amount of tokenAddressOut transferred
    /// @custom:error AmountOutLowerThanMinRequired error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    function _convertExactTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) internal returns (uint256 actualAmountIn, uint256 actualAmountOut) {
        _checkPrivateConversion(tokenAddressIn, tokenAddressOut);
        actualAmountIn = _doTransferIn(tokenAddressIn, amountInMantissa);

        (, uint256 amountOutMantissa) = getUpdatedAmountOut(actualAmountIn, tokenAddressIn, tokenAddressOut);

        actualAmountOut = _doTransferOut(tokenAddressOut, to, amountOutMantissa);

        if (actualAmountOut < amountOutMinMantissa) {
            revert AmountOutLowerThanMinRequired(amountOutMantissa, amountOutMinMantissa);
        }
    }

    /// @notice Converts tokens for tokenAddressIn for exact amount of tokenAddressOut
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount of tokenAddressIn transferred
    /// @return actualAmountOut Actual amount of tokenAddressOut transferred
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

        if (actualAmountIn > amountInMaxMantissa) {
            revert AmountInHigherThanMax(amountInMantissa, amountInMaxMantissa);
        }

        (, amountOutMantissa) = getUpdatedAmountOut(actualAmountIn, tokenAddressIn, tokenAddressOut);

        actualAmountOut = _doTransferOut(tokenAddressOut, to, amountOutMantissa);
    }

    /// @notice return actualAmountOut from reserves for tokenAddressOut
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param to Address of the tokenAddressOut receiver
    /// @param amountConvertedMantissa Amount of tokenAddressOut supposed to get transferred
    /// @return actualAmountOut Actual amount of tokenAddressOut transferred
    function _doTransferOut(
        address tokenAddressOut,
        address to,
        uint256 amountConvertedMantissa
    ) internal returns (uint256 actualAmountOut) {
        uint256 maxTokenOutReserve = balanceOf(tokenAddressOut);

        /// If contract has less liquity for tokenAddressOut than amountOutMantissa
        if (maxTokenOutReserve < amountConvertedMantissa) {
            revert InsufficientPoolLiquidity();
        }

        IERC20Upgradeable tokenOut = IERC20Upgradeable(tokenAddressOut);
        uint256 balanceBefore = tokenOut.balanceOf(address(this));
        tokenOut.safeTransfer(to, amountConvertedMantissa);
        uint256 balanceAfter = tokenOut.balanceOf(address(this));

        actualAmountOut = balanceBefore - balanceAfter;
    }

    function _doTransferIn(address tokenAddressIn, uint256 amountInMantissa) internal returns (uint256 actualAmountIn) {
        IERC20Upgradeable tokenIn = IERC20Upgradeable(tokenAddressIn);
        uint256 balanceBeforeDestination = tokenIn.balanceOf(destinationAddress);
        tokenIn.safeTransferFrom(msg.sender, destinationAddress, amountInMantissa);
        uint256 balanceAfterDestination = tokenIn.balanceOf(destinationAddress);
        actualAmountIn = balanceAfterDestination - balanceBeforeDestination;
    }

    /// @notice Sets a new price oracle
    /// @param priceOracle_ Address of the new price oracle to set
    /// @custom:event Emits PriceOracleUpdated event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when price oracle address is zero
    function _setPriceOracle(ResilientOracle priceOracle_) internal {
        ensureNonzeroAddress(address(priceOracle_));
        emit PriceOracleUpdated(priceOracle, priceOracle_);
        priceOracle = priceOracle_;
    }

    /// @notice Sets a new destination address
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
    function _setConverterNetwork(address converterNetwork_) internal {
        ensureNonzeroAddress(converterNetwork_);
        emit ConverterNetworkAddressUpdated(converterNetwork, converterNetwork_);
        converterNetwork = converterNetwork_;
    }

    /// @notice Hook to perform after converting tokens
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @param amountIn Amount of tokenIn converted
    /// @param amountOut Amount of tokenOut converted
    function postConversionHook(
        address tokenAddressIn,
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
    function __AbstractTokenConverter_init_unchained(ResilientOracle priceOracle_, address destinationAddress_)
        internal
        onlyInitializing
    {
        _setPriceOracle(priceOracle_);
        _setDestination(destinationAddress_);
        conversionPaused = false;
    }

    /// @dev _updateAssetsState hook to update the states of reserves transferred for the specific comptroller
    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address
    function _updateAssetsState(address comptroller, address asset) internal virtual returns (uint256) {}

    /// @dev This method is used to convert asset into base asset by converting them with other converters which supports the pair and transfer the funds to
    /// destination contract as destination's base asset
    /// @param comptroller Comptroller address (pool)
    /// @param tokenAddressOut Address of the token transferred to converter, and through _privateConversion it will be converted into base asset
    /// @param balanceDiff Amount of the tokenAddressOut transferred to converter
    function _privateConversion(
        address comptroller,
        address tokenAddressOut,
        uint256 balanceDiff
    ) internal {
        address tokenAddressIn = _getDestinationBaseAsset();
        (address[] memory converterAddresses, uint256[] memory converterBalances) = IConverterNetwork(converterNetwork)
        .findTokenConverter(tokenAddressOut, tokenAddressIn);
        uint256 convertedTokenOutBalance = balanceDiff;
        uint256 convertedTokenInBalance;
        uint256 convertersLength = converterAddresses.length;
        for (uint256 i; i < convertersLength; ) {
            uint256 amountOutMantissa = converterBalances[i];
            if (amountOutMantissa == 0) continue;
            (, uint256 amountIn) = IAbstractTokenConverter(converterAddresses[i]).getUpdatedAmountIn(
                amountOutMantissa,
                tokenAddressOut,
                tokenAddressIn
            );
            if (converterBalances[i] > convertedTokenOutBalance) {
                amountIn = convertedTokenOutBalance;
            }
            (, uint256 actualAmountOut) = IAbstractTokenConverter(converterAddresses[i]).convertExactTokens(
                amountIn,
                0,
                tokenAddressOut,
                tokenAddressIn,
                destinationAddress
            );
            convertedTokenOutBalance -= amountIn;
            convertedTokenInBalance += actualAmountOut;

            if (convertedTokenOutBalance == 0) break;

            unchecked {
                ++i;
            }
        }

        _postPrivateConversion(
            comptroller,
            tokenAddressIn,
            convertedTokenInBalance,
            tokenAddressOut,
            convertedTokenOutBalance
        );
    }

    /// @dev This hook is used to update states for the converter after the privateConversion
    /// @param comptroller Comptroller address (pool)
    /// @param tokenAddressIn Address of the destination's base asset
    /// @param convertedTokenInBalance Amount of the base asset received after the conversion
    /// @param tokenAddressOut Address of the asset transferred to other converter in exchange of base asset
    /// @param convertedTokenOutBalance Amount of tokenAddressOut transferred from this converter
    function _postPrivateConversion(
        address comptroller,
        address tokenAddressIn,
        uint256 convertedTokenInBalance,
        address tokenAddressOut,
        uint256 convertedTokenOutBalance
    ) internal virtual {}

    /// @notice To get the amount of tokenAddressOut tokens sender could receive on providing amountInMantissa tokens of tokenAddressIn
    /// @dev This function retrieves values without altering token prices.
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @return amountConvertedMantissa Amount of tokenAddressIn should be transferred after conversion
    /// @return amountOutMantissa Amount of the tokenAddressOut sender should receive after conversion
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when conversion is disabled or config does not exist for given pair
    function _getAmountOut(
        uint256 amountInMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    )
        internal
        view
        returns (
            uint256 amountConvertedMantissa,
            uint256 amountOutMantissa,
            uint256 tokenInToOutConversion
        )
    {
        if (amountInMantissa == 0) {
            revert InsufficientInputAmount();
        }

        ConversionConfig memory configuration = conversionConfigurations[tokenAddressIn][tokenAddressOut];

        if (!configuration.enabled) {
            revert ConversionConfigNotEnabled();
        }

        uint256 tokenInUnderlyingPrice = priceOracle.getPrice(tokenAddressIn);
        uint256 tokenOutUnderlyingPrice = priceOracle.getPrice(tokenAddressOut);

        uint256 incentive = configuration.incentive;
        if (IConverterNetwork(converterNetwork).isTokenConverter(msg.sender)) {
            incentive = 0;
        }

        /// amount of tokenAddressOut after including incentive
        uint256 conversionWithIncentive = MANTISSA_ONE + incentive;
        /// conversion rate after considering incentive(conversionWithIncentive)

        amountOutMantissa =
            (amountInMantissa * tokenInUnderlyingPrice * conversionWithIncentive) /
            (tokenOutUnderlyingPrice * EXP_SCALE);
        amountConvertedMantissa = amountInMantissa;

        tokenInToOutConversion = (tokenInUnderlyingPrice * conversionWithIncentive) / tokenOutUnderlyingPrice;
    }

    /// @notice To get the amount of tokenAddressIn tokens sender would send on receiving amountOutMantissa tokens of tokenAddressOut
    /// @dev This function retrieves values without altering token prices.
    /// @param amountOutMantissa Amount of tokenAddressOut user wants to receive
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    /// @return amountConvertedMantissa Amount of tokenAddressOut should be transferred after conversion
    /// @return amountInMantissa Amount of the tokenAddressIn sender would send to contract before conversion
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error ConversionConfigNotEnabled is thrown when conversion is disabled or config does not exist for given pair
    function _getAmountIn(
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    )
        internal
        view
        returns (
            uint256 amountConvertedMantissa,
            uint256 amountInMantissa,
            uint256 tokenInToOutConversion
        )
    {
        if (amountOutMantissa == 0) {
            revert InsufficientOutputAmount();
        }

        ConversionConfig memory configuration = conversionConfigurations[tokenAddressIn][tokenAddressOut];

        if (!configuration.enabled) {
            revert ConversionConfigNotEnabled();
        }

        uint256 tokenInUnderlyingPrice = priceOracle.getPrice(tokenAddressIn);
        uint256 tokenOutUnderlyingPrice = priceOracle.getPrice(tokenAddressOut);

        uint256 incentive = configuration.incentive;
        if (IConverterNetwork(converterNetwork).isTokenConverter(msg.sender)) {
            incentive = 0;
        }

        /// amount of tokenAddressOut after including incentive
        uint256 conversionWithIncentive = MANTISSA_ONE + incentive;
        /// conversion rate after considering incentive(conversionWithIncentive)
        tokenInToOutConversion = (tokenInUnderlyingPrice * conversionWithIncentive) / tokenOutUnderlyingPrice;

        amountInMantissa = ((amountOutMantissa * EXP_SCALE) + tokenInToOutConversion - 1) / tokenInToOutConversion; //round-up
        amountConvertedMantissa = amountOutMantissa;
    }

    /// @notice Check if msg.sender is allowed to convert as per onlyForPrivateConversions flag
    /// @param tokenAddressIn Address of the token to convert
    /// @param tokenAddressOut Address of the token to get after conversion
    function _checkPrivateConversion(address tokenAddressIn, address tokenAddressOut) internal view {
        bool isConverter = IConverterNetwork(converterNetwork).isTokenConverter(msg.sender);
        if ((!(isConverter) && (conversionConfigurations[tokenAddressIn][tokenAddressOut].onlyForPrivateConversions))) {
            revert ConversionEnabledOnlyForPrivateConversions();
        }
    }

    /// @notice To check, is conversion paused
    /// @custom:error ConversionTokensPaused is thrown when token conversion is paused
    function _checkConversionPaused() internal view {
        if (conversionPaused) {
            revert ConversionTokensPaused();
        }
    }

    /// @notice Get base asset address of the destination contract
    function _getDestinationBaseAsset() internal view virtual returns (address) {}
}
