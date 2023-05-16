// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { SafeERC20Upgradeable, IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import { ExponentialNoError } from "../Utils/ExponentialNoError.sol";
import { IRiskFund } from "../Interfaces/IRiskFund.sol";
import { ReserveHelpers } from "../Helpers/ReserveHelpers.sol";
import { IProtocolShareReserve } from "../Interfaces/IProtocolShareReserve.sol";

contract ProtocolShareReserve is Ownable2StepUpgradeable, ExponentialNoError, ReserveHelpers, IProtocolShareReserve {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice it represents the type of vToken income
    enum IncomeType {
        SPREAD,
        LIQUIDATION,
        UNDEFINED
    }

    /// @notice address of RiskFundSwapper contract
    address public RISK_FUND_SWAPPER;

    /// @notice address of XVSVaultSwapper contract
    address public XVS_VAULT_SWAPPER;

    /// @notice address of Prime contract
    address public PRIME;

    /// @notice address of DAO destination
    address public DAO;

    /// @notice income distribution percentage to risk fund for income from non-prime market
    uint256 public constant SCHEMA_TWO_MARKET_RISK_FIND_PERCENT = 48;

    /// @notice income distribution percentage to risk fund for income from market spread in prime market
    uint256 public constant SCHEMA_ONE_RISK_FIND_PERCENT = 20;

    /// @notice income distribution percentage to xvs vault for income from non-prime market
    uint256 public constant SCHEMA_TWO_XVS_VAULT_PERCENT = 26;

    /// @notice income distribution percentage to xvs vault for income from market spread in prime market
    uint256 public constant SCHEMA_ONE_XVS_VAULT_PERCENT = 20;

    /// @notice income distribution percentage to DAO for income from non-prime market
    uint256 public constant SCHEMA_TWO_DAO_VAULT_PERCENT = 26;

    /// @notice income distribution percentage to DAO for income from market spread in prime market
    uint256 public constant SCHEMA_ONE_DAO_VAULT_PERCENT = 26;

    /// @notice income distribution percentage to prime for income from market spread in prime market
    uint256 public constant PRIME_PERCENT = 20;

    /// @notice Emitted when funds are released
    event FundsReleased(address comptroller, address asset, uint256 amount);

    /// @notice Emitted when pool registry address is updated
    event PoolRegistryUpdated(address indexed oldPoolRegistry, address indexed newPoolRegistry);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

    /**
     * @dev Initializes the deployer to owner.
     * @param riskFundSwapper The address of RiskFundSwapper contract
     * @param xvsVaultSwapper The address of XVSVaultSwapper contract
     * @param dao The address to send DAO funds to
     * @param prime The address of Prime contract
     */
    function initialize(
        address riskFundSwapper, 
        address xvsVaultSwapper,
        address dao,
        address prime
    ) external initializer {
        require(riskFundSwapper != address(0), "ProtocolShareReserve: RiskFundSwapper address invalid");
        require(xvsVaultSwapper != address(0), "ProtocolShareReserve: XVSVaultSwapper address invalid");
        require(dao != address(0), "ProtocolShareReserve: DAO address invalid");
        require(prime != address(0), "ProtocolShareReserve: Prime address invalid");

        __Ownable2Step_init();

        RISK_FUND_SWAPPER = riskFundSwapper;
        XVS_VAULT_SWAPPER = xvsVaultSwapper;
        DAO = dao;
        PRIME = prime;
    }

    /**
     * @dev Pool registry setter.
     * @param _poolRegistry Address of the pool registry
     */
    function setPoolRegistry(address _poolRegistry) external onlyOwner {
        require(_poolRegistry != address(0), "ProtocolShareReserve: Pool registry address invalid");
        address oldPoolRegistry = poolRegistry;
        poolRegistry = _poolRegistry;
        emit PoolRegistryUpdated(oldPoolRegistry, _poolRegistry);
    }

    /**
     * @dev Release funds
     * @param asset  Asset to be released
     * @param amount Amount to release
     * @return Number of total released tokens
     */
    // function releaseFunds(address comptroller, address asset, uint256 amount) external returns (uint256) {
    //     require(asset != address(0), "ProtocolShareReserve: Asset address invalid");
    //     require(amount <= poolsAssetsReserves[comptroller][asset], "ProtocolShareReserve: Insufficient pool balance");

    //     assetsReserves[asset] -= amount;
    //     poolsAssetsReserves[comptroller][asset] -= amount;
    //     uint256 protocolIncomeAmount = mul_(
    //         Exp({ mantissa: amount }),
    //         div_(Exp({ mantissa: protocolSharePercentage * expScale }), baseUnit)
    //     ).mantissa;

    //     IERC20Upgradeable(asset).safeTransfer(protocolIncome, protocolIncomeAmount);
    //     IERC20Upgradeable(asset).safeTransfer(riskFund, amount - protocolIncomeAmount);

    //     // Update the pool asset's state in the risk fund for the above transfer.
    //     IRiskFund(riskFund).updateAssetsState(comptroller, asset);

    //     emit FundsReleased(comptroller, asset, amount);

    //     return amount;
    // }

    /**
     * @dev Update the reserve of the asset for the specific pool after transferring to the protocol share reserve.
     * @param comptroller  Comptroller address(pool)
     * @param asset Asset address.
     */
    function updateAssetsState(
        address comptroller,
        address asset
    ) public override(IProtocolShareReserve, ReserveHelpers) {
        super.updateAssetsState(comptroller, asset);
    }
}
