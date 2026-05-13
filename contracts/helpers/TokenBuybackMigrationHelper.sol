// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IACMForMigration {
    function giveCallPermission(
        address contractAddress,
        string calldata functionSig,
        address account
    ) external;

    function revokeCallPermission(
        address contractAddress,
        string calldata functionSig,
        address account
    ) external;

    function renounceRole(bytes32 role, address account) external;

    function hasRole(bytes32 role, address account) external view returns (bool);
}

interface IOwnable2Step {
    function acceptOwnership() external;

    function transferOwnership(address newOwner) external;

    function pendingOwner() external view returns (address);
}

interface ITokenBuyback is IOwnable2Step {
    function setAllowedRouter(address router, bool allowed) external;
}

interface ITokenConverterForMigration is IOwnable2Step {
    function sweepToken(
        address tokenAddress,
        address to,
        uint256 amount
    ) external;

    function pauseConversion() external;
}

interface IPsrForMigration {
    /// @dev Schema is uint8 in the on-chain ABI: 0 = PROTOCOL_RESERVES, 1 = ADDITIONAL_REVENUE.
    struct DistributionConfig {
        uint8 schema;
        uint16 percentage;
        address destination;
    }

    function addOrUpdateDistributionConfigs(DistributionConfig[] calldata configs) external;

    function removeDistributionConfig(uint8 schema, address destination) external;
}

interface IShortfallForMigration {
    function pauseAuctions() external;
}

interface IPancakeV3Router {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

/// @title TokenBuybackMigrationHelper
/// @notice Two-shot helper that migrates the Venus Token Converter system to the
///         new TokenBuyback proxies. Split across `execute1()` and `execute2()`
///         so that the per-tx gas budget fits under BSC's Osaka hardfork cap of
///         16,777,216 (2^24) gas — the original single-tx flow needed ~17.5 M.
///
/// @dev    Trust model
///         -----------
///         Pre-state assumptions:
///           - 10 buyback proxies deployed with `pendingOwner = address(this)`
///             (deploy scripts set the helper directly as pending owner; no
///             timelock hop).
///           - 6 legacy converters currently owned by NormalTimelock.
///         A first wrapping VIP performs two preparatory actions:
///           (1) `transferOwnership(helper)` on each of the 6 timelock-owned
///               legacy converters (sets `pendingOwner = helper`).
///           (2) `grantRole(DEFAULT_ADMIN_ROLE, helper)` on the AccessControlManager.
///         It then calls `execute1()`, which: accepts ownership of all 16
///         contracts, pauses converters and Shortfall auctions, repoints PSR
///         distributions, revokes the transient ACM permissions, grants the
///         cron operator persistent `executeBuyback` + `forwardBaseAsset`
///         permissions on every buyback, and renounces its own ACM admin
///         role. Router allowlisting and the ownership handback for all 16
///         contracts are deferred to `execute2()` so that each tx stays
///         comfortably under BSC Osaka's 16,777,216 (2^24) per-tx gas cap.
///
///         A second wrapping VIP (queued after `execute1` lands) calls
///         `execute2()`, which allowlists the 9 swap routers on every
///         buyback, drains every legacy converter into its replacement
///         buyback, and hands back ownership of all 16 contracts to
///         NormalTimelock. Between the two VIPs the helper holds no ACM
///         privileges (DEFAULT_ADMIN_ROLE renounced at end of `execute1`).
///         The only residual power is owner of all 16 contracts, used solely
///         by `execute2()` itself; no other external entrypoint exists, and
///         both flags are one-shot.
///
///         After `execute2()` returns the helper holds no privileges and no
///         balances. Both entrypoints are one-shot: a second call to either
///         reverts.
///
///         The May 2026 Prime rewards allocation is split between the VIP
///         and this helper:
///           - VIP (direct NormalTimelock commands): `Prime.addMarket(vU)`,
///             `PLP.initializeTokens([U])`, `PLP.sweepToken(USDC, helper, ...)`,
///             `PLP.setMaxTokensDistributionSpeed`, `PLP.setTokensDistributionSpeed`.
///             These are either `onlyOwner`-gated on PLP or simple ACM-gated
///             setters that don't justify wrapping in helper logic.
///           - Helper (`executeSwap`): single multihop USDC -> USDT -> U V3
///             swap (the USDT leg is omitted — PLP already holds enough USDT
///             for the May 2026 distribution), with try/catch + `StepFailed`
///             so a thin-pool slippage can't take down the broader VIP, and
///             leftover USDC forwarded back to NormalTimelock.
///
///         Single-chain (BSC mainnet) two-shot. Every address is hardcoded as a
///         `constant`; redeploy the helper if any address changes.
contract TokenBuybackMigrationHelper is ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    // -------------------------------------------------------------------------
    // BSC mainnet protocol addresses (frozen)
    // -------------------------------------------------------------------------
    address private constant NORMAL_TIMELOCK = 0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396;
    address private constant ACM = 0x4788629ABc6cFCA10F9f969efdEAa1cF70c23555;
    address private constant PSR = 0xCa01D5A9A248a830E9D93231e791B1afFed7c446;
    address private constant VTREASURY = 0xF322942f644A996A617BD29c16bd7d231d9F35E9;

