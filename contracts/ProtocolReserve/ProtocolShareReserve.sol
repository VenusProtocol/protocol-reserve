// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { SafeERC20Upgradeable, IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

import { IProtocolShareReserve } from "../Interfaces/IProtocolShareReserve.sol";
import { ComptrollerInterface } from "../Interfaces/ComptrollerInterface.sol";
import { PoolRegistryInterface } from "../Interfaces/PoolRegistryInterface.sol";
import { IPrime } from "../Interfaces/IPrime.sol";
import { IVToken } from "../Interfaces/IVToken.sol";
import { IIncomeDestination } from "../Interfaces/IIncomeDestination.sol";

import "hardhat/console.sol";

contract ProtocolShareReserve is AccessControlledV8, IProtocolShareReserve {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice protocol income is categorized into two schemas.
    /// The first schema is for spread income from prime markets in core protocol
    /// The second schema is for all other sources and types of income
    enum Schema {
        DEFAULT,
        SPREAD_PRIME_CORE
    }

    struct DistributionConfig {
        Schema schema;
        /// @dev percenatge is represented without any scale
        uint256 percentage;
        address destination;
    }

    /// @notice address of Prime contract
    address public prime;

    /// @notice address of pool registry contract
    address public poolRegistry;

    /// @notice address of core pool comptroller contract
    address public corePoolComptroller;

    uint256 private constant MAX_PERCENT = 100;

    /// @notice comptroller => asset => schema => balance
    mapping(address => mapping(address => mapping(Schema => uint256))) public assetsReserves;

    /// @notice asset => balance
    mapping(address => uint256) public totalAssetReserve;

    /// @notice configuration for different income distribution targets
    DistributionConfig[] public distributionTargets;

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

    /// @notice Event emitted when an asset is released to a target
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

    /// @notice Event emitted when distribution configuration is updated
    event DistributionConfigUpdated(
        address indexed destination,
        uint256 oldPercentage,
        uint256 newPercentage,
        Schema schema
    );

    /// @notice Event emitted when distribution configuration is added
    event DistributionConfigAdded(address indexed destination, uint256 percentage, Schema schema);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

    /**
     * @dev Initializes the deployer to owner.
     * @param _corePoolComptroller The address of core pool comptroller
     * @param _accessControlManager The address of ACM contract
     */
    function initialize(address _corePoolComptroller, address _accessControlManager) external initializer {
        require(_corePoolComptroller != address(0), "ProtocolShareReserve: Core pool comptroller address invalid");
        __AccessControlled_init(_accessControlManager);

        corePoolComptroller = _corePoolComptroller;
    }

    /**
     * @dev Pool registry setter.
     * @param _poolRegistry Address of the pool registry
     */
    function setPoolRegistry(address _poolRegistry) external {
        _checkAccessAllowed("setPoolRegistry(address)");

        require(_poolRegistry != address(0), "ProtocolShareReserve: Pool registry address invalid");
        address oldPoolRegistry = poolRegistry;
        poolRegistry = _poolRegistry;
        emit PoolRegistryUpdated(oldPoolRegistry, poolRegistry);
    }

    /**
     * @dev Prime contract address setter.
     * @param _prime Address of the prime contract
     */
    function setPrime(address _prime) external {
        _checkAccessAllowed("setPrime(address)");

        require(_prime != address(0), "ProtocolShareReserve: Prime address invalid");
        address oldPrime = prime;
        prime = _prime;
        emit PrimeUpdated(oldPrime, prime);
    }

    /**
     * @dev Add or update destination targets based on destination address
     * @param configs configurations of the destinations.
     */
    function addOrUpdateDistributionConfigs(DistributionConfig[] memory configs) external {
        _checkAccessAllowed("addOrUpdateDistributionConfigs(DistributionConfig)");

        //we need to accrue and release funds to prime before updating the distribution configuration
        //because prime relies on getUnreleasedFunds and its return value may change after config update
        _accrueAndReleaseFundsToPrime();

        for (uint i = 0; i < configs.length; ++i) {
            DistributionConfig memory _config = configs[i];
            require(_config.destination != address(0), "ProtocolShareReserve: Destination address invalid");

            bool updated = false;
            for (uint j = 0; j < distributionTargets.length; ++j) {
                DistributionConfig storage config = distributionTargets[j];

                if (_config.schema == config.schema && config.destination == _config.destination) {
                    emit DistributionConfigUpdated(
                        config.destination,
                        config.percentage,
                        _config.percentage,
                        config.schema
                    );
                    config.percentage = _config.percentage;
                    updated = true;
                    break;
                }
            }

            if (!updated) {
                distributionTargets.push(_config);
                emit DistributionConfigAdded(_config.destination, _config.percentage, _config.schema);
            }
        }

        ensurePercentages();
    }

    /**
     * @dev Release funds
     * @param assets assets to be released to distribution targets
     */
    function releaseFunds(address comptroller, address[] memory assets) external {
        _accruePrimeInterest();

        uint256 totalDistributionTargets = distributionTargets.length;
        for (uint i = 0; i < assets.length; ++i) {
            _releaseFund(comptroller, assets[i], totalDistributionTargets);
        }
    }

    /**
     * @dev Used to find out the amount of funds that's going to be released when release funds is called.
     * @param comptroller the comptroller address of the pool
     * @param schema the schema of the distribution target
     * @param destination the destination address of the distribution target
     * @param asset the asset address which will be released
     */
    function getUnreleasedFunds(
        address comptroller,
        Schema schema,
        address destination,
        address asset
    ) external view returns (uint256) {
        for (uint i = 0; i < distributionTargets.length; ++i) {
            DistributionConfig storage _config = distributionTargets[i];
            if (_config.schema == schema && _config.destination == destination) {
                uint256 total = assetsReserves[comptroller][asset][schema];
                return (total * _config.percentage) / MAX_PERCENT;
            }
        }
    }

    /**
     * @dev Returns the total number of distribution targets
     */
    function totalDistributions() external view returns (uint256) {
        return distributionTargets.length;
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
            comptroller == corePoolComptroller ||
                PoolRegistryInterface(poolRegistry).getVTokenForAsset(comptroller, asset) != address(0),
            "ProtocolShareReserve: The pool doesn't support the asset"
        );

        Schema schema = Schema.TWO;
        address vToken = IPrime(prime).vTokenForAsset(asset);

        if (vToken != address(0) && comptroller == corePoolComptroller && incomeType == IncomeType.SPREAD) {
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

    function ensurePercentages() internal {
        mapping(Schema => uint256) totalPercentages;

        for (uint i = 0; i < distributionTargets.length; ++i) {
            totalPercentages[distributionTargets[i].schema] += config.percentage;
        }

        for (uint schemaValue = 0; schemaValue <= type(Schema).max; ++schemaValue) {
            require(
                totalPercentages[schemaValue] == MAX_PERCENT || totalPercentages[schemaValue] == 0,
                "ProtocolShareReserve: Total Percentage must be 0 or 100"
            );
        }
    }

    /**
     * @dev Fetches the list of prime markets and then accrues interest and
     * releases the funds to prime for each market
     */
    function _accrueAndReleaseFundsToPrime() internal {
        address[] memory markets = IPrime(prime).allMarkets();
        for (uint i = 0; i < markets.length; ++i) {
            address market = markets[i];
            IPrime(prime).accrueInterest(market);
            _releaseFund(corePoolComptroller, IVToken(market).underlying(), distributionTargets.length);
        }
    }

    /**
     * @dev Fetches the list of prime markets and then accrues interest
     * to prime for each market
     */
    function _accruePrimeInterest() internal {
        address[] memory markets = IPrime(prime).allMarkets();
        for (uint i = 0; i < markets.length; ++i) {
            address market = markets[i];
            IPrime(prime).accrueInterest(market);
        }
    }

    function _releaseFund(address comptroller, address asset, uint256 totalDistributionTargets) internal {
        mapping(Schema => uint256) totalTransferAmountPerSchema;

        for (uint i = 0; i < totalDistributionTargets; ++i) {
            DistributionConfig memory _config = distributionTargets[i];

            uint256 transferAmount = (assetsReserves[comptroller][asset][_config.schema] * _config.percentage) / MAX_PERCENT;
            totalTransferAmountPerSchema[_config.schema] += transferAmount;

            IERC20Upgradeable(asset).safeTransfer(_config.destination, transferAmount);
            IIncomeDestination(_config.destination).updateAssetsState(comptroller, asset);

            emit AssetReleased(_config.destination, asset, _config.schema, _config.percentage, transferAmount);
        }

        for (uint schemaValue = 0; schemaValue <= type(Schema).max; ++schemaValue) {
            uint oldSchemaReserves = assetsReserves[comptroller][asset][schemaValue];
            uint newSchemaReserves = oldSchemaReserves - totalTransferAmountPerSchema[schemaValue]; // This should be zero or dust

            if (newSchemaReserves != oldSchemaReserves) {
                assetsReserves[comptroller][asset][schemaValue] = newSchemaReserves;
                totalAssetReserve[asset] -= totalTransferAmountPerSchema[schemaValue];

                emit ReservesUpdated(comptroller, asset, schemaValue, oldSchemaReserves, newSchemaReserves);
            }
        }
    }
}
