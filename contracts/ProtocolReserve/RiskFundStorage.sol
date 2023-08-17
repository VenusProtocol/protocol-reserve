// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

contract ReserveHelpersStorage {
    /// @notice Store the previous state for the asset transferred to ProtocolShareReserve combined(for all pools).
    /// @notice This state is deprecated, using it to prevent storage collision
    mapping(address => uint256) internal assetsReserves;

    /// @notice Store the asset's reserve per pool in the ProtocolShareReserve.
    /// Comptroller(pool) -> Asset -> amount
    /// @notice This state is deprecated, using it to prevent storage collision
    mapping(address => mapping(address => uint256)) internal poolsAssetsReserves;

    /// @notice Address of pool registry contract
    /// @notice This state is deprecated, using it to prevent storage collision
    address internal poolRegistry;

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain.
    uint256[47] private __gap;
}

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
contract RiskFundV1Storage is ReserveHelpersStorage, MaxLoopsLimitHelpersStorage {
    /// @notice This state is deprecated, using it to prevent storage collision
    address private pancakeSwapRouter;
    /// @notice This state is deprecated, using it to prevent storage collision
    uint256 private minAmountToConvert;

    address public convertibleBaseAsset;
    address public shortfall;

    /// @notice Store base asset's reserve for specific pool
    mapping(address => uint256) public poolReserves;
}

/// @title RiskFundV2Storage
/// @author Venus
/// @dev Risk fund V2 storage
contract RiskFundV2Storage is RiskFundV1Storage {
    /// @notice Risk fund converter address
    address public riskFundConverter;

    /// @notice Available asset's fund per pool in RiskFund
    /// Comptroller(pool) -> Asset -> amount
    mapping(address => mapping(address => uint256)) public poolAssetsFunds;
}
