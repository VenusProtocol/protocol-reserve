// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IReserveHelpers } from "../Interfaces/IReserveHelpers.sol";

abstract contract ReserveHelpers is IReserveHelpers {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Store the previous state for the asset transferred to ProtocolShareReserve combined(for all pools).
    mapping(address => uint256) internal assetsReserves;

    // Store the asset's reserve per pool in the ProtocolShareReserve.
    // Comptroller(pool) -> Asset -> amount
    mapping(address => mapping(address => mapping(IncomeType =>  uint256))) public poolsAssetsReserves;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     */
    uint256[48] private __gap;

    // Event emitted after the updation of the assets reserves.
    // amount -> reserve increased by amount.
    event AssetsReservesUpdated(address indexed comptroller, address indexed asset, uint256 amount, IncomeType incomeType);

    /**
     * @dev Update the reserve of the asset for the specific pool after transferring to risk fund
     * and transferring funds to the protocol share reserve
     * @param comptroller  Comptroller address(pool).
     * @param asset Asset address.
     */
    function updateAssetsState(address comptroller, address asset, IncomeType incomeType) public virtual {
        uint256 currentBalance = IERC20Upgradeable(asset).balanceOf(address(this));
        uint256 assetReserve = assetsReserves[asset];
        if (currentBalance > assetReserve) {
            uint256 balanceDifference;
            unchecked {
                balanceDifference = currentBalance - assetReserve;
            }
            poolsAssetsReserves[comptroller][asset][incomeType] += balanceDifference;
            emit AssetsReservesUpdated(comptroller, asset, balanceDifference, incomeType);
        }
    }
}
