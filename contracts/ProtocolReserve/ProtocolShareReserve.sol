// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { SafeERC20Upgradeable, IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import { ExponentialNoError } from "../Utils/ExponentialNoError.sol";
import { IRiskFund } from "../Interfaces/IRiskFund.sol";
import { IProtocolShareReserve } from "../Interfaces/IProtocolShareReserve.sol";
import "../Interfaces/ComptrollerInterface.sol";
import "../Interfaces/PoolRegistryInterface.sol";
import "../Interfaces/IPrime.sol";

contract ProtocolShareReserve is Ownable2StepUpgradeable, ExponentialNoError, IProtocolShareReserve {
    using SafeERC20Upgradeable for IERC20Upgradeable;

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

    /// @notice comptroller => asset => schema => balance
    mapping (address => mapping (address => mapping ( Schema => uint256 ))) public assetsReserves;

   DistributionConfig[] public distributionTargets;

    /// @notice Emitted when funds are released
    event FundsReleased(address comptroller, address asset, uint256 amount);

    /// @notice Emitted when pool registry address is updated
    event PoolRegistryUpdated(address indexed oldPoolRegistry, address indexed newPoolRegistry);

    /// @notice Emitted when prime address is updated
    event PrimeUpdated(address indexed oldPrime, address indexed newPrime);

    /// @notice Event emitted after the updation of the assets reserves.
    event AssetsReservesUpdated(address indexed comptroller, address indexed asset, uint256 amount, IncomeType incomeType, Schema schema);

    /// @notice Event emitted after a income distribution target is configured
    event DestinationConfigured(address indexed destination, uint percent, Schema schema);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

    /**
     * @dev Initializes the deployer to owner.
     * @param corePoolComptroller The address of core pool comptroller
     */
    function initialize(
        address corePoolComptroller
    ) external initializer {
        require(corePoolComptroller != address(0), "ProtocolShareReserve: Core pool comptroller address invalid");
        __Ownable2Step_init();
        CORE_POOL_COMPTROLLER = corePoolComptroller;
    }

    /**
     * @dev Pool registry setter.
     * @param poolRegistry Address of the pool registry
     */
    function setPoolRegistry(address poolRegistry) external onlyOwner {
        require(poolRegistry != address(0), "ProtocolShareReserve: Pool registry address invalid");
        address oldPoolRegistry = POOL_REGISTRY;
        POOL_REGISTRY = poolRegistry;
        emit PoolRegistryUpdated(oldPoolRegistry, poolRegistry);
    }

    /**
     * @dev Prime contract address setter.
     * @param prime Address of the prime contract
     */
    function setPrime(address prime) external onlyOwner {
        require(prime != address(0), "ProtocolShareReserve: Prime address invalid");
        address oldPrime = PRIME;
        PRIME = prime;
        emit PrimeUpdated(oldPrime, prime);
    }

    /**
     * @dev Add or update destination target based on destination address
     * @param config configuration of the destination. 
     */
    function addOrUpdateDistributionConfig(DistributionConfig memory config) external onlyOwner {
        uint256 total = 0;
        bool updated = false;
        for (uint i = 0; i < distributionTargets.length; i++) {
            DistributionConfig storage _config = distributionTargets[i];
            if (config.destination == _config.destination) {
                total += config.percentage;

                _config.destination = config.destination;
                _config.percentage = config.percentage;
                _config.schema = config.schema;
                updated = true;
            } else if (_config.schema == config.schema) {
                total += _config.percentage;
            }
        }

        if (updated == false) {
            total += config.percentage;
            distributionTargets.push(config);
        }

        require(total <= 100, "ProtocolShareReserve: total percent cannot be more than 100");
    }

    /**
     * @dev Release funds
     * @param assets assets to be released
    */
    function releaseFunds(address comptroller, address[] memory assets) external {
        for (uint i = 0; i < assets.length; i++) {
            _releaseFund(comptroller, assets[i]);
        }
    }

    function _releaseFund(address comptroller, address asset) internal {
        uint256 schemaOneBalance = assetsReserves[comptroller][asset][Schema.ONE];
        uint256 schemaTwoBalance = assetsReserves[comptroller][asset][Schema.ONE];

        // Distribute schemaOneBalance based on SCHEMA_ONE_RISK_FIND_PERCENT, SCHEMA_ONE_XVS_VAULT_PERCENT, SCHEMA_ONE_DAO_VAULT_PERCENT and PRIME_PERCENT

        // Distribute schemaTwoBalance based on SCHEMA_TWO_XVS_VAULT_PERCENT, SCHEMA_TWO_MARKET_RISK_FIND_PERCENT and SCHEMA_TWO_DAO_VAULT_PERCENT
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
            PoolRegistryInterface(POOL_REGISTRY).getVTokenForAsset(comptroller, asset) != address(0)) || (comptroller == CORE_POOL_COMPTROLLER),
            "ProtocolShareReserve: The pool doesn't support the asset"
        );

        Schema schema = Schema.TWO;
        bool isPrime = IPrime(PRIME).isPrime(asset);

        if (isPrime && comptroller == CORE_POOL_COMPTROLLER && incomeType == IncomeType.SPREAD) {
            schema = Schema.ONE;
        }

        uint256 currentBalance = IERC20Upgradeable(asset).balanceOf(address(this));
        uint256 assetReserve = assetsReserves[comptroller][asset][schema];

        if (currentBalance > assetReserve) {
            uint256 balanceDifference;
            unchecked {
                balanceDifference = currentBalance - assetReserve;
            }
            
            assetsReserves[comptroller][asset][schema] += balanceDifference;
            emit AssetsReservesUpdated(comptroller, asset, balanceDifference, incomeType, schema);
        }
    }
}
