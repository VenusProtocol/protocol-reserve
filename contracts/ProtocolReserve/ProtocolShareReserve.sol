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

    /// @notice address of RiskFundSwapper contract
    address public RISK_FUND_SWAPPER;

    /// @notice address of XVSVaultSwapper contract
    address public XVS_VAULT_SWAPPER;

    /// @notice address of Prime contract
    address public PRIME;

    /// @notice address of DAO destination
    address public DAO;

    /// @notice address of pool registry contract
    address public POOL_REGISTRY;

    /// @notice address of core pool comptroller contract
    address public CORE_POOL_COMPTROLLER;

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

    mapping (address => mapping ( Schema => uint256 )) public assetsReserves;

    /// @notice Emitted when funds are released
    event FundsReleased(address comptroller, address asset, uint256 amount);

    /// @notice Emitted when pool registry address is updated
    event PoolRegistryUpdated(address indexed oldPoolRegistry, address indexed newPoolRegistry);

    // Event emitted after the updation of the assets reserves.
    // amount -> reserve increased by amount.
    event AssetsReservesUpdated(address indexed comptroller, address indexed asset, uint256 amount, IncomeType incomeType);

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
        address prime,
        address corePoolComptroller
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
        CORE_POOL_COMPTROLLER = corePoolComptroller;
    }

     /**
     * @dev Pool registry setter.
     * @param _poolRegistry Address of the pool registry
     */
    function setPoolRegistry(address _poolRegistry) external onlyOwner {
        require(_poolRegistry != address(0), "ProtocolShareReserve: Pool registry address invalid");
        address oldPoolRegistry = POOL_REGISTRY;
        POOL_REGISTRY = _poolRegistry;
        emit PoolRegistryUpdated(oldPoolRegistry, _poolRegistry);
    }

    /**
     * @dev Release funds
     * @param assets assets to be released
    */
    function releaseFunds(address[] memory assets) external {
        for (uint i = 0; i < assets.length; i++) {
            _releaseFund(assets[i]);
        }
    }

    function _releaseFund(address asset) internal {
        uint256 schemaOneBalance = assetsReserves[asset][Schema.ONE];
        uint256 schemaTwoBalance = assetsReserves[asset][Schema.ONE];

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
        uint256 assetReserve = assetsReserves[asset][schema];

        if (currentBalance > assetReserve) {
            uint256 balanceDifference;
            unchecked {
                balanceDifference = currentBalance - assetReserve;
            }
            
            assetsReserves[asset][schema] += balanceDifference;
            emit AssetsReservesUpdated(comptroller, asset, balanceDifference, incomeType);
        }
    }
}