    // ----- Legacy converters (timelock-owned: drained + paused by this helper) -----
    address private constant RISK_FUND_CONVERTER = 0xA5622D276CcbB8d9BBE3D1ffd1BB11a0032E53F0;
    address private constant USDT_PRIME_CONVERTER = 0xD9f101AA67F3D72662609a2703387242452078C3;
    address private constant USDC_PRIME_CONVERTER = 0xa758c9C215B6c4198F0a0e3FA46395Fa15Db691b;
    address private constant BTCB_PRIME_CONVERTER = 0xE8CeAa79f082768f99266dFd208d665d2Dd18f53;
    address private constant ETH_PRIME_CONVERTER = 0xca430B8A97Ea918fF634162acb0b731445B8195E;
    address private constant XVS_VAULT_CONVERTER = 0xd5b9AE835F4C59272032B3B954417179573331E0;

    /// @notice WBNBBurnConverter is owned by the Venus Guardian multisig and is
    ///         intentionally not drained or paused by this helper. The address is
    ///         recorded only so that the PSR row pointing at it can be removed.
    address private constant WBNB_BURN_CONVERTER = 0x9eF79830e626C8ccA7e46DCEd1F90e51E7cFCeBE;

    /// @notice Cron operator (finance-team EOA / multisig). Receives `executeBuyback`
    ///         and `forwardBaseAsset` ACM permissions on every buyback.
    address private constant OPERATOR = 0x88ac9ca69A371f47798Df18e5C36449af44526a4;

    // ----- New TokenBuyback proxies (redeployed in PR #162) -----
    address private constant RISK_FUND_BUYBACK = 0x0c71EFabD00329E839745ef23aB946d3ed24A805;
    address private constant USDT_PRIME_BUYBACK = 0xD721932C7CA41Eb5305867287010587a266346a8;
    address private constant U_PRIME_BUYBACK = 0xBC9fFBfb799B2d189669D3816E2B7273c69041bd;
    address private constant XVS_BUYBACK = 0x637E6246BBb0F9aBae9d764F5e1bB6347f028C12;
    address private constant U_TREASURY_BUYBACK = 0xec63411423D03327De19135446dDdA3055D2feA8;
    address private constant BTCB_TREASURY_BUYBACK = 0x1F306a0d929a7098a0A0b12248Ba97600AB79026;
    address private constant ETH_TREASURY_BUYBACK = 0x41954F0bf26959dF2e1B8302DEBf736B5b154B64;
    address private constant USDT_TREASURY_BUYBACK = 0xB3dDf13E8B6b8dE10F5826087C202b80F1D1b490;
    address private constant USDC_TREASURY_BUYBACK = 0xd7aC40f9bd9A1beb8E2d121b4446CF90417cf169;
    address private constant XVS_TREASURY_BUYBACK = 0x6D2d239c16453062cF145A7a5128A6a60710d236;

    // -------------------------------------------------------------------------
    // BSC core pool ERC20 universe (47 tokens) — every underlying of every
    // market in the core Unitroller (snapshot 2026-05-07). Isolated pools are
    // out of scope: they are wound down. Inlined as a single list inside
    // `_coreTokens()`; setting an entry on a converter that holds zero of it is
    // a no-op via the `bal > 0` guard in `_sweepIfNonzero`.
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // Allowlisted swap routers on every buyback
    // -------------------------------------------------------------------------
    address private constant PANCAKE_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E; // PCS V2
    address private constant PANCAKE_V3_ROUTER = 0x1b81D678ffb9C0263b24A97847620C99d213eB14;
    address private constant PANCAKE_SMART_ROUTER = 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4;
    address private constant PANCAKE_UNIVERSAL_ROUTER = 0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB;
    address private constant ONEINCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address private constant UNIV2_SWAP_ROUTER_02 = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address private constant UNIV3_SWAP_ROUTER_02 = 0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2;
    address private constant UNIV4_SWAP_ROUTER = 0x8B844f885672f333Bc0042cB669255f93a4C1E6b;
    address private constant UNI_UNIVERSAL_ROUTER = 0x1906c1d672b88cD1B9aC7593301cA990F94Eae07;

    // -------------------------------------------------------------------------
    // Shortfall — paused in `_pauseRevenueFlows` because it pulls from
    // RiskFundV2, whose income path this migration rewires.
    // -------------------------------------------------------------------------
    address private constant SHORTFALL = 0xf37530A8a810Fcb501AA0Ecd0B0699388F0F2209;

