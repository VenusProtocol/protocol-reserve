// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

contract ReserveHelpersStorage {
    /// Store the previous state for the asset transferred to ProtocolShareReserve combined(for all pools).
    mapping(address => uint256) internal assetsReserves;

    /// Store the asset's reserve per pool in the ProtocolShareReserve.
    /// Comptroller(pool) -> Asset -> amount
    mapping(address => mapping(address => uint256)) internal poolsAssetsReserves;

    /// Address of pool registry contract
    address internal poolRegistry;

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain.
    uint256[47] private __gap;
}

contract MaxLoopsLimitHelpersStorage {
    /// Limit for the loops to avoid the DOS
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
    address private pancakeSwapRouter;
    uint256 private minAmountToConvert;
    address public convertibleBaseAsset;
    address public shortfall;

    /// Store base asset's reserve for specific pool
    mapping(address => uint256) public poolReserves;
}

/// @title RiskFundV2Storage
/// @author Venus
/// @dev Risk fund V2 storage
contract RiskFundV2Storage is RiskFundV1Storage {
    /// Risk fund transformer address
    address public riskFundTransformer;
}
