// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { RiskFundTransformer } from "../../TokenTransformer/RiskFundTransformer.sol";

contract MockRiskFundTransformer is RiskFundTransformer {
    function postTransformationHookMock(address tokenInAddress, uint256 amountIn, uint256 amountOut) external {
        super.postTransformationHook(tokenInAddress, amountIn, amountOut);
    }

    function getPoolsAssetsReserves(address comptroller, address asset) external view returns (uint256) {
        return poolsAssetsReserves[comptroller][asset];
    }

    function getAssetsReserves(address asset) external view returns (uint256) {
        return assetsReserves[asset];
    }

    function setAssetsReserves(address asset, uint256 amount) external {
        assetsReserves[asset] = amount;
    }

    function setPoolsAssetsReserves(address comptroller, address asset, uint256 amount) external {
        poolsAssetsReserves[comptroller][asset] = amount;
    }
}