    // -------------------------------------------------------------------------
    // executeSwap parameters — May 2026 Prime allocation swap leg.
    // Pre-state assumption: the wrapping VIP has already called
    // `PLP.sweepToken(USDC, helper, USDC_TO_SWEEP)` from NormalTimelock
    // (the PLP owner) so the helper holds the USDC.
    // -------------------------------------------------------------------------
    address private constant USDT = 0x55d398326f99059fF775485246999027B3197955;
    address private constant USDC = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
    address private constant U = 0xcE24439F2D9C6a2289F741120FE202248B666666;
    address private constant PRIME_LIQUIDITY_PROVIDER = 0x23c4F844ffDdC6161174eB32c770D4D8C07833F2;

    /// @dev 0.01% fee tier on every leg — deepest pools for stable/U pairs.
    uint24 private constant V3_FEE_TIER = 100;

    /// @dev Single multihop USDC -> USDT -> U swap. The direct USDC/U V3 pool
    ///      is too thin (~2,694 U) for this size; routing through the deep
    ///      USDT/U pool is required. The USDT leg is intentionally omitted —
    ///      PLP already holds ~25k USDT, more than enough for the May 2026
    ///      distribution. Of PLP's ~14.9k USDC, ~4k is reserved for
    ///      unclaimed user rewards, so the wrapping VIP sweeps 10k into this
    ///      helper. Quote at 2026-05-13 (BSC mainnet latest):
    ///      10,000 USDC -> 9,996.60 U via QuoterV2 (~0.034% slippage);
    ///      `U_MIN_OUT` set at 9,900e18 (~1% buffer for execution-time drift).
    uint256 private constant USDC_TO_SWAP = 10_000e18;
    uint256 private constant U_MIN_OUT = 9_900e18;

    /// @dev Generous deadline window; tx executes atomically within the VIP so
    ///      `block.timestamp` at submit is effectively `now`.
    uint256 private constant SWAP_DEADLINE_WINDOW = 1 hours;

    bool public executed1;
    bool public executed2;
    bool public executedSwap;

    event Executed1();
    event Executed2();
    event ExecutedSwap();
    /// @notice Emitted when a soft-failing swap leg reverts. Migration core
    ///         continues regardless — leftover USDC is forwarded back to
    ///         NormalTimelock so it isn't stranded.
    event StepFailed(string step, bytes reason);

    error NotTimelock();
    error AlreadyExecuted();
    error Execute1NotRun();
    error PendingOwnerMismatch(address contractAddress, address expected, address actual);

    /// @notice First half of the migration. Callable exactly once, by NormalTimelock.
    ///         Configures the 10 buybacks, pauses the 6 timelock-owned converters,
    ///         repoints PSR distributions, hands back ownership of the buybacks
    ///         to NormalTimelock and renounces the helper's `DEFAULT_ADMIN_ROLE`
    ///         on the ACM. Leaves ownership of the 6 converters with this helper
    ///         so that `execute2()` can call `sweepToken` on them.
    function execute1() external nonReentrant {
        if (msg.sender != NORMAL_TIMELOCK) revert NotTimelock();
        if (executed1) revert AlreadyExecuted();
        executed1 = true;

        // Step 1: claim ownership of every contract whose `pendingOwner` is set
        //         to this helper (10 buybacks + 6 timelock-owned converters).
        _acceptAllOwnerships();

        // Step 2: self-grant transient ACM permissions for the ACM-checked
        //         calls below (PSR add/remove, `pauseConversion`,
        //         `pauseAuctions`). Revoked in step 5.
        _selfGrantTransientAcmPermissions();

        // Step 3: pause revenue flows — the 6 legacy converters (token
        //         conversion) and Shortfall (RiskFund auctions). Shortfall is
        //         paused here because it pulls from RiskFundV2, whose income
        //         path is being rewired by this migration. Drain of converter
        //         balances happens in `execute2()`; `sweepToken` is
        //         `onlyOwner`-gated and not affected by the pause flag.
        _pauseRevenueFlows();

        // Step 4: repoint ProtocolShareReserve distributions from legacy
        //         converters and the VTreasury direct destination to the 10
        //         new buybacks; the 18 new rows + 12 zero-stale rows land in
        //         a single `addOrUpdateDistributionConfigs` call so PSR's
        //         per-schema sum invariant (1e4 or 0) holds atomically, then
        //         `removeDistributionConfig` deletes the zeroed entries.
        _rewireProtocolShareReserve();

        // Step 5: revoke the transient ACM permissions self-granted in step 2.
        _revokeTransientAcmPermissions();

        // Step 6: grant the cron operator `executeBuyback` and
        //         `forwardBaseAsset` permissions on each of the 10 buybacks.
        //         Done after the ACM revoke above because operator perms are
        //         persistent, not transient.
        _grantOperatorPermissions();

        // Step 7: relinquish the helper's `DEFAULT_ADMIN_ROLE` on the ACM so
        //          no residual ACM privilege survives between the two VIPs.
        IACMForMigration(ACM).renounceRole(DEFAULT_ADMIN_ROLE, address(this));

        // Note: router allowlisting and ownership handback both move to
        //       execute2() to keep execute1's gas footprint bounded well
        //       under BSC Osaka's 16,777,216 (2^24) per-tx limit. Helper
        //       retains ownership of all 16 contracts between VIPs; with
        //       DEFAULT_ADMIN_ROLE renounced and no external entrypoints
        //       beyond execute1/execute2 (both one-shot), the residual blast
        //       surface is bounded to whatever execute2 itself can do.

        emit Executed1();
    }

