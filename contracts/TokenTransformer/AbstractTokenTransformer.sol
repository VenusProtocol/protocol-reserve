// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

import { MANTISSA_ONE, EXP_SCALE } from "../Utils/Constants.sol";
import { ensureNonzeroAddress } from "../Utils/Validators.sol";
import { IAbstractTokenTransformer } from "./IAbstractTokenTransformer.sol";

/// @title AbstractTokenTransformer
/// @author Venus
/// @notice Abstract contract will be extended by XVSVaultTransformer and RiskFundTransformer
abstract contract AbstractTokenTransformer is
    AccessControlledV8,
    IAbstractTokenTransformer,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Maximum incentive could be
    uint256 public constant MAX_INCENTIVE = 5e18;

    /// @notice Venus price oracle contract
    ResilientOracle public priceOracle;

    /// @notice transformation configurations for the existing pairs
    /// @dev tokenAddressIn => tokenAddressOut => TransformationConfig
    mapping(address => mapping(address => TransformationConfig)) public transformConfigurations;

    /// @notice Address at all incoming tokens are transferred to
    address public destinationAddress;

    /// @notice Boolean of if transform is paused
    bool public transformationPaused;

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain.
    /// See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    uint256[47] private __gap;

    /// @notice Emitted when config is updated for tokens pair
    event TransformationConfigUpdated(
        address indexed tokenAddressIn,
        address indexed tokenAddressOut,
        uint256 oldIncentive,
        uint256 newIncentive,
        bool oldEnabled,
        bool newEnabled
    );
    /// @notice Emitted when price oracle address is updated
    event PriceOracleUpdated(ResilientOracle oldPriceOracle, ResilientOracle priceOracle);

    /// @notice Emitted when exact amount of tokens are transform for tokens
    event TransformExactTokens(uint256 amountIn, uint256 amountOut);

    /// @notice Emitted when tokens are transform for exact amount of tokens
    event TransformForExactTokens(uint256 amountIn, uint256 amountOut);

    /// @notice Emitted when exact amount of tokens are transform for tokens, for deflationary tokens
    event TransformExactTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOut);

    /// @notice Emitted when tokens are transform for exact amount of tokens, for deflationary tokens
    event TransformForExactTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOut);

    /// @notice Emitted when transformation is paused
    event TransformationPaused(address sender);

    /// @notice Emitted when transformation is unpaused
    event TransformationResumed(address sender);

    /// @notice Event emitted when tokens are swept
    event SweepToken(address indexed token);

    /// @notice Thrown when given input amount is zero
    error InsufficientInputAmount();

    /// @notice Thrown when transformation is disabled or config does not exist for given pair
    error TransformationConfigNotEnabled();

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

    /// @notice Thrown when transformation is paused
    error TransformationTokensPaused();

    /// @notice Thrown when transformation is Active
    error TransformationTokensActive();

    /**
     * @notice Pause transformation of tokens
     * @custom:event Emits TransformationPaused on success
     * @custom:error TransformationTokensPaused thrown when transform is already paused
     * @custom:access Restricted by ACM
     */
    function pauseTransformation() external {
        _checkAccessAllowed("pauseTransformation()");
        _checkTransformationPaused();
        transformationPaused = true;
        emit TransformationPaused(msg.sender);
    }

    /**
     * @notice Resume transformation of tokens.
     * @custom:event Emits TransformationResumed on success
     * @custom:error TransformationTokensActive thrown when transform is already active
     * @custom:access Restricted by ACM
     */
    function resumeTransformation() external {
        _checkAccessAllowed("resumeTransformation()");
        if (!transformationPaused) {
            revert TransformationTokensActive();
        }

        transformationPaused = false;
        emit TransformationResumed(msg.sender);
    }

    /// @notice Sets a new price oracle
    /// @param priceOracle_ Address of the new price oracle to set
    /// @custom:access Only Governance
    function setPriceOracle(ResilientOracle priceOracle_) external onlyOwner {
        _setPriceOracle(priceOracle_);
    }

    /// @notice Set the configuration for new or existing transform pair
    /// @param transformationConfig TransformationConfig config details to update
    /// @custom:event Emits TransformationConfigUpdated event on success
    /// @custom:error Unauthorized error is thrown when the call is not authorized by AccessControlManager
    /// @custom:error ZeroAddressNotAllowed is thrown when pool registry address is zero
    /// @custom:access Controlled by AccessControlManager
    function setTransformationConfig(TransformationConfig calldata transformationConfig) external {
        _checkAccessAllowed("setTransformationConfig(TransformationConfig)");
        ensureNonzeroAddress(transformationConfig.tokenAddressIn);
        ensureNonzeroAddress(transformationConfig.tokenAddressOut);

        if (transformationConfig.incentive > MAX_INCENTIVE) {
            revert IncentiveTooHigh(transformationConfig.incentive, MAX_INCENTIVE);
        }

        TransformationConfig storage configuration = transformConfigurations[transformationConfig.tokenAddressIn][
            transformationConfig.tokenAddressOut
        ];

        uint256 oldIncentive = configuration.incentive;
        bool oldEnabled = configuration.enabled;

        configuration.tokenAddressIn = transformationConfig.tokenAddressIn;
        configuration.tokenAddressOut = transformationConfig.tokenAddressOut;
        configuration.incentive = transformationConfig.incentive;
        configuration.enabled = transformationConfig.enabled;

        emit TransformationConfigUpdated(
            transformationConfig.tokenAddressIn,
            transformationConfig.tokenAddressOut,
            oldIncentive,
            transformationConfig.incentive,
            oldEnabled,
            transformationConfig.enabled
        );
    }

    /// @notice Transform exact amount of tokenAddressIn for tokenAddressOut
    /// @dev Method does not support deflationary tokens transfer
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to transform
    /// @param tokenAddressOut Address of the token to get after transform
    /// @param to Address of the tokenAddressOut receiver
    /// @custom:event Emits TransformExactTokens event on success
    /// @custom:error AmountOutLowerThanMinRequired error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    /// @custom:error AmountInOrAmountOutMismatched error is thrown when Amount of tokenAddressIn or tokenAddressOut is lower than expected fater transfer
    function transformExactTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external nonReentrant {
        _checkTransformationPaused();
        uint256 actualAmountIn;
        uint256 amountTransformedMantissa;
        uint256 actualAmountOut;
        uint256 amountOutMantissa;

        (
            actualAmountIn,
            amountTransformedMantissa,
            actualAmountOut,
            amountOutMantissa
        ) = _transformExactTokensForTokens(amountInMantissa, amountOutMinMantissa, tokenAddressIn, tokenAddressOut, to);

        if ((actualAmountIn < amountTransformedMantissa) || (actualAmountOut < amountOutMantissa)) {
            revert AmountInOrAmountOutMismatched(
                actualAmountIn,
                amountTransformedMantissa,
                actualAmountOut,
                amountOutMantissa
            );
        }

        emit TransformExactTokens(actualAmountIn, actualAmountOut);

        postTransformationHook(tokenAddressIn, actualAmountIn, actualAmountOut);
    }

    /// @notice Transform tokens for tokenAddressIn for exact amount of tokenAddressOut
    /// @dev Method does not support deflationary tokens transfer
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to transform
    /// @param tokenAddressOut Address of the token to get after transform
    /// @param to Address of the tokenAddressOut receiver
    /// @custom:event Emits TransformForExactTokens event on success
    /// @custom:error AmountInHigherThanMax error is thrown when amount of tokenAddressIn is higher than amountInMaxMantissa
    /// @custom:error AmountInOrAmountOutMismatched error is thrown when Amount of tokenAddressIn or tokenAddressOut is lower than expected fater transfer
    function transformForExactTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external nonReentrant {
        _checkTransformationPaused();
        uint256 actualAmountIn;
        uint256 amountInMantissa;
        uint256 actualAmountOut;
        uint256 amountTransformedMantissa;

        (actualAmountIn, amountInMantissa, actualAmountOut, amountTransformedMantissa) = _transformForExactTokens(
            amountInMaxMantissa,
            amountOutMantissa,
            tokenAddressIn,
            tokenAddressOut,
            to
        );

        if ((actualAmountIn < amountInMantissa) || (actualAmountOut < amountTransformedMantissa)) {
            revert AmountInOrAmountOutMismatched(
                actualAmountIn,
                amountInMantissa,
                actualAmountOut,
                amountTransformedMantissa
            );
        }

        postTransformationHook(tokenAddressIn, actualAmountIn, actualAmountOut);

        emit TransformForExactTokens(actualAmountIn, actualAmountOut);
    }

    /// @notice Transform exact amount of tokenAddressIn for tokenAddressOut
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to transform
    /// @param tokenAddressOut Address of the token to get after transform
    /// @param to Address of the tokenAddressOut receiver
    /// @custom:event Emits TransformExactTokensSupportingFeeOnTransferTokens event on success
    /// @custom:error AmountOutLowerThanMinRequired error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    function transformExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external nonReentrant {
        _checkTransformationPaused();
        uint256 actualAmountIn;
        uint256 amountTransformedMantissa;
        uint256 actualAmountOut;
        uint256 amountOutMantissa;

        (
            actualAmountIn,
            amountTransformedMantissa,
            actualAmountOut,
            amountOutMantissa
        ) = _transformExactTokensForTokens(amountInMantissa, amountOutMinMantissa, tokenAddressIn, tokenAddressOut, to);

        postTransformationHook(tokenAddressIn, actualAmountIn, actualAmountOut);

        emit TransformExactTokensSupportingFeeOnTransferTokens(actualAmountIn, actualAmountOut);
    }

    /// @notice Transform tokens for tokenAddressIn for exact amount of tokenAddressOut
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to transform
    /// @param tokenAddressOut Address of the token to get after transform
    /// @param to Address of the tokenAddressOut receiver
    /// @custom:event Emits TransformForExactTokensSupportingFeeOnTransferTokens event on success
    /// @custom:error AmountInHigherThanMax error is thrown when amount of tokenAddressIn is higher than amountInMaxMantissa
    function transformForExactTokensSupportingFeeOnTransferTokens(
        uint256 amountInMaxMantissa,
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    ) external nonReentrant {
        _checkTransformationPaused();
        uint256 actualAmountIn;
        uint256 amountInMantissa;
        uint256 actualAmountOut;
        uint256 amountTransformedMantissa;

        (actualAmountIn, amountInMantissa, actualAmountOut, amountTransformedMantissa) = _transformForExactTokens(
            amountInMaxMantissa,
            amountOutMantissa,
            tokenAddressIn,
            tokenAddressOut,
            to
        );

        postTransformationHook(tokenAddressIn, actualAmountIn, actualAmountOut);

        emit TransformForExactTokensSupportingFeeOnTransferTokens(actualAmountIn, actualAmountOut);
    }

    /// @notice A public function to sweep accidental ERC-20 transfers to this contract. Tokens are sent to admin (timelock)
    /// @param tokenAddress The address of the ERC-20 token to sweep
    /// @custom:event Emits SweepToken event on success
    /// @custom:access Only Governance
    function sweepToken(address tokenAddress) external onlyOwner nonReentrant {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        token.safeTransfer(owner(), balance);

        emit SweepToken(address(token));
    }

    /// @notice Get the balance for specific token
    /// @param token Address of the token
    function balanceOf(address token) external virtual returns (uint256 tokenBalance) {}

    /// @param accessControlManager_ Access control manager contract address
    /// @param priceOracle_ Resilient oracle address
    /// @param destinationAddress_  Address at all incoming tokens will transferred to
    function initialize(
        address accessControlManager_,
        ResilientOracle priceOracle_,
        address destinationAddress_
    ) public virtual initializer {
        __AccessControlled_init(accessControlManager_);
        __ReentrancyGuard_init();

        _setPriceOracle(priceOracle_);
        destinationAddress = destinationAddress_;
        transformationPaused = false;
    }

    /// @notice To get the amount of tokenAddressOut tokens sender could receive on providing amountInMantissa tokens of tokenAddressIn
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param tokenAddressIn Address of the token to transform
    /// @param tokenAddressOut Address of the token to get after transform
    /// @return amountTransformedMantissa Amount of tokenAddressIn should be transferred after transform
    /// @return amountOutMantissa Amount of the tokenAddressOut sender should receive after transform
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error TransformationConfigNotEnabled is thrown when transform is disabled or config does not exist for given pair
    function getAmountOut(
        uint256 amountInMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) public view returns (uint256 amountTransformedMantissa, uint256 amountOutMantissa) {
        if (amountInMantissa == 0) {
            revert InsufficientInputAmount();
        }

        TransformationConfig storage configuration = transformConfigurations[tokenAddressIn][tokenAddressOut];

        if (!configuration.enabled) {
            revert TransformationConfigNotEnabled();
        }

        uint256 maxTokenOutLiquidity = IERC20Upgradeable(tokenAddressOut).balanceOf(address(this));
        uint256 tokenInUnderlyingPrice = priceOracle.getPrice(tokenAddressIn);
        uint256 tokenOutUnderlyingPrice = priceOracle.getPrice(tokenAddressOut);

        /// amount of tokenAddressOut after including incentive
        uint256 conversionWithIncentive = MANTISSA_ONE + configuration.incentive;
        /// conversion rate after considering incentive(conversionWithIncentive)
        uint256 tokenInToOutConversion = (tokenInUnderlyingPrice * conversionWithIncentive) / tokenOutUnderlyingPrice;

        amountOutMantissa = (amountInMantissa * tokenInToOutConversion) / EXP_SCALE;
        amountTransformedMantissa = amountInMantissa;

        /// If contract has less liquity for tokenAddressOut than amountOutMantissa
        if (maxTokenOutLiquidity < amountOutMantissa) {
            amountTransformedMantissa = ((maxTokenOutLiquidity * EXP_SCALE) / tokenInToOutConversion);
            amountOutMantissa = maxTokenOutLiquidity;
        }
    }

    /// @notice To get the amount of tokenAddressIn tokens sender would send on receiving amountOutMantissa tokens of tokenAddressOut
    /// @param amountOutMantissa Amount of tokenAddressOut user wants to receive
    /// @param tokenAddressIn Address of the token to transform
    /// @param tokenAddressOut Address of the token to get after transform
    /// @return amountTransformedMantissa Amount of tokenAddressOut should be transferred after transform
    /// @return amountInMantissa Amount of the tokenAddressIn sender would send to contract before transform
    /// @custom:error InsufficientInputAmount error is thrown when given input amount is zero
    /// @custom:error TransformationConfigNotEnabled is thrown when transform is disabled or config does not exist for given pair
    function getAmountIn(
        uint256 amountOutMantissa,
        address tokenAddressIn,
        address tokenAddressOut
    ) public view returns (uint256 amountTransformedMantissa, uint256 amountInMantissa) {
        if (amountOutMantissa == 0) {
            revert InsufficientInputAmount();
        }

        TransformationConfig storage configuration = transformConfigurations[tokenAddressIn][tokenAddressOut];

        if (!configuration.enabled) {
            revert TransformationConfigNotEnabled();
        }

        uint256 maxTokenOutLiquidity = IERC20Upgradeable(tokenAddressOut).balanceOf(address(this));
        uint256 tokenInUnderlyingPrice = priceOracle.getPrice(tokenAddressIn);
        uint256 tokenOutUnderlyingPrice = priceOracle.getPrice(tokenAddressOut);

        /// amount of tokenAddressOut after including incentive
        uint256 conversionWithIncentive = MANTISSA_ONE + configuration.incentive;
        /// conversion rate after considering incentive(conversionWithIncentive)
        uint256 tokenInToOutConversion = (tokenInUnderlyingPrice * conversionWithIncentive) / tokenOutUnderlyingPrice;

        amountInMantissa = ((amountOutMantissa * EXP_SCALE) / tokenInToOutConversion);
        amountTransformedMantissa = amountOutMantissa;

        /// If contract has less liquity for tokenAddressOut than amountOutMantissa
        if (maxTokenOutLiquidity < amountOutMantissa) {
            amountInMantissa = ((maxTokenOutLiquidity * EXP_SCALE) / tokenInToOutConversion);
            amountTransformedMantissa = maxTokenOutLiquidity;
        }
    }

    /// @notice Transform exact amount of tokenAddressIn for tokenAddressOut
    /// @param amountInMantissa Amount of tokenAddressIn
    /// @param amountOutMinMantissa Min amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to transform
    /// @param tokenAddressOut Address of the token to get after transform
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount of tokenAddressIn transferred
    /// @return amountTransformedMantissa Amount of tokenAddressIn supposed to get transferred
    /// @return actualAmountOut Actual amount of tokenAddressOut transferred
    /// @return amountOutMantissa Amount of tokenAddressOut supposed to get transferred
    /// @custom:error AmountOutLowerThanMinRequired error is thrown when amount of output tokenAddressOut is less than amountOutMinMantissa
    function _transformExactTokensForTokens(
        uint256 amountInMantissa,
        uint256 amountOutMinMantissa,
        address tokenAddressIn,
        address tokenAddressOut,
        address to
    )
        internal
        returns (
            uint256 actualAmountIn,
            uint256 amountTransformedMantissa,
            uint256 actualAmountOut,
            uint256 amountOutMantissa
        )
    {
        (amountTransformedMantissa, amountOutMantissa) = getAmountOut(
            amountInMantissa,
            tokenAddressIn,
            tokenAddressOut
        );

        if (amountOutMantissa < amountOutMinMantissa) {
            revert AmountOutLowerThanMinRequired(amountOutMantissa, amountOutMinMantissa);
        }

        IERC20Upgradeable tokenIn = IERC20Upgradeable(tokenAddressIn);
        uint256 balanceBeforeDestination = tokenIn.balanceOf(destinationAddress);
        tokenIn.safeTransferFrom(msg.sender, destinationAddress, amountTransformedMantissa);
        uint256 balanceAfterDestination = tokenIn.balanceOf(destinationAddress);

        IERC20Upgradeable tokenOut = IERC20Upgradeable(tokenAddressOut);
        uint256 balanceBeforeTo = tokenOut.balanceOf(to);
        tokenOut.safeTransfer(to, amountOutMantissa);
        uint256 balanceAfterTo = tokenOut.balanceOf(to);

        actualAmountIn = balanceAfterDestination - balanceBeforeDestination;
        actualAmountOut = balanceAfterTo - balanceBeforeTo;
    }

    /// @notice Transform tokens for tokenAddressIn for exact amount of tokenAddressOut
    /// @param amountInMaxMantissa Max amount of tokenAddressIn
    /// @param amountOutMantissa Amount of tokenAddressOut required as output
    /// @param tokenAddressIn Address of the token to transform
    /// @param tokenAddressOut Address of the token to get after transform
    /// @param to Address of the tokenAddressOut receiver
    /// @return actualAmountIn Actual amount of tokenAddressIn transferred
    /// @return amountInMantissa Amount of tokenAddressIn supposed to get transferred
    /// @return actualAmountOut Actual amount of tokenAddressOut transferred
    /// @return amountTransformedMantissa Amount of tokenAddressOut supposed to get transferred
    /// @custom:error AmountInHigherThanMax error is thrown when amount of tokenAddressIn is higher than amountInMaxMantissa
    function _transformForExactTokens(
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
            uint256 amountTransformedMantissa
        )
    {
        (amountTransformedMantissa, amountInMantissa) = getAmountIn(amountOutMantissa, tokenAddressIn, tokenAddressOut);

        if (amountInMantissa > amountInMaxMantissa) {
            revert AmountInHigherThanMax(amountInMantissa, amountInMaxMantissa);
        }

        IERC20Upgradeable tokenIn = IERC20Upgradeable(tokenAddressIn);
        uint256 balanceBeforeDestination = tokenIn.balanceOf(destinationAddress);
        tokenIn.safeTransferFrom(msg.sender, destinationAddress, amountInMantissa);
        uint256 balanceAfterDestination = tokenIn.balanceOf(destinationAddress);

        IERC20Upgradeable tokenOut = IERC20Upgradeable(tokenAddressOut);
        uint256 balanceBeforeTo = tokenOut.balanceOf(to);
        tokenOut.safeTransfer(to, amountTransformedMantissa);
        uint256 balanceAfterTo = tokenOut.balanceOf(to);

        actualAmountIn = balanceAfterDestination - balanceBeforeDestination;
        actualAmountOut = balanceAfterTo - balanceBeforeTo;
    }

    /// @notice Sets a new price oracle
    /// @param priceOracle_ Address of the new price oracle to set
    /// @custom:event Emits PriceOracleUpdated event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when pool registry address is zero
    function _setPriceOracle(ResilientOracle priceOracle_) internal {
        ensureNonzeroAddress(address(priceOracle_));

        ResilientOracle oldPriceOracle = priceOracle;
        priceOracle = priceOracle_;

        emit PriceOracleUpdated(oldPriceOracle, priceOracle);
    }

    /// @notice Hook to perform after tranforming tokens
    /// @param tokenInAddress Address of the token
    /// @param amountIn Amount of tokenIn transformed
    /// @param amountOut Amount of tokenOut transformed
    function postTransformationHook(address tokenInAddress, uint256 amountIn, uint256 amountOut) internal virtual {}

    /// @notice To check, is transform paused
    function _checkTransformationPaused() internal view {
        if (transformationPaused) {
            revert TransformationTokensPaused();
        }
    }
}
