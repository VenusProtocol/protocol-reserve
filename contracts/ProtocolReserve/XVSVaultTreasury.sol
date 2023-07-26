// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

import { ensureNonzeroAddress } from "../Utils/Validators.sol";
import { IXVSVault } from "../Interfaces/IXVSVault.sol";

contract XVSVaultTreasury is AccessControlledV8 {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice The xvsvault address
    address public xvsVault;

    /// @notice The xvs token address
    address public xvsAddress;

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain.
    /// See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    uint256[48] private __gap;

    /// @notice Emitted when XVS vault address is updated
    event XVSVaultUpdated(address indexed oldXVSVault, address indexed newXVSVault);

    /// @notice Emitted when XVS vault address is updated
    event XVSAddressUpdated(address indexed oldXVSVault, address indexed newXVSVault);

    /// @notice Emitted when funds transferred to XVSStore address
    event FundsTransferredToXVSStore(address indexed xvsStore, uint256 amountMantissa);

    /// @notice Thrown when given input amount is zero
    error InsufficientBalance();

    /// @dev XVS vault setter
    /// @param xvsVault_ Address of the XVS vault
    function setXVSVault(address xvsVault_) external onlyOwner {
        _setXVSVault(xvsVault_);
    }

    /// @dev xvs address setter
    /// @param xvsAddress_ Address of the xvs address
    function setXVSAddress(address xvsAddress_) external onlyOwner {
        _setXVSAddress(xvsAddress_);
    }

    /// @param accessControlManager_ Access control manager contract address
    /// @param xvsVault_ XVSVault address
    /// @param xvsAddress_ XVS address
    function initialize(
        address accessControlManager_,
        address xvsVault_,
        address xvsAddress_
    ) public virtual initializer {
        __AccessControlled_init(accessControlManager_);

        _setXVSVault(xvsVault_);

        _setXVSAddress(xvsAddress_);
    }

    function fundXVSVault(uint256 amountMantissa) external {
        _checkAccessAllowed("fundXVSVault(amountMantissa)");

        uint256 balance = IERC20Upgradeable(xvsAddress).balanceOf(address(this));

        if (balance < amountMantissa) {
            revert InsufficientBalance();
        }

        address xvsStore = IXVSVault(xvsVault).xvsStore();
        IERC20Upgradeable(xvsAddress).safeTransfer(xvsStore, amountMantissa);

        emit FundsTransferredToXVSStore(xvsStore, amountMantissa);
    }

    /// @dev This function is called by protocolShareReserve
    /// @param comptroller Comptroller address (pool)
    /// @param asset Asset address.
    function updateAssetsState(address comptroller, address asset) public {}

    /// @dev XVS vault setter
    /// @param xvsVault_ Address of the XVS vault
    /// @custom:event XVSVaultUpdated emits on success
    /// @custom:error ZeroAddressNotAllowed is thrown when XVS vault address is zero
    function _setXVSVault(address xvsVault_) internal {
        ensureNonzeroAddress(xvsVault_);
        address oldXVSVault = xvsVault;
        xvsVault = xvsVault_;
        emit XVSVaultUpdated(oldXVSVault, xvsVault_);
    }

    /// @dev xvs address setter
    /// @param xvsAddress_ Address of the xvs address
    /// @custom:event XVSAddressUpdated emits on success
    /// @custom:error ZeroAddressNotAllowed is thrown when xvs address is zero
    function _setXVSAddress(address xvsAddress_) internal {
        ensureNonzeroAddress(xvsAddress_);
        address oldXVSAddress = xvsAddress;
        xvsAddress = xvsAddress_;
        emit XVSAddressUpdated(oldXVSAddress, xvsAddress_);
    }
}