    /// @notice Second half of the migration. Callable exactly once, by
    ///         NormalTimelock, only after `execute1()` has run.
    ///         Allowlists swap routers on every buyback, drains every legacy
    ///         converter into its replacement buyback, then hands back
    ///         ownership of all 16 contracts to NormalTimelock.
    function execute2() external nonReentrant {
        if (msg.sender != NORMAL_TIMELOCK) revert NotTimelock();
        if (!executed1) revert Execute1NotRun();
        if (executed2) revert AlreadyExecuted();
        executed2 = true;

        // Step 1: allowlist the 9 swap routers on each of the 10 buybacks so
        //         the cron operator can route via the best execution venue.
        //         Done here (rather than execute1) so execute1 stays well
        //         under Osaka's per-tx gas cap.
        _allowlistRoutersOnAllBuybacks();

        // Step 2: sweep every non-zero core-pool ERC20 balance off each
        //         timelock-owned converter into its replacement buyback.
        //         `sweepToken` is `onlyOwner` and not gated by the pause flag,
        //         so this works against the converters paused in `execute1`.
        _drainAllConverters();

        // Step 3: transfer ownership of all 16 contracts (10 buybacks + 6
        //         converters) back to NormalTimelock. The wrapping VIP calls
        //         `acceptOwnership` on each after this returns.
        _handBackBuybackOwnership();
        _handBackConverterOwnership();

        emit Executed2();
    }

    /// @notice Swap leg of the May 2026 Prime allocation. Callable exactly
    ///         once, by NormalTimelock. The wrapping VIP is responsible for
    ///         the rest of the Prime block (`Prime.addMarket(vU)`,
    ///         `PLP.initializeTokens([U])`, `PLP.setMaxTokensDistributionSpeed`,
    ///         `PLP.setTokensDistributionSpeed`) and for delivering
    ///         `USDC_TO_SWAP` USDC to this helper via
    ///         `PLP.sweepToken(USDC, helper, USDC_TO_SWAP)` from NormalTimelock
    ///         (the PLP owner) before calling this function. Only U is bought
    ///         here — PLP already holds enough USDT to cover the May 2026
    ///         distribution.
    ///
    ///         This function:
    ///           1. Approves `USDC_TO_SWAP` USDC to the PancakeSwap V3 router.
    ///           2. Swaps USDC -> USDT -> U (multihop, soft-fail). The direct
    ///              USDC/U V3 pool is too thin to absorb 10k USDC, so routing
    ///              through the deep USDT/U pool is required. Output is
    ///              delivered directly to PRIME_LIQUIDITY_PROVIDER.
    ///           3. Resets USDC approval and forwards any leftover USDC back
    ///              to NormalTimelock so it isn't stranded in this helper.
    function executeSwap() external nonReentrant {
        if (msg.sender != NORMAL_TIMELOCK) revert NotTimelock();
        if (executedSwap) revert AlreadyExecuted();
        executedSwap = true;

        IERC20(USDC).forceApprove(PANCAKE_V3_ROUTER, USDC_TO_SWAP);

        bytes memory usdcToUPath = abi.encodePacked(USDC, V3_FEE_TIER, USDT, V3_FEE_TIER, U);
        _trySwapMultihop(usdcToUPath, USDC_TO_SWAP, U_MIN_OUT, "swapUSDCtoU");

        IERC20(USDC).forceApprove(PANCAKE_V3_ROUTER, 0);

        uint256 leftover = IERC20(USDC).balanceOf(address(this));
        if (leftover > 0) {
            IERC20(USDC).safeTransfer(NORMAL_TIMELOCK, leftover);
        }

        emit ExecutedSwap();
    }

    /// @dev Soft-failing multihop V3 swap; output goes directly to PLP.
    function _trySwapMultihop(
        bytes memory path,
        uint256 amountIn,
        uint256 minOut,
        string memory label
    ) internal {
        IPancakeV3Router.ExactInputParams memory params = IPancakeV3Router.ExactInputParams({
            path: path,
            recipient: PRIME_LIQUIDITY_PROVIDER,
            deadline: block.timestamp + SWAP_DEADLINE_WINDOW,
            amountIn: amountIn,
            amountOutMinimum: minOut
        });
        try IPancakeV3Router(PANCAKE_V3_ROUTER).exactInput(params) returns (uint256) {} catch (bytes memory reason) {
            emit StepFailed(label, reason);
        }
    }

