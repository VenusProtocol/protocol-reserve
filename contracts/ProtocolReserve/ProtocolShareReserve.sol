// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import { IProtocolShareReserve } from "../Interfaces/IProtocolShareReserve.sol";
import { ExponentialNoError } from "../Utils/ExponentialNoError.sol";
import { ReserveHelpers } from "../Helpers/ReserveHelpers.sol";
import { IRiskFundTransformer } from "../Interfaces/IRiskFundTransformer.sol";
import { ensureNonzeroAddress } from "../Helpers/validators.sol";
import { EXP_SCALE } from "../Helpers/constants.sol";

/**
 * @title ProtocolShareReserve
 * @author Venus
 * @notice Contract used to store and distribute the reserves generated in the markets.
 */
contract ProtocolShareReserve is Ownable2StepUpgradeable, ExponentialNoError, ReserveHelpers, IProtocolShareReserve {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address private protocolIncome;
    address private riskFundSwapper;
    // Percentage of funds not sent to the RiskFund contract when the funds are released, following the project Tokenomics
    uint256 private constant PROTOCOL_SHARE_PERCENTAGE = 70;
    uint256 private constant BASE_UNIT = 100;

    /// @notice Emitted when funds are released
    event FundsReleased(address indexed comptroller, address indexed asset, uint256 amount);

    /// @notice Emitted when pool registry address is updated
    event PoolRegistryUpdated(address indexed oldPoolRegistry, address indexed newPoolRegistry);

    /// @notice Emitted whrn risk fund swappar address is updated
    event RiskFundSwapperUpdated(address indexed oldRiskFundSwapper, address indexed newRiskFundSwapper);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

    /**
     * @dev Initializes the deployer to owner.
     * @param protocolIncome_ The address protocol income will be sent to
     * @custom:error ZeroAddressNotAllowed is thrown when protocol income address is zero
     */
    function initialize(address protocolIncome_) external initializer {
        ensureNonzeroAddress(protocolIncome_);

        __Ownable2Step_init();

        protocolIncome = protocolIncome_;
    }

    /**
     * @dev Pool registry setter.
     * @param poolRegistry_ Address of the pool registry
     * @custom:error ZeroAddressNotAllowed is thrown when pool registry address is zero
     */
    function setPoolRegistry(address poolRegistry_) external onlyOwner {
        ensureNonzeroAddress(poolRegistry_);
        address oldPoolRegistry = poolRegistry;
        poolRegistry = poolRegistry_;
        emit PoolRegistryUpdated(oldPoolRegistry, poolRegistry_);
    }

    /**
     * @dev Risk fund swapper setter
     * @param riskFundSwapper_ Address of the Risk fund swapper
     * @custom:error ZeroAddressNotAllowed is thrown when pool registry address is zero
     */
    function setRiskFundTransformer(address riskFundSwapper_) external onlyOwner {
        ensureNonzeroAddress(riskFundSwapper_);
        address oldRiskFundSwapper = riskFundSwapper;
        riskFundSwapper = riskFundSwapper_;
        emit RiskFundSwapperUpdated(oldRiskFundSwapper, riskFundSwapper_);
    }

    /**
     * @dev Release funds
     * @param comptroller Pool's Comptroller
     * @param asset  Asset to be released
     * @param amount Amount to release
     * @return Number of total released tokens
     * @custom:error ZeroAddressNotAllowed is thrown when asset address is zero
     */
    function releaseFunds(address comptroller, address asset, uint256 amount) external returns (uint256) {
        ensureNonzeroAddress(asset);
        require(amount <= poolsAssetsReserves[comptroller][asset], "ProtocolShareReserve: Insufficient pool balance");

        assetsReserves[asset] -= amount;
        poolsAssetsReserves[comptroller][asset] -= amount;
        uint256 protocolIncomeAmount = mul_(
            Exp({ mantissa: amount }),
            div_(Exp({ mantissa: PROTOCOL_SHARE_PERCENTAGE * EXP_SCALE }), BASE_UNIT)
        ).mantissa;

        address riskFundSwapper_ = riskFundSwapper;

        IERC20Upgradeable(asset).safeTransfer(protocolIncome, protocolIncomeAmount);
        IERC20Upgradeable(asset).safeTransfer(riskFundSwapper_, amount - protocolIncomeAmount);

        // Update the pool asset's state in the risk fund for the above transfer.
        IRiskFundTransformer(riskFundSwapper_).updateAssetsState(comptroller, asset);

        emit FundsReleased(comptroller, asset, amount);

        return amount;
    }

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
