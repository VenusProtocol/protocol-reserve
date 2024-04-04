// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { IXVSVault } from "../Interfaces/IXVSVault.sol";

/// @title XVSVaultTreasury
/// @author Venus
/// @notice XVSVaultTreasury stores the tokens sent by SingleTokenConverter(XVS) and funds XVSVault
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract XVSVaultTreasury is AccessControlledV8, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice The xvs token address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable XVS_ADDRESS;

    /// @notice The xvsvault address
    address public xvsVault;

    /// @notice Emitted when XVS vault address is updated
    event XVSVaultUpdated(address indexed oldXVSVault, address indexed newXVSVault);

    /// @notice Emitted when funds transferred to XVSStore address
    event FundsTransferredToXVSStore(address indexed xvsStore, uint256 amountMantissa);

    /// @notice Event emitted when tokens are swept
    event SweepToken(address indexed token, address indexed to, uint256 amount);

    /// @notice Thrown when given input amount is zero
    error InsufficientBalance();

    /// @custom:oz-upgrades-unsafe-allow constructor
    /// @param xvsAddress_ XVS token address
    constructor(address xvsAddress_) {
        ensureNonzeroAddress(xvsAddress_);
        XVS_ADDRESS = xvsAddress_;

        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

    /// @param accessControlManager_ Access control manager contract address
    /// @param xvsVault_ XVSVault address
    /// @custom:event XVSVaultUpdated emits on success
    /// @custom:error ZeroAddressNotAllowed is thrown when XVS vault address is zero
    function initialize(address accessControlManager_, address xvsVault_) public initializer {
        __AccessControlled_init(accessControlManager_);
        __ReentrancyGuard_init();
        _setXVSVault(xvsVault_);
    }

    /// @dev XVS vault setter
    /// @param xvsVault_ Address of the XVS vault
    /// @custom:event XVSVaultUpdated emits on success
    /// @custom:error ZeroAddressNotAllowed is thrown when XVS vault address is zero
    function setXVSVault(address xvsVault_) external onlyOwner {
        _setXVSVault(xvsVault_);
    }

    /// @notice This function transfers funds to the XVS vault
    /// @param amountMantissa Amount to be sent to XVS vault
    /// @custom:event FundsTransferredToXVSStore emits on success
    /// @custom:error InsufficientBalance is thrown when amount entered is greater than balance
    /// @custom:access Restricted by ACM
    function fundXVSVault(uint256 amountMantissa) external nonReentrant {
        _checkAccessAllowed("fundXVSVault(uint256)");
        ensureNonzeroValue(amountMantissa);

        uint256 balance = IERC20Upgradeable(XVS_ADDRESS).balanceOf(address(this));

        if (balance < amountMantissa) {
            revert InsufficientBalance();
        }

        address xvsStore = IXVSVault(xvsVault).xvsStore();
        ensureNonzeroAddress(xvsStore);
        IERC20Upgradeable(XVS_ADDRESS).safeTransfer(xvsStore, amountMantissa);

        emit FundsTransferredToXVSStore(xvsStore, amountMantissa);
    }

    /// @notice Function to sweep tokens from the contract
    /// @param tokenAddress Address of the asset(token)
    /// @param to Address to which assets will be transferred
    /// @param amount Amount need to sweep from the contract
    /// @custom:event Emits SweepToken event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when tokenAddress/to address is zero
    /// @custom:error ZeroValueNotAllowed is thrown when amount is zero
    /// @custom:access Only Governance
    function sweepToken(
        address tokenAddress,
        address to,
        uint256 amount
    ) external onlyOwner nonReentrant {
        ensureNonzeroAddress(tokenAddress);
        ensureNonzeroAddress(to);
        ensureNonzeroValue(amount);

        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        token.safeTransfer(to, amount);

        emit SweepToken(tokenAddress, to, amount);
    }

    /// @dev XVS vault setter
    /// @param xvsVault_ Address of the XVS vault
    /// @custom:event XVSVaultUpdated emits on success
    /// @custom:error ZeroAddressNotAllowed is thrown when XVS vault address is zero
    function _setXVSVault(address xvsVault_) internal {
        ensureNonzeroAddress(xvsVault_);
        emit XVSVaultUpdated(xvsVault, xvsVault_);
        xvsVault = xvsVault_;
    }
}
