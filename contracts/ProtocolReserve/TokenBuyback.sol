// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { AddressUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { ResilientOracleInterface } from "@venusprotocol/oracle/contracts/interfaces/OracleInterface.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { ITokenBuyback } from "../Interfaces/ITokenBuyback.sol";

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

    /// @notice Only legitimate caller of updateAssetsState. PSR is the single upstream
    ///         income source so pinning the caller here prevents spoofed AssetsReceived
    ///         events that could mis-attribute inflows to arbitrary comptrollers.
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable PROTOCOL_SHARE_RESERVE;

    /// @notice ResilientOracle used to USD-price tokenIn and BASE_ASSET when
    ///         enforcing the daily consumption cap and detecting abnormal
    ///         swap slippage in executeBuyback.
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable RESILIENT_ORACLE;

    /// @notice DEX router allowlist
    mapping(address => bool) public allowedRouters;

    /// @notice Per-asset balance watermark used to derive the delta received
    ///         on each updateAssetsState call. Resynced after every outflow
    ///         (executeBuyback, forwardBaseAsset, sweepToken) so inflow deltas
    ///         stay correct across interleaved deposits and withdrawals.
    /// @dev Reflects observed `balanceOf(this)` deltas rather than an authenticated
    ///      source-of-funds record. Tokens transferred directly to the contract
    ///      outside the PSR flow are not distinguished from authenticated PSR
    ///      inflows: they get merged into the next AssetsReceived event, can be
    ///      consumed by executeBuyback / forwardBaseAsset, and are absorbed into
    ///      this watermark when sweepToken resyncs to the post-transfer balance.
    ///      Off-chain integrators relying on `AssetsReceived` for source-of-funds
    ///      attribution must treat the value as a balance delta only.
    mapping(address => uint256) public assetsReserves;

    /// @notice Maximum cumulative USD value of tokenIn consumed via executeBuyback
    ///         within a rolling 24h window. Bounds blast radius if the operator key
    ///         is compromised. Stored 1e18-scaled.
    uint256 public dailyCapUsd;

    /// @notice Absolute USD threshold above which `executeBuyback` emits
    ///         AbnormalSlippage. Detects swap economics that diverge from
    ///         oracle pricing (e.g. swap routed through an attacker pool).
    ///         Event-only; does not revert. Stored 1e18-scaled.
    uint256 public slippageEventUsd;

    /// @notice Cumulative USD value of tokenIn consumed in the current daily window.
    uint256 public usdConsumedInWindow;

    /// @notice Timestamp at which the current daily window started. Reset lazily on
    ///         the first executeBuyback after the window expires.
    uint256 public windowStart;

    /// @notice Length of the rolling daily window
    uint256 internal constant WINDOW = 24 hours;

    /// @dev Gap for future storage variables
    uint256[43] private __gap;

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

    /// @notice Emitted when an executeBuyback swap returns less USD value than the input,
    ///         beyond the configured slippage threshold. Event-only; the swap still settles.
    event AbnormalSlippage(
        address indexed tokenIn,
        uint256 actualAmountIn,
        uint256 amountOut,
        uint256 usdIn,
        uint256 usdOut
    );

    /// @notice Emitted when the daily USD cap is updated
    event DailyCapUpdated(uint256 oldCap, uint256 newCap);

    /// @notice Emitted when the slippage event threshold is updated
    event SlippageEventUsdUpdated(uint256 oldThreshold, uint256 newThreshold);

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

    /// @notice Thrown when updateAssetsState is called by any address other than PROTOCOL_SHARE_RESERVE
    error UnauthorizedCaller(address caller);

    /// @notice Thrown when executeBuyback would push cumulative USD consumption past the daily cap
    error DailyCapExceeded(uint256 attempted, uint256 cap);

    /// @custom:oz-upgrades-unsafe-allow constructor
    /// @param destination_ Address where buyback proceeds land
    /// @param baseAsset_ Token being bought (output of every swap)
    /// @param protocolShareReserve_ Only address permitted to call updateAssetsState
    /// @param resilientOracle_ ResilientOracle used to USD-price tokenIn and BASE_ASSET
    constructor(
        address destination_,
        address baseAsset_,
        address protocolShareReserve_,
        address resilientOracle_
    ) {
        ensureNonzeroAddress(destination_);
        ensureNonzeroAddress(baseAsset_);
        ensureNonzeroAddress(protocolShareReserve_);
        ensureNonzeroAddress(resilientOracle_);
        DESTINATION = destination_;
        BASE_ASSET = baseAsset_;
        PROTOCOL_SHARE_RESERVE = protocolShareReserve_;
        RESILIENT_ORACLE = resilientOracle_;

        _disableInitializers();
    }

    /// @param accessControlManager_ Access control manager contract address
    /// @param dailyCapUsd_ Initial daily USD cap on tokenIn consumption (1e18-scaled)
    /// @param slippageEventUsd_ Initial absolute USD slippage threshold for AbnormalSlippage (1e18-scaled)
    function initialize(
        address accessControlManager_,
        uint256 dailyCapUsd_,
        uint256 slippageEventUsd_
    ) public initializer {
        __AccessControlled_init(accessControlManager_);
        __ReentrancyGuard_init();

        dailyCapUsd = dailyCapUsd_;
        slippageEventUsd = slippageEventUsd_;
        windowStart = block.timestamp;
    }

    /// @notice Called by PSR after transferring tokens to this contract
    /// @dev This is a required implementation of IIncomeDestination. PSR transfers tokens
    ///      via safeTransfer before calling this function. The contract passively holds
    ///      tokens until the cron calls executeBuyback. The emitted event is monitored
    ///      by the cron to track which tokens arrived from which pool.
    ///      The reported `balanceDifference` is computed as `balanceOf(this) -
    ///      assetsReserves[asset]` and therefore reflects the observed balance delta
    ///      since the last accounting update, not an authenticated record of PSR
    ///      transfer amounts. Tokens transferred directly to the contract outside the
    ///      PSR flow will be merged into a subsequent AssetsReceived event under
    ///      whichever comptroller PSR happens to be processing at the time. The bias
    ///      is one-shot (the watermark resyncs to `balanceOf(this)` on the same call)
    ///      and the donated tokens remain recoverable via `sweepToken`.
    /// @param comptroller Address of the pool's comptroller
    /// @param asset Address of the token transferred
    /// @custom:event AssetsReceived emits the received amount
    /// @custom:error UnauthorizedCaller when msg.sender is not PROTOCOL_SHARE_RESERVE
    /// @custom:access Only callable by PROTOCOL_SHARE_RESERVE
    function updateAssetsState(address comptroller, address asset) external override nonReentrant {
        if (msg.sender != PROTOCOL_SHARE_RESERVE) {
            revert UnauthorizedCaller(msg.sender);
        }
        uint256 currentBalance = IERC20Upgradeable(asset).balanceOf(address(this));
        uint256 previousBalance = assetsReserves[asset];
        if (currentBalance > previousBalance) {
            uint256 balanceDifference;
            unchecked {
                balanceDifference = currentBalance - previousBalance;
            }
            assetsReserves[asset] = currentBalance;
            emit AssetsReceived(comptroller, asset, balanceDifference);
        }
    }

    /// @notice Executes a buyback by swapping accumulated tokens via a DEX router
    /// @param tokenIn Address of the token to swap
    /// @param amountIn Amount of tokenIn to swap
    /// @param minAmountOut Minimum acceptable amount of BASE_ASSET received
    /// @param deadline Unix timestamp after which the swap reverts
    /// @param router Address of the DEX router (must be on allowlist)
    /// @param routerCalldata Encoded calldata for the router swap call (MUST send output to address(this))
    /// @param comptroller Comptroller address echoed in the BuybackExecuted event for off-chain attribution
    /// @custom:event BuybackExecuted emits on success
    /// @custom:error DeadlineExpired when block.timestamp > deadline
    /// @custom:error InvalidTokenIn when tokenIn equals BASE_ASSET
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
        _validateBuyback(tokenIn, amountIn, deadline, router);

        // Measure BASE_ASSET and tokenIn balances directly on this contract so the
        // delta reflects actual swap consumption regardless of any donation surplus
        // sitting outside the assetsReserves watermark. Router calldata MUST send
        // BASE_ASSET output here.
        uint256 baseAssetBalanceBefore = IERC20Upgradeable(BASE_ASSET).balanceOf(address(this));
        uint256 tokenInBalanceBefore = IERC20Upgradeable(tokenIn).balanceOf(address(this));

        IERC20Upgradeable(tokenIn).forceApprove(router, amountIn);
        router.functionCall(routerCalldata);
        IERC20Upgradeable(tokenIn).forceApprove(router, 0);

        uint256 tokenInBalanceAfter = IERC20Upgradeable(tokenIn).balanceOf(address(this));
        uint256 amountOut = IERC20Upgradeable(BASE_ASSET).balanceOf(address(this)) - baseAssetBalanceBefore;
        uint256 actualAmountIn = tokenInBalanceBefore - tokenInBalanceAfter;

        if (amountOut < minAmountOut) {
            revert SlippageExceeded(minAmountOut, amountOut);
        }

        if (amountOut != 0) {
            IERC20Upgradeable(BASE_ASSET).safeTransfer(DESTINATION, amountOut);
        }

        assetsReserves[tokenIn] = tokenInBalanceAfter;
        assetsReserves[BASE_ASSET] = IERC20Upgradeable(BASE_ASSET).balanceOf(address(this));

        _enforceCapAndDetectSlippage(tokenIn, actualAmountIn, amountOut);

        emit BuybackExecuted(tokenIn, actualAmountIn, amountOut, router, comptroller);
    }

    /// @notice Forwards a caller-specified portion of accumulated BASE_ASSET to DESTINATION without swap
    /// @dev BASE_ASSET can land here from multiple pools (PSR delivers per pool), so `amount`
    ///      lets the operator partition the balance and attribute each portion via the event.
    ///      No-op when `amount` is zero.
    /// @param comptroller Comptroller address echoed in the BaseAssetForwarded event for off-chain attribution
    /// @param amount Amount of BASE_ASSET to forward
    /// @custom:event BaseAssetForwarded emits when amount > 0
    /// @custom:error InsufficientBalance when amount exceeds BASE_ASSET balance
    /// @custom:access Restricted by ACM
    function forwardBaseAsset(address comptroller, uint256 amount) external nonReentrant {
        _checkAccessAllowed("forwardBaseAsset(address,uint256)");

        if (amount == 0) {
            return;
        }

        uint256 balance = IERC20Upgradeable(BASE_ASSET).balanceOf(address(this));
        if (amount > balance) {
            revert InsufficientBalance(BASE_ASSET, amount, balance);
        }

        IERC20Upgradeable(BASE_ASSET).safeTransfer(DESTINATION, amount);
        assetsReserves[BASE_ASSET] = IERC20Upgradeable(BASE_ASSET).balanceOf(address(this));

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
    /// @dev Resyncs `assetsReserves[token]` to the post-transfer balance after the
    ///      sweep. This is also the canonical recovery path for tokens transferred
    ///      directly to the contract outside the PSR flow: such tokens are not
    ///      distinguished from PSR-delivered balances on-chain, so governance can
    ///      use this function to drain unsolicited inflows when needed.
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
        assetsReserves[token] = IERC20Upgradeable(token).balanceOf(address(this));

        emit SweepToken(token, to, amount);
    }

    /// @notice Updates the daily USD cap on tokenIn consumption
    /// @param newCap New cap value (1e18-scaled)
    /// @custom:event DailyCapUpdated emits on success
    /// @custom:access Restricted by ACM
    function setDailyCapUsd(uint256 newCap) external override {
        _checkAccessAllowed("setDailyCapUsd(uint256)");
        emit DailyCapUpdated(dailyCapUsd, newCap);
        dailyCapUsd = newCap;
    }

    /// @notice Updates the absolute USD slippage threshold above which AbnormalSlippage is emitted
    /// @param newThreshold New threshold value (1e18-scaled)
    /// @custom:event SlippageEventUsdUpdated emits on success
    /// @custom:access Restricted by ACM
    function setSlippageEventUsd(uint256 newThreshold) external override {
        _checkAccessAllowed("setSlippageEventUsd(uint256)");
        emit SlippageEventUsdUpdated(slippageEventUsd, newThreshold);
        slippageEventUsd = newThreshold;
    }

    /// @dev Enforces the daily USD cap on tokenIn consumption and emits AbnormalSlippage
    ///      when the swap returns less USD value than the input by more than
    ///      `slippageEventUsd`. The cap reverts; slippage detection is event-only. The
    ///      window counter is reset lazily on the first call after expiry.
    function _enforceCapAndDetectSlippage(
        address tokenIn,
        uint256 actualAmountIn,
        uint256 amountOut
    ) internal {
        ResilientOracleInterface oracle = ResilientOracleInterface(RESILIENT_ORACLE);
        oracle.updateAssetPrice(tokenIn);
        oracle.updateAssetPrice(BASE_ASSET);
        uint256 priceIn = oracle.getPrice(tokenIn);
        uint256 priceBase = oracle.getPrice(BASE_ASSET);

        uint256 usdIn = (actualAmountIn * priceIn) / 1e18;
        uint256 usdOut = (amountOut * priceBase) / 1e18;

        uint256 _usdConsumedInWindow = usdConsumedInWindow;
        if (block.timestamp >= windowStart + WINDOW) {
            windowStart = block.timestamp;
            _usdConsumedInWindow = 0;
        }

        _usdConsumedInWindow += usdIn;

        if (_usdConsumedInWindow > dailyCapUsd) {
            revert DailyCapExceeded(_usdConsumedInWindow, dailyCapUsd);
        }

        usdConsumedInWindow = _usdConsumedInWindow;

        if (usdIn > usdOut) {
            uint256 usdSlippage = usdIn - usdOut;
            if (usdSlippage > slippageEventUsd) {
                emit AbnormalSlippage(tokenIn, actualAmountIn, amountOut, usdIn, usdOut);
            }
        }
    }

    /// @dev Validates executeBuyback inputs before router interaction
    function _validateBuyback(
        address tokenIn,
        uint256 amountIn,
        uint256 deadline,
        address router
    ) internal view {
        if (block.timestamp > deadline) {
            revert DeadlineExpired(deadline, block.timestamp);
        }
        if (tokenIn == BASE_ASSET) {
            revert InvalidTokenIn(tokenIn);
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
