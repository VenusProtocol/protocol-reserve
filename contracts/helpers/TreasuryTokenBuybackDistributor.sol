// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracleInterface } from "@venusprotocol/oracle/contracts/interfaces/OracleInterface.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { IPegStability } from "../Interfaces/IPegStability.sol";

/// @title TreasuryTokenBuybackDistributor
/// @author Venus
/// @notice One-shot helper used by the "Venus Treasury Cleanup" VIP. Governance withdraws
///         miscellaneous treasury tokens into this contract and then calls `distribute`,
///         which splits each token's *live* balance across the six Treasury `TokenBuyback`
///         contracts by a fixed weight. Because the split is computed from `balanceOf(this)`
///         at execution time, no per-token amount is hardcoded in the VIP: the ratios
///         self-adjust if balances change between authoring and execution.
///
///         VAI is handled specially: rather than DEX-swapping the treasury's VAI out of the
///         thin VAI market via the buybacks, `convertVaiViaPsm` first redeems it 1:1 (minus
///         the PSM fee) for USDT at the VAI Peg Stability Module. The resulting USDT is then
///         distributed across the same six buybacks by the same weights, so the VAI value keeps
///         its intended per-buyback allocation but reaches the base assets through USDT's deep
///         liquidity (and the USDT-buyback leg needs no swap at all).
/// @dev The contract holds no privileged role over the treasury and can only move tokens
///      that are explicitly transferred to it, to a fixed set of verified, immutable
///      destinations. `distribute` and `convertVaiViaPsm` are therefore permissionless
///      (griefing-free): the worst a caller can do is forward the contract's own balance to the
///      pre-aligned buybacks, or redeem its own VAI for USDT at the oracle-pegged PSM rate.
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract TreasuryTokenBuybackDistributor {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Denominator for the weight basis points. Also the PSM's own basis-points divisor.
    uint256 public constant MAX_BPS = 10_000;

    /// @notice 1e18 fixed-point one, matching the PSM's MANTISSA_ONE used when pricing the stable token
    uint256 internal constant MANTISSA_ONE = 1e18;

    /// @notice Share of each token routed to the BTCB buyback (15%)
    uint256 public constant BTCB_WEIGHT = 1_500;

    /// @notice Share of each token routed to the ETH buyback (15%)
    uint256 public constant ETH_WEIGHT = 1_500;

    /// @notice Share of each token routed to the XVS buyback (10%)
    uint256 public constant XVS_WEIGHT = 1_000;

    /// @notice Share of each token routed to the USDT buyback (15%)
    uint256 public constant USDT_WEIGHT = 1_500;

    /// @notice Share of each token routed to the USDC buyback (15%)
    uint256 public constant USDC_WEIGHT = 1_500;

    /// @notice Share of each token routed to the U buyback (30%). The U buyback receives the
    ///         re-read remaining balance rather than a computed share, so it also absorbs the
    ///         integer-division dust from the five weighted legs above.
    uint256 public constant U_WEIGHT = 3_000;

    /// @notice BTCB Treasury TokenBuyback contract
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable BTCB_BUYBACK;

    /// @notice ETH Treasury TokenBuyback contract
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable ETH_BUYBACK;

    /// @notice XVS Treasury TokenBuyback contract
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable XVS_BUYBACK;

    /// @notice USDT Treasury TokenBuyback contract
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable USDT_BUYBACK;

    /// @notice USDC Treasury TokenBuyback contract
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable USDC_BUYBACK;

    /// @notice U Treasury TokenBuyback contract (receives the remainder leg)
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable U_BUYBACK;

    /// @notice VAI token. Converted to USDT via the PSM before distribution rather than
    ///         DEX-swapped out of its thin market by the buybacks.
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable VAI;

    /// @notice VAI Peg Stability Module (PegStability_USDT). Redeems VAI for its stable token
    ///         (USDT) at the oracle-pegged rate minus the PSM's outgoing fee.
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable VAI_PSM;

    /// @notice The PSM's stable token (USDT). Output of `convertVaiViaPsm`; then distributed
    ///         across the six buybacks like any other token.
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable STABLE_TOKEN;

    /// @notice Emitted once per token after it has been fully distributed
    /// @param token The token distributed
    /// @param totalAmount The balance held for `token` at the start of distribution
    event TokenDistributed(address indexed token, uint256 totalAmount);

    /// @notice Emitted after VAI has been redeemed for the PSM stable token
    /// @param vaiIn The VAI balance consumed by the PSM swap (burnt + fee)
    /// @param stableOut The stable-token amount received from the PSM
    event VaiConvertedViaPsm(uint256 vaiIn, uint256 stableOut);

    /// @notice Thrown when the configured weights do not sum to MAX_BPS
    error WeightsMisconfigured(uint256 sum);

    /// @notice Thrown when `_convertVaiViaPsm` is called by anyone other than this contract
    error OnlySelf();

    /// @param btcbBuyback_ BTCB Treasury TokenBuyback contract
    /// @param ethBuyback_ ETH Treasury TokenBuyback contract
    /// @param xvsBuyback_ XVS Treasury TokenBuyback contract
    /// @param usdtBuyback_ USDT Treasury TokenBuyback contract
    /// @param usdcBuyback_ USDC Treasury TokenBuyback contract
    /// @param uBuyback_ U Treasury TokenBuyback contract
    /// @param vai_ VAI token
    /// @param vaiPsm_ VAI Peg Stability Module (PegStability_USDT)
    /// @param stableToken_ The PSM's stable token (USDT), received from VAI redemptions
    constructor(
        address btcbBuyback_,
        address ethBuyback_,
        address xvsBuyback_,
        address usdtBuyback_,
        address usdcBuyback_,
        address uBuyback_,
        address vai_,
        address vaiPsm_,
        address stableToken_
    ) {
        ensureNonzeroAddress(btcbBuyback_);
        ensureNonzeroAddress(ethBuyback_);
        ensureNonzeroAddress(xvsBuyback_);
        ensureNonzeroAddress(usdtBuyback_);
        ensureNonzeroAddress(usdcBuyback_);
        ensureNonzeroAddress(uBuyback_);
        ensureNonzeroAddress(vai_);
        ensureNonzeroAddress(vaiPsm_);
        ensureNonzeroAddress(stableToken_);

        uint256 weightSum = BTCB_WEIGHT + ETH_WEIGHT + XVS_WEIGHT + USDT_WEIGHT + USDC_WEIGHT + U_WEIGHT;
        if (weightSum != MAX_BPS) {
            revert WeightsMisconfigured(weightSum);
        }

        BTCB_BUYBACK = btcbBuyback_;
        ETH_BUYBACK = ethBuyback_;
        XVS_BUYBACK = xvsBuyback_;
        USDT_BUYBACK = usdtBuyback_;
        USDC_BUYBACK = usdcBuyback_;
        U_BUYBACK = uBuyback_;
        VAI = vai_;
        VAI_PSM = vaiPsm_;
        STABLE_TOKEN = stableToken_;
    }

    /// @notice Splits the contract's live balance of each supplied token across the six
    ///         Treasury buybacks by the fixed weights. Tokens with a zero balance are skipped.
    /// @dev For each token the five weighted legs (BTCB, ETH, XVS, USDT, USDC) transfer
    ///      `balance * weight / MAX_BPS`, then the U buyback receives the re-read remaining
    ///      balance. Reading the remainder rather than computing U's share guarantees the
    ///      contract ends at zero for every token and absorbs integer-division dust as well as
    ///      any fee-on-transfer wobble on the intermediate legs.
    /// @param tokens The tokens to distribute (order irrelevant; duplicates are harmless no-ops
    ///        after the first pass since the balance is then zero)
    /// @custom:event TokenDistributed emitted per non-zero-balance token
    function distribute(address[] calldata tokens) external {
        uint256 length = tokens.length;
        for (uint256 i; i < length; ) {
            _distributeToken(tokens[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Redeems the contract's entire VAI balance for the PSM stable token (USDT) at the
    ///         VAI Peg Stability Module, so the treasury's VAI reaches the base assets through
    ///         USDT's deep liquidity instead of being DEX-swapped out of the thin VAI market.
    ///         The received USDT is left on the contract and split across the six buybacks by the
    ///         usual weights when `distribute` is called with the stable token in its list.
    /// @dev Best-effort by design: the actual PSM interaction runs in `_convertVaiViaPsm` behind a
    ///      try/catch, so a paused PSM, insufficient PSM liquidity / minted headroom, or a stale
    ///      oracle can never brick the proposal — the VAI simply stays on the contract and is
    ///      distributed as a plain ERC20 by `distribute`. No per-token amount is hardcoded: the
    ///      redeemed size is derived from the live VAI balance, the live PSM fee, and the live
    ///      oracle price. No-op when the contract holds no VAI.
    /// @custom:event VaiConvertedViaPsm emitted on a successful redemption
    function convertVaiViaPsm() external {
        // slither-disable-next-line unused-return
        try this._convertVaiViaPsm() {
            // handled inside the sub-call (emits VaiConvertedViaPsm)
        } catch {
            // PSM unavailable — leave VAI in place for plain distribution
        }
    }

    /// @notice Internal implementation of the VAI→USDT redemption, exposed as an external
    ///         function only so `convertVaiViaPsm` can wrap it in try/catch. Restricted to self.
    /// @dev Sizes the swap so the required VAI (burnt amount + PSM fee) never exceeds the held
    ///      balance: `stableOut = balance * MAX_BPS * 1e18 / ((MAX_BPS + feeOut) * priceOut)`,
    ///      floored, where `priceOut = max(ONE_DOLLAR, oraclePrice)` mirrors the PSM's OUT-direction
    ///      pricing. Any sub-wei VAI remainder left by the flooring is distributed as a plain ERC20.
    function _convertVaiViaPsm() external {
        if (msg.sender != address(this)) {
            revert OnlySelf();
        }

        IERC20Upgradeable vai = IERC20Upgradeable(VAI);
        uint256 vaiBalance = vai.balanceOf(address(this));
        if (vaiBalance == 0) {
            return;
        }

        IPegStability psm = IPegStability(VAI_PSM);
        uint256 feeOut = psm.feeOut();
        uint256 oneDollar = psm.ONE_DOLLAR();
        uint256 price = ResilientOracleInterface(psm.oracle()).getPrice(STABLE_TOKEN);
        // PSM prices an outgoing (VAI→stable) swap at MAX(1$, oraclePrice).
        uint256 priceOut = price > oneDollar ? price : oneDollar;

        // Largest stable-out that keeps (stableUSD + fee) <= vaiBalance. Flooring on every step
        // guarantees the PSM's own `NotEnoughVAI` check passes, so the try never has to catch a
        // sizing error — only genuine PSM unavailability.
        uint256 stableOut = (vaiBalance * MAX_BPS * MANTISSA_ONE) / ((MAX_BPS + feeOut) * priceOut);
        if (stableOut == 0) {
            return;
        }

        // The PSM burns `stableUSD` VAI from this contract and pulls `fee` VAI via transferFrom;
        // VAI decrements the allowance on burn as well, so approve the full held balance.
        vai.forceApprove(VAI_PSM, vaiBalance);
        psm.swapVAIForStable(address(this), stableOut);
        vai.forceApprove(VAI_PSM, 0);

        uint256 vaiConsumed = vaiBalance - vai.balanceOf(address(this));
        emit VaiConvertedViaPsm(vaiConsumed, stableOut);
    }

    /// @dev Distributes a single token's full balance across the six buybacks.
    function _distributeToken(address token) internal {
        IERC20Upgradeable erc20 = IERC20Upgradeable(token);
        uint256 balance = erc20.balanceOf(address(this));
        if (balance == 0) {
            return;
        }

        erc20.safeTransfer(BTCB_BUYBACK, (balance * BTCB_WEIGHT) / MAX_BPS);
        erc20.safeTransfer(ETH_BUYBACK, (balance * ETH_WEIGHT) / MAX_BPS);
        erc20.safeTransfer(XVS_BUYBACK, (balance * XVS_WEIGHT) / MAX_BPS);
        erc20.safeTransfer(USDT_BUYBACK, (balance * USDT_WEIGHT) / MAX_BPS);
        erc20.safeTransfer(USDC_BUYBACK, (balance * USDC_WEIGHT) / MAX_BPS);

        // U buyback receives whatever remains, absorbing rounding dust so the contract
        // ends at a zero balance for this token.
        erc20.safeTransfer(U_BUYBACK, erc20.balanceOf(address(this)));

        emit TokenDistributed(token, balance);
    }
}
