// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.10;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

import { AbstractTokenConverter } from "../../TokenConverter/AbstractTokenConverter.sol";
import { IRiskFundGetters } from "../../Interfaces/IRiskFund.sol";

contract MockConverter is AbstractTokenConverter {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Store the previous state for the asset transferred to ProtocolShareReserve combined(for all pools)
    mapping(address => uint256) public assetsReserves;

    /// @notice Store the asset's reserve per pool in the ProtocolShareReserve
    /// @dev Comptroller(pool) -> Asset -> amount
    mapping(address => mapping(address => uint256)) public poolsAssetsReserves;

    /// @notice Emitted after updating of the assets reserves
    /// amount -> reserve increased by amount
    event AssetsReservesUpdated(address indexed comptroller, address indexed asset, uint256 amount);

    function mockPrivateConversion(
        address comptroller,
        address tokenAddressOut,
        uint256 balanceDiff
    ) external {
        _privateConversion(comptroller, tokenAddressOut, balanceDiff);
    }

    function AbstractTokenConverter_init(
        address accessControlManager_,
        ResilientOracle priceOracle_,
        address destinationAddress_,
        uint256 minAmountToConvert_
    ) public initializer {
        __AbstractTokenConverter_init(accessControlManager_, priceOracle_, destinationAddress_, minAmountToConvert_);
    }

    function balanceOf(address tokenAddress) public view override returns (uint256 tokenBalance) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        tokenBalance = token.balanceOf(address(this));
    }

    function _postPrivateConversionHook(
        address comptroller,
        address tokenAddressIn,
        uint256 convertedTokenInBalance,
        address tokenAddressOut,
        uint256 convertedTokenOutBalance
    ) internal override {
        if (convertedTokenInBalance > 0) {
            assetsReserves[tokenAddressIn] += convertedTokenInBalance;
            poolsAssetsReserves[comptroller][tokenAddressIn] += convertedTokenInBalance;
            emit AssetsReservesUpdated(comptroller, tokenAddressIn, convertedTokenInBalance);
        }
        if (convertedTokenOutBalance > 0) {
            assetsReserves[tokenAddressOut] += convertedTokenOutBalance;
            poolsAssetsReserves[comptroller][tokenAddressOut] += convertedTokenOutBalance;
            emit AssetsReservesUpdated(comptroller, tokenAddressOut, convertedTokenOutBalance);
        }
    }

    /// @notice Get base asset address
    function _getDestinationBaseAsset() internal view override returns (address) {
        return IRiskFundGetters(destinationAddress).convertibleBaseAsset();
    }
}
