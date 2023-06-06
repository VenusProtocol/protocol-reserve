// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { SafeERC20Upgradeable, IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

import { IProtocolShareReserve } from "../Interfaces/IProtocolShareReserve.sol";
import { ComptrollerInterface } from "../Interfaces/ComptrollerInterface.sol";
import { PoolRegistryInterface } from "../Interfaces/PoolRegistryInterface.sol";
import { IPrime } from "../Interfaces/IPrime.sol";
import { IIncomeDestination } from "../Interfaces/IIncomeDestination.sol";

contract ProtocolShareReserve is AccessControlledV8, IProtocolShareReserve {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice protocol income is categorized into two schemas.
    /// The first schema is for spread income from prime markets in core protocol
    /// The second schema is for all other sources and types of income
    enum Schema {
        ONE,
        TWO
    }

    struct DistributionConfig {
        Schema schema;
        uint256 percentage;
        address destination;
    }

    /// @notice address of Prime contract
    address public PRIME;

    /// @notice address of pool registry contract
    address public POOL_REGISTRY;

    /// @notice address of core pool comptroller contract
    address public CORE_POOL_COMPTROLLER;

    uint256 private constant MAX_PERCENT = 100;

    /// @notice comptroller => asset => schema => balance
    mapping(address => mapping(address => mapping(Schema => uint256))) public assetsReserves;

    /// @notice asset => balance
    mapping(address => uint256) private totalAssetReserve;

    /// @notice configuration for different income distribution targers
    DistributionConfig[] public distributionTargets;

    /// @notice Emitted when funds are released
    event FundsReleased(address comptroller, address asset, uint256 amount);

    /// @notice Emitted when pool registry address is updated
    event PoolRegistryUpdated(address indexed oldPoolRegistry, address indexed newPoolRegistry);

    /// @notice Emitted when prime address is updated
    event PrimeUpdated(address indexed oldPrime, address indexed newPrime);

    /// @notice Event emitted after the updation of the assets reserves.
    event AssetsReservesUpdated(
        address indexed comptroller,
        address indexed asset,
        uint256 amount,
        IncomeType incomeType,
        Schema schema
    );

    /// @notice Event emitted after a income distribution target is configured
    event DestinationConfigured(address indexed destination, uint percent, Schema schema);

    /// @notice Event emitted when asset is released to an target
    event AssetReleased(
        address indexed destination,
        address indexed asset,
        Schema schema,
        uint256 percent,
        uint256 amount
    );

    /// @notice Event emitted when asset reserves state is updated
    event ReservesUpdated(
        address indexed comptroller,
        address indexed asset,
        Schema schema,
        uint256 oldBalance,
        uint256 newBalance
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

    /**
     * @dev Initializes the deployer to owner.
     * @param corePoolComptroller The address of core pool comptroller
     * @param accessControlManager The address of ACM contract
     */
    function initialize(address corePoolComptroller, address accessControlManager) external initializer {
        require(corePoolComptroller != address(0), "ProtocolShareReserve: Core pool comptroller address invalid");
        __Ownable2Step_init();
        __AccessControlled_init(accessControlManager);

        CORE_POOL_COMPTROLLER = corePoolComptroller;
    }

    /**
     * @dev Pool registry setter.
     * @param poolRegistry Address of the pool registry
     */
    function setPoolRegistry(address poolRegistry) external {
        _checkAccessAllowed("setPoolRegistry(address)");

        require(poolRegistry != address(0), "ProtocolShareReserve: Pool registry address invalid");
        address oldPoolRegistry = POOL_REGISTRY;
        POOL_REGISTRY = poolRegistry;
        emit PoolRegistryUpdated(oldPoolRegistry, poolRegistry);
    }

    /**
     * @dev Prime contract address setter.
     * @param prime Address of the prime contract
     */
    function setPrime(address prime) external {
        _checkAccessAllowed("setPrime(address)");

        require(prime != address(0), "ProtocolShareReserve: Prime address invalid");
        address oldPrime = PRIME;
        PRIME = prime;
        emit PrimeUpdated(oldPrime, prime);
    }

    /**
     * @dev Add or update destination target based on destination address
     * @param config configuration of the destination.
     */
    function addOrUpdateDistributionConfig(DistributionConfig memory config) external {
        _checkAccessAllowed("addOrUpdateDistributionConfig(DistributionConfig)");
        require(config.destination != address(0), "ProtocolShareReserve: Destination address invalid");

        uint256 total = 0;
        bool updated = false;
        for (uint i = 0; i < distributionTargets.length; i++) {
            DistributionConfig storage _config = distributionTargets[i];
            if (_config.schema == config.schema) {
                if (config.destination == _config.destination) {
                    total += config.percentage;
                    _config.percentage = config.percentage;
                    updated = true;
                } else {
                    total += _config.percentage;
                }
            }
        }

        if (updated == false) {
            total += config.percentage;
            distributionTargets.push(config);
        }

        require(total <= MAX_PERCENT, "ProtocolShareReserve: Percentage must be between 0 and 100");
    }

    /**
     * @dev Release funds
     * @param assets assets to be released to distribution targets
     */
    function releaseFunds(address comptroller, address[] memory assets) external {
        for (uint i = 0; i < assets.length; i++) {
            _releaseFund(comptroller, assets[i]);
        }
    }

    function _releaseFund(address comptroller, address asset) internal {
        uint256 schemaOneBalance = assetsReserves[comptroller][asset][Schema.ONE];
        uint256 schemaTwoBalance = assetsReserves[comptroller][asset][Schema.TWO];
        uint256 schemaOneTotalTransferAmount;
        uint256 schemaTwoTotalTransferAmount;

        for (uint i = 0; i < distributionTargets.length; i++) {
            DistributionConfig storage _config = distributionTargets[i];

            uint256 transferAmount;
            if (_config.schema == Schema.ONE) {
                transferAmount = (schemaOneBalance * _config.percentage) / MAX_PERCENT;
                schemaOneTotalTransferAmount += transferAmount;
            } else {
                transferAmount = (schemaTwoBalance * _config.percentage) / MAX_PERCENT;
                schemaTwoTotalTransferAmount += transferAmount;
            }

            IERC20Upgradeable(asset).safeTransfer(_config.destination, transferAmount);
            IIncomeDestination(_config.destination).updateAssetsState(comptroller, asset);

            emit AssetReleased(_config.destination, asset, _config.schema, _config.percentage, transferAmount);
        }

        uint oldSchemaOneBalance = schemaOneBalance;
        uint oldSchemaTwoBalance = schemaTwoBalance;
        uint newSchemaOneBalance = schemaOneBalance - schemaOneTotalTransferAmount;
        uint newSchemaTwoBalance = schemaTwoBalance - schemaTwoTotalTransferAmount;

        assetsReserves[comptroller][asset][Schema.ONE] = newSchemaOneBalance;
        assetsReserves[comptroller][asset][Schema.TWO] = newSchemaTwoBalance;
        totalAssetReserve[asset] =
            totalAssetReserve[asset] -
            schemaOneTotalTransferAmount -
            schemaTwoTotalTransferAmount;

        emit ReservesUpdated(comptroller, asset, Schema.ONE, oldSchemaOneBalance, newSchemaOneBalance);
        emit ReservesUpdated(comptroller, asset, Schema.TWO, oldSchemaTwoBalance, newSchemaTwoBalance);
    }

    /**
     * @dev Update the reserve of the asset for the specific pool after transferring to the protocol share reserve.
     * @param comptroller  Comptroller address(pool)
     * @param asset Asset address.
     */
    function updateAssetsState(
        address comptroller,
        address asset,
        IncomeType incomeType
    ) public override(IProtocolShareReserve) {
        require(ComptrollerInterface(comptroller).isComptroller(), "ProtocolShareReserve: Comptroller address invalid");
        require(asset != address(0), "ProtocolShareReserve: Asset address invalid");
        require(
            (comptroller != CORE_POOL_COMPTROLLER &&
                PoolRegistryInterface(POOL_REGISTRY).getVTokenForAsset(comptroller, asset) != address(0)) ||
                (comptroller == CORE_POOL_COMPTROLLER),
            "ProtocolShareReserve: The pool doesn't support the asset"
        );

        Schema schema = Schema.TWO;
        address vToken = IPrime(PRIME).vTokenForAsset(asset);

        if (vToken != address(0) && comptroller == CORE_POOL_COMPTROLLER && incomeType == IncomeType.SPREAD) {
            schema = Schema.ONE;
        }

        uint256 currentBalance = IERC20Upgradeable(asset).balanceOf(address(this));
        uint256 assetReserve = totalAssetReserve[asset];

        if (currentBalance > assetReserve) {
            uint256 balanceDifference;
            unchecked {
                balanceDifference = currentBalance - assetReserve;
            }

            assetsReserves[comptroller][asset][schema] += balanceDifference;
            totalAssetReserve[asset] += balanceDifference;
            emit AssetsReservesUpdated(comptroller, asset, balanceDifference, incomeType, schema);
        }
    }
}
