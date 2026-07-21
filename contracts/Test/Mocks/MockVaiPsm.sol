// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { MockVAI } from "./MockVAI.sol";

/// @notice Test double for the VAI Peg Stability Module. Reproduces `swapVAIForStable` faithfully
///         enough to exercise `TreasuryTokenBuybackDistributor.convertVaiViaPsm`: it prices the
///         swap at MAX(ONE_DOLLAR, price), charges `feeOut` bps, requires the caller to hold and
///         approve the burnt amount + fee in VAI, and pays out the stable token from its own
///         reserves. Also serves as its own oracle (`oracle()` returns `address(this)`).
contract MockVaiPsm {
    uint256 public constant BASIS_POINTS_DIVISOR = 10_000;
    uint256 public constant MANTISSA_ONE = 1e18;

    MockVAI public immutable vaiToken;
    address public immutable STABLE_TOKEN_ADDRESS;
    uint256 public immutable ONE_DOLLAR;

    address public venusTreasury;
    uint256 public feeOut;
    uint256 public price;
    bool public forceRevert;

    error PsmForcedRevert();
    error NotEnoughVAI();

    constructor(
        address vai_,
        address stable_,
        address treasury_,
        uint256 feeOut_,
        uint256 price_
    ) {
        vaiToken = MockVAI(vai_);
        STABLE_TOKEN_ADDRESS = stable_;
        venusTreasury = treasury_;
        feeOut = feeOut_;
        price = price_;
        ONE_DOLLAR = MANTISSA_ONE; // matches an 18-decimal stable token (USDT)
    }

    function setForceRevert(bool value) external {
        forceRevert = value;
    }

    function setPrice(uint256 value) external {
        price = value;
    }

    /// @dev Mirrors ResilientOracle.updateAssetPrice (no-op here).
    // solhint-disable-next-line no-empty-blocks
    function updateAssetPrice(address) external {}

    function swapVAIForStable(address receiver, uint256 stableTknAmount) external returns (uint256) {
        if (forceRevert) {
            revert PsmForcedRevert();
        }

        uint256 stableUSD = (stableTknAmount * _priceOut()) / MANTISSA_ONE;
        uint256 fee = (stableUSD * feeOut) / BASIS_POINTS_DIVISOR;

        if (vaiToken.balanceOf(msg.sender) < stableUSD + fee) {
            revert NotEnoughVAI();
        }

        if (fee != 0) {
            // solhint-disable-next-line custom-errors
            require(vaiToken.transferFrom(msg.sender, venusTreasury, fee), "VAI fee transfer failed");
        }
        vaiToken.burn(msg.sender, stableUSD);
        IERC20(STABLE_TOKEN_ADDRESS).transfer(receiver, stableTknAmount);
        return stableUSD;
    }

    function oracle() external view returns (address) {
        return address(this);
    }

    /// @dev Mirrors ResilientOracle.getPrice for the stable token.
    function getPrice(address) external view returns (uint256) {
        return price;
    }

    function _priceOut() internal view returns (uint256) {
        return price > ONE_DOLLAR ? price : ONE_DOLLAR;
    }
}