    // -------------------------------------------------------------------------
    // Internal phases
    // -------------------------------------------------------------------------

    function _acceptAllOwnerships() internal {
        // Buybacks (10): VIP transferred ownership from NormalTimelock to this helper.
        address[10] memory bb = _buybacks();
        for (uint256 i; i < bb.length; ) {
            _accept(bb[i]);
            unchecked {
                ++i;
            }
        }
        // Timelock-owned legacy converters (6).
        address[6] memory cv = _converters();
        for (uint256 i; i < cv.length; ) {
            _accept(cv[i]);
            unchecked {
                ++i;
            }
        }
    }

    function _accept(address contractAddress) internal {
        address pending = IOwnable2Step(contractAddress).pendingOwner();
        if (pending != address(this)) revert PendingOwnerMismatch(contractAddress, address(this), pending);
        IOwnable2Step(contractAddress).acceptOwnership();
    }

    function _selfGrantTransientAcmPermissions() internal {
        IACMForMigration acm = IACMForMigration(ACM);
        // PSR rewiring (used in `_rewireProtocolShareReserve`).
        acm.giveCallPermission(PSR, "addOrUpdateDistributionConfigs(DistributionConfig[])", address(this));
        acm.giveCallPermission(PSR, "removeDistributionConfig(Schema,address)", address(this));
        // pauseConversion on each timelock-owned converter.
        {
            address[6] memory cv = _converters();
            for (uint256 i; i < cv.length; ) {
                acm.giveCallPermission(cv[i], "pauseConversion()", address(this));
                unchecked {
                    ++i;
                }
            }
        }
        // Shortfall.pauseAuctions — paused alongside converters in step 3 because
        // it pulls from RiskFundV2, whose income path is being rewired.
        acm.giveCallPermission(SHORTFALL, "pauseAuctions()", address(this));
    }

    /// @dev Drains every legacy converter against the universal core-pool token
    ///      list. Each (converter, token, recipient) triple is a no-op when the
    ///      converter holds zero of `token` (`bal > 0` guard in `_sweepIfNonzero`).
    ///      Routing per logical mapping: RiskFundConverter -> RISK_FUND_BUYBACK;
    ///      the four PrimeConverters -> U_PRIME_BUYBACK (consolidating Prime
    ///      liquidity into U); XVSVaultConverter -> XVS_BUYBACK.
    function _drainAllConverters() internal {
        address[] memory tokens = _coreTokens();
        _drainConverter(RISK_FUND_CONVERTER, RISK_FUND_BUYBACK, tokens);
        _drainConverter(USDT_PRIME_CONVERTER, U_PRIME_BUYBACK, tokens);
        _drainConverter(USDC_PRIME_CONVERTER, U_PRIME_BUYBACK, tokens);
        _drainConverter(BTCB_PRIME_CONVERTER, U_PRIME_BUYBACK, tokens);
        _drainConverter(ETH_PRIME_CONVERTER, U_PRIME_BUYBACK, tokens);
        _drainConverter(XVS_VAULT_CONVERTER, XVS_BUYBACK, tokens);
    }

    function _drainConverter(
        address converter,
        address recipient,
        address[] memory tokens
    ) internal {
        uint256 len = tokens.length;
        for (uint256 i; i < len; ) {
            _sweepIfNonzero(converter, tokens[i], recipient);
            unchecked {
                ++i;
            }
        }
    }

    function _sweepIfNonzero(
        address converter,
        address token,
        address recipient
    ) internal {
        uint256 bal = IERC20(token).balanceOf(converter);
        if (bal > 0) {
            ITokenConverterForMigration(converter).sweepToken(token, recipient, bal);
        }
    }

    function _allowlistRoutersOnAllBuybacks() internal {
        address[10] memory buybacks = _buybacks();
        address[9] memory routers = [
            PANCAKE_ROUTER,
            PANCAKE_V3_ROUTER,
            PANCAKE_SMART_ROUTER,
            PANCAKE_UNIVERSAL_ROUTER,
            ONEINCH_ROUTER,
            UNIV2_SWAP_ROUTER_02,
            UNIV3_SWAP_ROUTER_02,
            UNIV4_SWAP_ROUTER,
            UNI_UNIVERSAL_ROUTER
        ];
        for (uint256 b; b < buybacks.length; ) {
            ITokenBuyback buyback = ITokenBuyback(buybacks[b]);
            for (uint256 r; r < routers.length; ) {
                buyback.setAllowedRouter(routers[r], true);
                unchecked {
                    ++r;
                }
            }
            unchecked {
                ++b;
            }
        }
    }

    function _grantOperatorPermissions() internal {
        IACMForMigration acm = IACMForMigration(ACM);
        address[10] memory buybacks = _buybacks();
        for (uint256 b; b < buybacks.length; ) {
            acm.giveCallPermission(
                buybacks[b],
                "executeBuyback(address,uint256,uint256,uint256,address,bytes,address)",
                OPERATOR
            );
            acm.giveCallPermission(buybacks[b], "forwardBaseAsset(address,uint256)", OPERATOR);
            unchecked {
                ++b;
            }
        }
    }

