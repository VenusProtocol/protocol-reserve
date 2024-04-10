// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { RiskFundConverter } from "../../TokenConverter/RiskFundConverter.sol";

contract MockRiskFundConverter is RiskFundConverter {
    constructor(
        address corePoolComptroller_,
        address vBNB_,
        address nativeWrapped_
    ) RiskFundConverter(corePoolComptroller_, vBNB_, nativeWrapped_) {}

    function postConversionHookMock(
        address tokenInAddress,
        address tokenOutAddress,
        uint256 amountIn,
        uint256 amountOut
    ) external {
        super._postConversionHook(tokenInAddress, tokenOutAddress, amountIn, amountOut);
    }

    function preTransferHookMock(address tokenOutAddress, uint256 amountOut) external {
        super._preTransferHook(tokenOutAddress, amountOut);
    }

    function setAssetsReserves(address asset, uint256 amount) external {
        assetsReserves[asset] = amount;
    }

    function setPoolsAssetsReserves(
        address comptroller,
        address asset,
        uint256 amount
    ) external {
        poolsAssetsReserves[comptroller][asset] = amount;
    }

    function getPoolsAssetsReserves(address comptroller, address asset) external view returns (uint256) {
        return poolsAssetsReserves[comptroller][asset];
    }

    function getAssetsReserves(address asset) external view returns (uint256) {
        return assetsReserves[asset];
    }
}
