// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

import { ReentrancyGuardUpgradeableStorage } from "../Utils/ReentrancyGuardUpgradeableStorage.sol";

/// @title ReserveHelpersStorage
/// @author Venus
/// @dev Reserve helpers storage
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract ReserveHelpersStorage is Ownable2StepUpgradeable {
    /// @notice Deprecated slot for assetReserves mapping
    bytes32 private __deprecatedSlot1;

    /// @notice Available asset's fund per pool in RiskFund
    /// Comptroller(pool) -> Asset -> amount
    mapping(address => mapping(address => uint256)) public poolAssetsFunds;

    /// @notice Deprecated slot for poolRegistry address
    bytes32 private __deprecatedSlot2;
    /// @notice Deprecated slot for status variable
    bytes32 private __deprecatedSlot3;

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain.
    uint256[46] private __gap;
}

/// @title MaxLoopsLimitHelpersStorage
/// @author Venus
/// @dev Max loop limit helpers storage
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract MaxLoopsLimitHelpersStorage {
    /// @notice Limit for the loops to avoid the DOS
    /// @notice This state is deprecated, using it to prevent storage collision
    uint256 public maxLoopsLimit;

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain.
    /// See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    uint256[49] private __gap;
}

/// @title RiskFundV1Storage
/// @author Venus
/// @dev Risk fund V1 storage
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract RiskFundV1Storage is ReserveHelpersStorage, MaxLoopsLimitHelpersStorage {
    /// @notice Address of base asset
    address public convertibleBaseAsset;
    /// @notice Address of shortfall contract
    address public shortfall;

    /// @notice This state is deprecated, using it to prevent storage collision
    address private pancakeSwapRouter;
    /// @notice This state is deprecated, using it to prevent storage collision
    uint256 private minAmountToConvert;
}

/// @title RiskFundV2Storage
/// @author Venus
/// @dev Risk fund V2 storage
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract RiskFundV2Storage is RiskFundV1Storage, ReentrancyGuardUpgradeableStorage {
    /// @notice Risk fund converter address
    address public riskFundConverter;
}