    /// @dev Pauses the legacy converters (token conversion) and Shortfall (RiskFund
    ///      auctions). Shortfall is included here because it pulls from RiskFundV2,
    ///      whose income path is being rewired by this migration: pausing auctions
    ///      until the new buyback flow lands the first USDT into RiskFundV2 prevents
    ///      Shortfall settlement from running short.
    function _pauseRevenueFlows() internal {
        address[6] memory cv = _converters();
        for (uint256 i; i < cv.length; ) {
            ITokenConverterForMigration(cv[i]).pauseConversion();
            unchecked {
                ++i;
            }
        }
        IShortfallForMigration(SHORTFALL).pauseAuctions();
    }

    /// @dev PSR enforces `distributionTargets.length <= maxLoopsLimit` (mainnet:
    ///      20) at the end of every `addOrUpdateDistributionConfigs` call. The
    ///      18 new rows would push pre-existing length 12 to 30 in one bundled
    ///      call, breaching the cap. This routine instead splits the rewrite
    ///      into phases and removes already-zero stale rows between adds, so
    ///      the array length stays ≤ 20 at every checkpoint while preserving
    ///      PSR's per-schema sum invariant (1e4 or 0) at the end of each add
    ///      call. Sequence (mainnet pre-state: schema0 sum=1e4 over 4 nonzero
    ///      + 4 zero rows; schema1 sum=1e4 over 3 nonzero + 1 zero row):
    ///        A. Remove 5 pre-existing zero rows               (length 12 → 7)
    ///        B. Schema 0: zero 4 stale + push 10 new          (length 7  → 17)
    ///        C. Remove 4 newly-zeroed schema 0 stale          (length 17 → 13)
    ///        D. Schema 1: zero {XVS_VAULT, RISK_FUND} + push
    ///           {XVS_BUYBACK, RISK_FUND_BUYBACK}              (length 13 → 15)
    ///        E. Remove 2 newly-zeroed schema 1 stale          (length 15 → 13)
    ///        F. Schema 1: zero VTREASURY + push 6 treasury    (length 13 → 19)
    ///        G. Remove zeroed VTREASURY schema 1              (length 19 → 18)
    function _rewireProtocolShareReserve() internal {
        IPsrForMigration psr = IPsrForMigration(PSR);

        // ---- Phase A: remove pre-existing zero stale rows (5) ----
        psr.removeDistributionConfig(0, USDC_PRIME_CONVERTER);
        psr.removeDistributionConfig(0, BTCB_PRIME_CONVERTER);
        psr.removeDistributionConfig(0, ETH_PRIME_CONVERTER);
        psr.removeDistributionConfig(0, WBNB_BURN_CONVERTER);
        psr.removeDistributionConfig(1, WBNB_BURN_CONVERTER);

        // ---- Phase B: schema 0 — zero 4 nonzero stale + push 10 new buybacks ----
        {
            IPsrForMigration.DistributionConfig[] memory s0 = new IPsrForMigration.DistributionConfig[](14);
            // updates (no push): drops 10000 from schema 0
            s0[0] = IPsrForMigration.DistributionConfig(0, 0, VTREASURY);
            s0[1] = IPsrForMigration.DistributionConfig(0, 0, USDT_PRIME_CONVERTER);
            s0[2] = IPsrForMigration.DistributionConfig(0, 0, RISK_FUND_CONVERTER);
            s0[3] = IPsrForMigration.DistributionConfig(0, 0, XVS_VAULT_CONVERTER);
            // pushes: adds 10000 to schema 0 (sum 10000 preserved)
            s0[4] = IPsrForMigration.DistributionConfig(0, 1200, U_TREASURY_BUYBACK);
            s0[5] = IPsrForMigration.DistributionConfig(0, 600, BTCB_TREASURY_BUYBACK);
            s0[6] = IPsrForMigration.DistributionConfig(0, 600, ETH_TREASURY_BUYBACK);
            s0[7] = IPsrForMigration.DistributionConfig(0, 600, USDT_TREASURY_BUYBACK);
            s0[8] = IPsrForMigration.DistributionConfig(0, 600, USDC_TREASURY_BUYBACK);
            s0[9] = IPsrForMigration.DistributionConfig(0, 400, XVS_TREASURY_BUYBACK);
            s0[10] = IPsrForMigration.DistributionConfig(0, 1000, USDT_PRIME_BUYBACK);
            s0[11] = IPsrForMigration.DistributionConfig(0, 1000, U_PRIME_BUYBACK);
            s0[12] = IPsrForMigration.DistributionConfig(0, 2000, RISK_FUND_BUYBACK);
            s0[13] = IPsrForMigration.DistributionConfig(0, 2000, XVS_BUYBACK);
            psr.addOrUpdateDistributionConfigs(s0);
        }

        // ---- Phase C: remove now-zero schema 0 stale rows (4) ----
        psr.removeDistributionConfig(0, VTREASURY);
        psr.removeDistributionConfig(0, USDT_PRIME_CONVERTER);
        psr.removeDistributionConfig(0, RISK_FUND_CONVERTER);
        psr.removeDistributionConfig(0, XVS_VAULT_CONVERTER);

        // ---- Phase D: schema 1 partial — replace 4000 (XVS_VAULT + RISK_FUND) ----
        {
            IPsrForMigration.DistributionConfig[] memory s1a = new IPsrForMigration.DistributionConfig[](4);
            s1a[0] = IPsrForMigration.DistributionConfig(1, 0, XVS_VAULT_CONVERTER);
            s1a[1] = IPsrForMigration.DistributionConfig(1, 0, RISK_FUND_CONVERTER);
            s1a[2] = IPsrForMigration.DistributionConfig(1, 2000, XVS_BUYBACK);
            s1a[3] = IPsrForMigration.DistributionConfig(1, 2000, RISK_FUND_BUYBACK);
            psr.addOrUpdateDistributionConfigs(s1a);
        }

        // ---- Phase E: remove now-zero schema 1 stale rows (2) ----
        psr.removeDistributionConfig(1, XVS_VAULT_CONVERTER);
        psr.removeDistributionConfig(1, RISK_FUND_CONVERTER);

        // ---- Phase F: schema 1 treasury — replace VTREASURY 6000 with 6 rows summing 6000 ----
        {
            IPsrForMigration.DistributionConfig[] memory s1b = new IPsrForMigration.DistributionConfig[](7);
            s1b[0] = IPsrForMigration.DistributionConfig(1, 0, VTREASURY);
            s1b[1] = IPsrForMigration.DistributionConfig(1, 1800, U_TREASURY_BUYBACK);
            s1b[2] = IPsrForMigration.DistributionConfig(1, 900, BTCB_TREASURY_BUYBACK);
            s1b[3] = IPsrForMigration.DistributionConfig(1, 900, ETH_TREASURY_BUYBACK);
            s1b[4] = IPsrForMigration.DistributionConfig(1, 900, USDT_TREASURY_BUYBACK);
            s1b[5] = IPsrForMigration.DistributionConfig(1, 900, USDC_TREASURY_BUYBACK);
            s1b[6] = IPsrForMigration.DistributionConfig(1, 600, XVS_TREASURY_BUYBACK);
            psr.addOrUpdateDistributionConfigs(s1b);
        }

        // ---- Phase G: remove now-zero VTREASURY schema 1 ----
        psr.removeDistributionConfig(1, VTREASURY);
    }

