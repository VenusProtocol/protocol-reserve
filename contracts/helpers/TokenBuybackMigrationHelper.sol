// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

/// @title TokenBuybackMigrationHelper
/// @notice One-shot helper that migrates the Venus Token Converter system to the new
///         TokenBuyback proxies in a single atomic transaction. Replaces ~170 raw VIP
///         commands with one `execute()` call gated by NormalTimelock.
///
/// @dev    Trust model
///         -----------
///         The wrapping VIP performs three preparatory actions:
///           (1) `acceptOwnership()` on each of the 10 buyback proxies (timelock claims
///               them from the deploy script's `pendingOwner = NormalTimelock`).
///           (2) `transferOwnership(helper)` on each of the 10 buybacks plus the 6
///               timelock-owned legacy converters (16 contracts total).
///           (3) `grantRole(DEFAULT_ADMIN_ROLE, helper)` on the AccessControlManager.
///         `execute()` then runs end-to-end: accepts ownership of all 16 contracts,
///         drains converters, configures buybacks, fans out ACM grants, pauses
///         converters, repoints PSR distributions, transfers all ownership back to
///         NormalTimelock, and finally renounces its own ACM admin role. After return
///         the helper holds no privileges and no balances, and a second call reverts.
///
///         Single-chain (BSC mainnet) one-shot. Every address is hardcoded as a
///         `constant`; redeploy the helper if any address changes.
contract TokenBuybackMigrationHelper is ReentrancyGuard {
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

    // ----- New TokenBuyback proxies -----
    address private constant RISK_FUND_BUYBACK = address(0); // TODO: fill before deploy
    address private constant USDT_PRIME_BUYBACK = address(0); // TODO: fill before deploy
    address private constant U_PRIME_BUYBACK = address(0); // TODO: fill before deploy
    address private constant XVS_BUYBACK = address(0); // TODO: fill before deploy
    address private constant U_TREASURY_BUYBACK = address(0); // TODO: fill before deploy
    address private constant BTCB_TREASURY_BUYBACK = address(0); // TODO: fill before deploy
    address private constant ETH_TREASURY_BUYBACK = address(0); // TODO: fill before deploy
    address private constant USDT_TREASURY_BUYBACK = address(0); // TODO: fill before deploy
    address private constant USDC_TREASURY_BUYBACK = address(0); // TODO: fill before deploy
    address private constant XVS_TREASURY_BUYBACK = address(0); // TODO: fill before deploy

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

    bool public executed;

    event Executed();

    error NotTimelock();
    error AlreadyExecuted();
    error PendingOwnerMismatch(address contractAddress, address expected, address actual);

    /// @notice Executes the full migration. Callable exactly once, by NormalTimelock.
    function execute() external nonReentrant {
        if (msg.sender != NORMAL_TIMELOCK) revert NotTimelock();
        if (executed) revert AlreadyExecuted();
        executed = true;

        // Step 1: claim ownership of every contract whose `pendingOwner` is set
        //         to this helper (10 buybacks + 6 timelock-owned converters).
        _acceptAllOwnerships();

        // Step 2: self-grant transient ACM permissions for the ACM-checked
        //         calls below (`pauseConversion`, PSR add/remove). Revoked in
        //         step 8.
        _selfGrantTransientAcmPermissions();

        // Step 3: sweep every non-zero core-pool ERC20 balance off each
        //         timelock-owned converter into its replacement buyback.
        _drainAllConverters();

        // Step 4: allowlist the 9 swap routers on each of the 10 buybacks so
        //         the cron operator can route via the best execution venue.
        _allowlistRoutersOnAllBuybacks();

        // Step 5: grant the cron operator `executeBuyback` and
        //         `forwardBaseAsset` permissions on each of the 10 buybacks.
        _grantOperatorPermissions();

        // Step 6: pause every timelock-owned legacy converter, closing the
        //         only sensitive surface (token conversion).
        _pauseAllTimelockOwnedConverters();

        // Step 7: repoint ProtocolShareReserve distributions from legacy
        //         converters and the VTreasury direct destination to the 10
        //         new buybacks; the 18 new rows + 12 zero-stale rows land in
        //         a single `addOrUpdateDistributionConfigs` call so PSR's
        //         per-schema sum invariant (1e4 or 0) holds atomically, then
        //         `removeDistributionConfig` deletes the zeroed entries.
        _rewireProtocolShareReserve();

        // Step 8: revoke the transient ACM permissions self-granted in step 2.
        _revokeTransientAcmPermissions();

        // Step 9: transfer ownership of all 16 contracts back to NormalTimelock
        //         (the wrapping VIP calls `acceptOwnership` on each).
        _handBackOwnership();

        // Step 10: relinquish the helper's `DEFAULT_ADMIN_ROLE` on the ACM so
        //          no residual privilege survives this transaction.
        IACMForMigration(ACM).renounceRole(DEFAULT_ADMIN_ROLE, address(this));

        emit Executed();
    }

    // -------------------------------------------------------------------------
    // Internal phases
    // -------------------------------------------------------------------------

    function _acceptAllOwnerships() internal {
        // Buybacks (10): VIP transferred ownership from NormalTimelock to this helper.
        _accept(RISK_FUND_BUYBACK);
        _accept(USDT_PRIME_BUYBACK);
        _accept(U_PRIME_BUYBACK);
        _accept(XVS_BUYBACK);
        _accept(U_TREASURY_BUYBACK);
        _accept(BTCB_TREASURY_BUYBACK);
        _accept(ETH_TREASURY_BUYBACK);
        _accept(USDT_TREASURY_BUYBACK);
        _accept(USDC_TREASURY_BUYBACK);
        _accept(XVS_TREASURY_BUYBACK);

        // Timelock-owned legacy converters (6).
        _accept(RISK_FUND_CONVERTER);
        _accept(USDT_PRIME_CONVERTER);
        _accept(USDC_PRIME_CONVERTER);
        _accept(BTCB_PRIME_CONVERTER);
        _accept(ETH_PRIME_CONVERTER);
        _accept(XVS_VAULT_CONVERTER);
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
        acm.giveCallPermission(RISK_FUND_CONVERTER, "pauseConversion()", address(this));
        acm.giveCallPermission(USDT_PRIME_CONVERTER, "pauseConversion()", address(this));
        acm.giveCallPermission(USDC_PRIME_CONVERTER, "pauseConversion()", address(this));
        acm.giveCallPermission(BTCB_PRIME_CONVERTER, "pauseConversion()", address(this));
        acm.giveCallPermission(ETH_PRIME_CONVERTER, "pauseConversion()", address(this));
        acm.giveCallPermission(XVS_VAULT_CONVERTER, "pauseConversion()", address(this));
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
        address[10] memory buybacks = [
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
        address[10] memory buybacks = [
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

    function _pauseAllTimelockOwnedConverters() internal {
        ITokenConverterForMigration(RISK_FUND_CONVERTER).pauseConversion();
        ITokenConverterForMigration(USDT_PRIME_CONVERTER).pauseConversion();
        ITokenConverterForMigration(USDC_PRIME_CONVERTER).pauseConversion();
        ITokenConverterForMigration(BTCB_PRIME_CONVERTER).pauseConversion();
        ITokenConverterForMigration(ETH_PRIME_CONVERTER).pauseConversion();
        ITokenConverterForMigration(XVS_VAULT_CONVERTER).pauseConversion();
    }

    function _rewireProtocolShareReserve() internal {
        IPsrForMigration psr = IPsrForMigration(PSR);

        // 18 new buyback rows + 12 stale rows zeroed atomically. The PSR's
        // `_ensurePercentages()` validates the per-schema sum (1e4 or 0) at the end
        // of this single call; bundling new + zeroing in one batch keeps the
        // invariant valid.
        IPsrForMigration.DistributionConfig[] memory configs = new IPsrForMigration.DistributionConfig[](30);

        // ---- Schema 0 (PROTOCOL_RESERVES = spread) — sums to 10000 ----
        // treasury group total: 4000 (was VTREASURY 4000)
        configs[0] = IPsrForMigration.DistributionConfig(0, 1200, U_TREASURY_BUYBACK);
        configs[1] = IPsrForMigration.DistributionConfig(0, 600, BTCB_TREASURY_BUYBACK);
        configs[2] = IPsrForMigration.DistributionConfig(0, 600, ETH_TREASURY_BUYBACK);
        configs[3] = IPsrForMigration.DistributionConfig(0, 600, USDT_TREASURY_BUYBACK);
        configs[4] = IPsrForMigration.DistributionConfig(0, 600, USDC_TREASURY_BUYBACK);
        configs[5] = IPsrForMigration.DistributionConfig(0, 400, XVS_TREASURY_BUYBACK);
        // prime group total: 2000 (was USDT_PRIME_CONVERTER 2000)
        configs[6] = IPsrForMigration.DistributionConfig(0, 1000, USDT_PRIME_BUYBACK);
        configs[7] = IPsrForMigration.DistributionConfig(0, 1000, U_PRIME_BUYBACK);
        // riskFund group total: 2000
        configs[8] = IPsrForMigration.DistributionConfig(0, 2000, RISK_FUND_BUYBACK);
        // xvsStore group total: 2000
        configs[9] = IPsrForMigration.DistributionConfig(0, 2000, XVS_BUYBACK);

        // ---- Schema 1 (ADDITIONAL_REVENUE = liquidation) — sums to 10000 ----
        configs[10] = IPsrForMigration.DistributionConfig(1, 1800, U_TREASURY_BUYBACK);
        configs[11] = IPsrForMigration.DistributionConfig(1, 900, BTCB_TREASURY_BUYBACK);
        configs[12] = IPsrForMigration.DistributionConfig(1, 900, ETH_TREASURY_BUYBACK);
        configs[13] = IPsrForMigration.DistributionConfig(1, 900, USDT_TREASURY_BUYBACK);
        configs[14] = IPsrForMigration.DistributionConfig(1, 900, USDC_TREASURY_BUYBACK);
        configs[15] = IPsrForMigration.DistributionConfig(1, 600, XVS_TREASURY_BUYBACK);
        configs[16] = IPsrForMigration.DistributionConfig(1, 2000, RISK_FUND_BUYBACK);
        configs[17] = IPsrForMigration.DistributionConfig(1, 2000, XVS_BUYBACK);

        // ---- Stale rows zeroed (12) ----
        configs[18] = IPsrForMigration.DistributionConfig(0, 0, VTREASURY);
        configs[19] = IPsrForMigration.DistributionConfig(0, 0, XVS_VAULT_CONVERTER);
        configs[20] = IPsrForMigration.DistributionConfig(0, 0, USDT_PRIME_CONVERTER);
        configs[21] = IPsrForMigration.DistributionConfig(0, 0, RISK_FUND_CONVERTER);
        configs[22] = IPsrForMigration.DistributionConfig(0, 0, USDC_PRIME_CONVERTER);
        configs[23] = IPsrForMigration.DistributionConfig(0, 0, BTCB_PRIME_CONVERTER);
        configs[24] = IPsrForMigration.DistributionConfig(0, 0, ETH_PRIME_CONVERTER);
        configs[25] = IPsrForMigration.DistributionConfig(0, 0, WBNB_BURN_CONVERTER);
        configs[26] = IPsrForMigration.DistributionConfig(1, 0, VTREASURY);
        configs[27] = IPsrForMigration.DistributionConfig(1, 0, XVS_VAULT_CONVERTER);
        configs[28] = IPsrForMigration.DistributionConfig(1, 0, RISK_FUND_CONVERTER);
        configs[29] = IPsrForMigration.DistributionConfig(1, 0, WBNB_BURN_CONVERTER);

        psr.addOrUpdateDistributionConfigs(configs);

        // Delete the zeroed array entries so the on-chain `distributionTargets` length
        // shrinks back to the new-rows-only count.
        for (uint256 i = 18; i < 30; ) {
            psr.removeDistributionConfig(configs[i].schema, configs[i].destination);
            unchecked {
                ++i;
            }
        }
    }

    function _revokeTransientAcmPermissions() internal {
        IACMForMigration acm = IACMForMigration(ACM);
        acm.revokeCallPermission(PSR, "addOrUpdateDistributionConfigs(DistributionConfig[])", address(this));
        acm.revokeCallPermission(PSR, "removeDistributionConfig(Schema,address)", address(this));
        acm.revokeCallPermission(RISK_FUND_CONVERTER, "pauseConversion()", address(this));
        acm.revokeCallPermission(USDT_PRIME_CONVERTER, "pauseConversion()", address(this));
        acm.revokeCallPermission(USDC_PRIME_CONVERTER, "pauseConversion()", address(this));
        acm.revokeCallPermission(BTCB_PRIME_CONVERTER, "pauseConversion()", address(this));
        acm.revokeCallPermission(ETH_PRIME_CONVERTER, "pauseConversion()", address(this));
        acm.revokeCallPermission(XVS_VAULT_CONVERTER, "pauseConversion()", address(this));
    }

    function _handBackOwnership() internal {
        IOwnable2Step(RISK_FUND_BUYBACK).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(USDT_PRIME_BUYBACK).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(U_PRIME_BUYBACK).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(XVS_BUYBACK).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(U_TREASURY_BUYBACK).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(BTCB_TREASURY_BUYBACK).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(ETH_TREASURY_BUYBACK).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(USDT_TREASURY_BUYBACK).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(USDC_TREASURY_BUYBACK).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(XVS_TREASURY_BUYBACK).transferOwnership(NORMAL_TIMELOCK);

        IOwnable2Step(RISK_FUND_CONVERTER).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(USDT_PRIME_CONVERTER).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(USDC_PRIME_CONVERTER).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(BTCB_PRIME_CONVERTER).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(ETH_PRIME_CONVERTER).transferOwnership(NORMAL_TIMELOCK);
        IOwnable2Step(XVS_VAULT_CONVERTER).transferOwnership(NORMAL_TIMELOCK);
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
