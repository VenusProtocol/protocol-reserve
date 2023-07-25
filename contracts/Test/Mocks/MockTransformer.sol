// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.10;

import { AbstractTokenTransformer } from "../../TokenTransformer/AbstractTokenTransformer.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";

contract MockTransformer is AbstractTokenTransformer {
    function AbstractTokenTransformer_init(
        address accessControlManager_,
        ResilientOracle priceOracle_,
        address destinationAddress_
    ) public initializer {
        __AbstractTokenTransformer_init(accessControlManager_, priceOracle_, destinationAddress_);
    }
}