    function _revokeTransientAcmPermissions() internal {
        IACMForMigration acm = IACMForMigration(ACM);
        acm.revokeCallPermission(PSR, "addOrUpdateDistributionConfigs(DistributionConfig[])", address(this));
        acm.revokeCallPermission(PSR, "removeDistributionConfig(Schema,address)", address(this));
        {
            address[6] memory cv = _converters();
            for (uint256 i; i < cv.length; ) {
                acm.revokeCallPermission(cv[i], "pauseConversion()", address(this));
                unchecked {
                    ++i;
                }
            }
        }
        acm.revokeCallPermission(SHORTFALL, "pauseAuctions()", address(this));
    }

    function _handBackBuybackOwnership() internal {
        address[10] memory bb = _buybacks();
        for (uint256 i; i < bb.length; ) {
            IOwnable2Step(bb[i]).transferOwnership(NORMAL_TIMELOCK);
            unchecked {
                ++i;
            }
        }
    }

    function _handBackConverterOwnership() internal {
        address[6] memory cv = _converters();
        for (uint256 i; i < cv.length; ) {
            IOwnable2Step(cv[i]).transferOwnership(NORMAL_TIMELOCK);
            unchecked {
                ++i;
            }
        }
    }

    /// @dev Shared 10-buyback list. Pure function (not storage) keeps the
    ///      address constants `address private constant` while letting three
    ///      callers reuse the same in-memory array instead of inlining the
    ///      literal three times (significant bytecode saving).
    function _buybacks() internal pure returns (address[10] memory buybacks) {
        buybacks = [
            RISK_FUND_BUYBACK,
            USDT_PRIME_BUYBACK,
            U_PRIME_BUYBACK,
            XVS_BUYBACK,
            U_TREASURY_BUYBACK,
            BTCB_TREASURY_BUYBACK,
            ETH_TREASURY_BUYBACK,
            USDT_TREASURY_BUYBACK,
            USDC_TREASURY_BUYBACK,
            XVS_TREASURY_BUYBACK
        ];
    }

