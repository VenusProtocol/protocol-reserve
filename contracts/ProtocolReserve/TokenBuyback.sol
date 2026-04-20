// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { AddressUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { ITokenBuyback } from "../Interfaces/ITokenBuyback.sol";
import { IRiskFund } from "../Interfaces/IRiskFund.sol";

/// @title TokenBuyback
/// @author Venus
/// @notice Accumulates tokens from ProtocolShareReserve and converts them to a base asset
///         via DEX swaps triggered by an ACM-authorized operator (finance team cron job).
///         Replaces the community-driven Token Converter system.
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract TokenBuyback is AccessControlledV8, ReentrancyGuardUpgradeable, ITokenBuyback {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;

    /// @notice Address where buyback proceeds are sent
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable DESTINATION;

    /// @notice Token that every swap converts into (output of every buyback)
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable BASE_ASSET;

    /// @notice When true, calls RiskFundV2.updatePoolState() after each buyback
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    bool public immutable IS_RISK_FUND;

    /// @notice DEX router allowlist
    mapping(address => bool) public allowedRouters;

    /// @dev Gap for future storage variables
    uint256[49] private __gap;

    /// @notice Emitted when PSR transfers tokens and calls updateAssetsState
    event AssetsReceived(address indexed comptroller, address indexed asset, uint256 amount);

    /// @notice Emitted after a successful buyback swap
    event BuybackExecuted(
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut,
        address indexed router,
        address indexed comptroller
    );

    /// @notice Emitted when a router is added to or removed from the allowlist
    event RouterAllowlisted(address indexed router, bool allowed);

    /// @notice Emitted when BASE_ASSET is forwarded directly to DESTINATION without swap
    event BaseAssetForwarded(address indexed comptroller, uint256 amount);

    /// @notice Emitted when tokens are swept from the contract
    event SweepToken(address indexed token, address indexed to, uint256 amount);

    /// @notice Thrown when the router is not on the allowlist
    error RouterNotAllowed(address router);

    /// @notice Thrown when requested amount exceeds the contract's token balance
    error InsufficientBalance(address token, uint256 requested, uint256 available);

    /// @notice Thrown when swap output is below the minimum required
    error SlippageExceeded(uint256 expected, uint256 actual);

    /// @notice Thrown when the deadline has passed
    error DeadlineExpired(uint256 deadline, uint256 blockTimestamp);

    /// @notice Thrown when tokenIn equals BASE_ASSET (no swap needed)
    error InvalidTokenIn(address tokenIn);

    /// @notice Thrown when IS_RISK_FUND is true but comptroller is zero
    error ComptrollerRequired();

    /// @custom:oz-upgrades-unsafe-allow constructor
    /// @param destination_ Address where buyback proceeds land
    /// @param baseAsset_ Token being bought (output of every swap)
    /// @param isRiskFund_ If true, call RiskFundV2.updatePoolState() after each buyback
    constructor(
        address destination_,
        address baseAsset_,
        bool isRiskFund_
    ) {
        ensureNonzeroAddress(destination_);
        ensureNonzeroAddress(baseAsset_);
        DESTINATION = destination_;
        BASE_ASSET = baseAsset_;
        IS_RISK_FUND = isRiskFund_;

        _disableInitializers();
    }

    /// @param accessControlManager_ Access control manager contract address
    function initialize(address accessControlManager_) public initializer {
        __AccessControlled_init(accessControlManager_);
        __ReentrancyGuard_init();
    }

    /// @notice Called by PSR after transferring tokens to this contract
    /// @dev This is a required implementation of IIncomeDestination. PSR transfers tokens
    ///      via safeTransfer before calling this function. The contract passively holds
    ///      tokens until the cron calls executeBuyback. The emitted event is monitored
    ///      by the cron to track which tokens arrived from which pool.
    /// @param comptroller Address of the pool's comptroller
    /// @param asset Address of the token transferred
    /// @custom:event AssetsReceived emits the received amount
    function updateAssetsState(address comptroller, address asset) external override nonReentrant {
        uint256 balance = IERC20Upgradeable(asset).balanceOf(address(this));
        emit AssetsReceived(comptroller, asset, balance);
    }

    /// @notice Executes a buyback by swapping accumulated tokens via a DEX router
    /// @param tokenIn Address of the token to swap
    /// @param amountIn Amount of tokenIn to swap
    /// @param minAmountOut Minimum acceptable amount of BASE_ASSET received
    /// @param deadline Unix timestamp after which the swap reverts
    /// @param router Address of the DEX router (must be on allowlist)
    /// @param routerCalldata Encoded calldata for the router swap call (MUST send output to address(this))
    /// @param comptroller Comptroller address for RiskFund pool attribution (required when IS_RISK_FUND is true)
    /// @custom:event BuybackExecuted emits on success
    /// @custom:error DeadlineExpired when block.timestamp > deadline
    /// @custom:error InvalidTokenIn when tokenIn equals BASE_ASSET
    /// @custom:error ComptrollerRequired when IS_RISK_FUND is true but comptroller is zero
    /// @custom:error RouterNotAllowed when router is not on the allowlist
    /// @custom:error InsufficientBalance when amountIn exceeds the contract's tokenIn balance
    /// @custom:error SlippageExceeded when amountOut is less than minAmountOut
    /// @custom:access Restricted by ACM
    function executeBuyback(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        address router,
        bytes calldata routerCalldata,
        address comptroller
    ) external override nonReentrant {
        _checkAccessAllowed("executeBuyback(address,uint256,uint256,uint256,address,bytes,address)");
        _validateBuyback(tokenIn, amountIn, deadline, router, comptroller);

        // Measure BASE_ASSET balance on this contract (not DESTINATION) to prevent
        // donation-based amountOut inflation. Router calldata MUST send swap output here.
        uint256 balanceBefore = IERC20Upgradeable(BASE_ASSET).balanceOf(address(this));

        IERC20Upgradeable(tokenIn).forceApprove(router, amountIn);
        router.functionCall(routerCalldata);
        IERC20Upgradeable(tokenIn).forceApprove(router, 0);

        uint256 amountOut = IERC20Upgradeable(BASE_ASSET).balanceOf(address(this)) - balanceBefore;

        if (amountOut < minAmountOut) {
            revert SlippageExceeded(minAmountOut, amountOut);
        }

        _settleBuyback(amountOut, comptroller);

        emit BuybackExecuted(tokenIn, amountIn, amountOut, router, comptroller);
    }

    /// @notice Forwards accumulated BASE_ASSET directly to DESTINATION without swap
    /// @dev Handles BASE_ASSET that lands in the contract via PSR distribution (when PSR
    ///      routes the same token as BASE_ASSET to this instance) or direct transfers.
    ///      Transfers entire BASE_ASSET balance. No-op when balance is zero.
    /// @param comptroller Comptroller address for RiskFund pool attribution (required when IS_RISK_FUND is true)
    /// @custom:event BaseAssetForwarded emits when balance > 0
    /// @custom:error ComptrollerRequired when IS_RISK_FUND is true but comptroller is zero
    /// @custom:access Restricted by ACM
    function forwardBaseAsset(address comptroller) external nonReentrant {
        _checkAccessAllowed("forwardBaseAsset(address)");

        if (IS_RISK_FUND && comptroller == address(0)) {
            revert ComptrollerRequired();
        }

        uint256 amount = IERC20Upgradeable(BASE_ASSET).balanceOf(address(this));
        if (amount == 0) {
            return;
        }

        IERC20Upgradeable(BASE_ASSET).safeTransfer(DESTINATION, amount);

        if (IS_RISK_FUND) {
            IRiskFund(DESTINATION).updatePoolState(comptroller, BASE_ASSET, amount);
        }

        emit BaseAssetForwarded(comptroller, amount);
    }

    /// @notice Adds or removes a DEX router from the allowlist
    /// @param router Address of the DEX router
    /// @param allowed Whether the router should be allowed
    /// @custom:event RouterAllowlisted emits on success
    /// @custom:error ZeroAddressNotAllowed is thrown when router address is zero
    /// @custom:access Only Governance
    function setAllowedRouter(address router, bool allowed) external override onlyOwner {
        ensureNonzeroAddress(router);
        allowedRouters[router] = allowed;
        emit RouterAllowlisted(router, allowed);
    }

    /// @notice Transfers tokens out of the contract (emergency recovery)
    /// @param token Address of the token to sweep
    /// @param to Recipient address
    /// @param amount Amount to transfer
    /// @custom:event SweepToken emits on success
    /// @custom:error ZeroAddressNotAllowed is thrown when token/to address is zero
    /// @custom:error ZeroValueNotAllowed is thrown when amount is zero
    /// @custom:access Only Governance
    function sweepToken(
        address token,
        address to,
        uint256 amount
    ) external override onlyOwner nonReentrant {
        ensureNonzeroAddress(token);
        ensureNonzeroAddress(to);
        ensureNonzeroValue(amount);

        IERC20Upgradeable(token).safeTransfer(to, amount);

        emit SweepToken(token, to, amount);
    }

    /// @dev Transfers swap output to DESTINATION and notifies RiskFund if applicable
    function _settleBuyback(uint256 amountOut, address comptroller) internal {
        if (amountOut == 0) {
            return;
        }
        IERC20Upgradeable(BASE_ASSET).safeTransfer(DESTINATION, amountOut);
        if (IS_RISK_FUND) {
            IRiskFund(DESTINATION).updatePoolState(comptroller, BASE_ASSET, amountOut);
        }
    }

    /// @dev Validates executeBuyback inputs before router interaction
    function _validateBuyback(
        address tokenIn,
        uint256 amountIn,
        uint256 deadline,
        address router,
        address comptroller
    ) internal view {
        if (block.timestamp > deadline) {
            revert DeadlineExpired(deadline, block.timestamp);
        }
        if (tokenIn == BASE_ASSET) {
            revert InvalidTokenIn(tokenIn);
        }
        if (IS_RISK_FUND && comptroller == address(0)) {
            revert ComptrollerRequired();
        }
        if (!allowedRouters[router]) {
            revert RouterNotAllowed(router);
        }

        ensureNonzeroValue(amountIn);

        uint256 tokenInBalance = IERC20Upgradeable(tokenIn).balanceOf(address(this));
        if (amountIn > tokenInBalance) {
            revert InsufficientBalance(tokenIn, amountIn, tokenInBalance);
        }
    }
}
