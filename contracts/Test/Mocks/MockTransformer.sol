// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.10;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { AbstractTokenTransformer } from "../../TokenTransformer/AbstractTokenTransformer.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

contract MockTransformer is AbstractTokenTransformer {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    function AbstractTokenTransformer_init(
        address accessControlManager_,
        ResilientOracle priceOracle_,
        address destinationAddress_
    ) public initializer {
        __AbstractTokenTransformer_init(accessControlManager_, priceOracle_, destinationAddress_);
    }

    function balanceOf(address tokenAddress) public view override returns (uint256 tokenBalance) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        tokenBalance = token.balanceOf(address(this));
    }
}