    /// @dev Shared 6-converter list (timelock-owned legacy converters).
    function _converters() internal pure returns (address[6] memory converters) {
        converters = [
            RISK_FUND_CONVERTER,
            USDT_PRIME_CONVERTER,
            USDC_PRIME_CONVERTER,
            BTCB_PRIME_CONVERTER,
            ETH_PRIME_CONVERTER,
            XVS_VAULT_CONVERTER
        ];
    }

    /// @dev The universal BSC core-pool ERC20 list. Order is irrelevant: every
    ///      entry is independently checked against each converter's live balance.
    function _coreTokens() internal pure returns (address[] memory tokens) {
        tokens = new address[](47);
        // Stables / fiat-pegged (11)
        tokens[0] = 0x55d398326f99059fF775485246999027B3197955; // USDT
        tokens[1] = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d; // USDC
        tokens[2] = 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56; // BUSD
        tokens[3] = 0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3; // DAI
        tokens[4] = 0x40af3827F39D0EAcBF4A168f8D4ee67c121D11c9; // TUSD
        tokens[5] = 0x14016E85a25aeb13065688cAFB43044C2ef86784; // TUSDOLD
        tokens[6] = 0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409; // FDUSD
        tokens[7] = 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34; // USDe
        tokens[8] = 0x211Cc4DD073734dA055fbF44a2b4667d5E5fE5d2; // sUSDe
        tokens[9] = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d; // USD1
        tokens[10] = 0x0782b6d8c4551B9760e74c0545a9bCD90bdc41E5; // lisUSD
        // L1 / L2 majors (26)
        tokens[11] = 0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c; // BTCB
        tokens[12] = 0x2170Ed0880ac9A755fd29B2688956BD959F933F8; // ETH
        tokens[13] = 0x4338665CBB7B2485A8855A139b75D5e34AB0DB94; // LTC
        tokens[14] = 0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE; // XRP
        tokens[15] = 0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf; // BCH
        tokens[16] = 0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402; // DOT
        tokens[17] = 0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD; // LINK
        tokens[18] = 0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153; // FIL
        tokens[19] = 0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47; // ADA
        tokens[20] = 0xbA2aE424d960c26247Dd6c32edC70B295c744C43; // DOGE
        tokens[21] = 0xCC42724C6683B7E57334c4E856f4c9965ED682bD; // MATIC
        tokens[22] = 0xCE7de646e7208a4Ef112cb6ed5038FA6cC6b12e3; // TRX
        tokens[23] = 0x85EAC5Ac2F758618dFa09bDbe0cf174e7d574D5B; // TRXOLD
        tokens[24] = 0x570A5D26f7765Ecb712C0924E4De545B89fD43dF; // SOL
        tokens[25] = 0xBf5140A22578168FD562DCcF235E5D43A02ce9B1; // UNI
        tokens[26] = 0xfb6115445Bff7b52FeB98650C87f44907E58f802; // AAVE
        tokens[27] = 0x47BEAd2563dCBf3bF2c9407fEa4dC236fAbA485A; // SXP
        tokens[28] = 0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63; // XVS
        tokens[29] = 0x20bff4bbEDa07536FF00e073bd8359E5D80D733d; // CAN
        tokens[30] = 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82; // CAKE
        tokens[31] = 0x4B0F1812e5Df2A09796481Ff14017e6005508003; // TWT
        tokens[32] = 0xF4C8E32EaDEC4BFe97E0F595AdD0f4450a863a11; // THE
        tokens[33] = 0xcE24439F2D9C6a2289F741120FE202248B666666; // U
        tokens[34] = 0x23AE4fd8E7844cdBc97775496eBd0E8248656028; // XAUM
        tokens[35] = 0x3d4350cD54aeF9f9b2C29435e0fa809957B3F30a; // UST
        tokens[36] = 0x156ab3346823B651294766e23e6Cf87254d68962; // LUNA
        // BNB-related / liquid staking (5)
        tokens[37] = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c; // WBNB
        tokens[38] = 0x250632378E573c6Be1AC2f97Fcdf00515d0Aa91B; // BETH
        tokens[39] = 0xa2E3356610840701BDf5611a53974510Ae27E2e1; // WBETH
        tokens[40] = 0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B; // slisBNB
        tokens[41] = 0x77734e70b6E88b4d82fE632a168EDf6e700912b6; // asBNB
        // BTC LSTs + Pendle PT (5)
        tokens[42] = 0x4aae823a6a0b376De6A78e74eCC5b079d38cBCf7; // SolvBTC
        tokens[43] = 0x1346b618dC92810EC74163e4c27004c921D446a5; // xSolvBTC
        tokens[44] = 0xDD809435ba6c9d6903730f923038801781cA66ce; // PT_sUSDE_26JUN2025
        tokens[45] = 0x607C834cfb7FCBbb341Cbe23f77A6E83bCf3F55c; // PT_USDe_30OCT2025
        tokens[46] = 0xe052823b4aefc6e230FAf46231A57d0905E30AE0; // PT_clisBNB_25JUN2026
    }
}
