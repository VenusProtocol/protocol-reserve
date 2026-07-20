// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

/// @title TreasuryTokenBuybackDistributor
/// @author Venus
/// @notice One-shot helper used by the "Venus Treasury Cleanup" VIP. Governance withdraws
///         miscellaneous treasury tokens into this contract and then calls `distribute`,
///         which splits each token's *live* balance across the six Treasury `TokenBuyback`
///         contracts by a fixed weight. Because the split is computed from `balanceOf(this)`
///         at execution time, no per-token amount is hardcoded in the VIP: the ratios
///         self-adjust if balances change between authoring and execution.
/// @dev The contract holds no privileged role over the treasury and can only move tokens
///      that are explicitly transferred to it, to a fixed set of verified, immutable
///      destinations. `distribute` is therefore permissionless (griefing-free): the worst a
///      caller can do is forward the contract's own balance to the pre-aligned buybacks.
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract TreasuryTokenBuybackDistributor {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Denominator for the weight basis points
    uint256 public constant MAX_BPS = 10_000;

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

    /// @notice Emitted once per token after it has been fully distributed
    /// @param token The token distributed
    /// @param totalAmount The balance held for `token` at the start of distribution
    event TokenDistributed(address indexed token, uint256 totalAmount);

    /// @notice Thrown when the configured weights do not sum to MAX_BPS
    error WeightsMisconfigured(uint256 sum);

    /// @param btcbBuyback_ BTCB Treasury TokenBuyback contract
    /// @param ethBuyback_ ETH Treasury TokenBuyback contract
    /// @param xvsBuyback_ XVS Treasury TokenBuyback contract
    /// @param usdtBuyback_ USDT Treasury TokenBuyback contract
    /// @param usdcBuyback_ USDC Treasury TokenBuyback contract
    /// @param uBuyback_ U Treasury TokenBuyback contract
    constructor(
        address btcbBuyback_,
        address ethBuyback_,
        address xvsBuyback_,
        address usdtBuyback_,
        address usdcBuyback_,
        address uBuyback_
    ) {
        ensureNonzeroAddress(btcbBuyback_);
        ensureNonzeroAddress(ethBuyback_);
        ensureNonzeroAddress(xvsBuyback_);
        ensureNonzeroAddress(usdtBuyback_);
        ensureNonzeroAddress(usdcBuyback_);
        ensureNonzeroAddress(uBuyback_);

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
