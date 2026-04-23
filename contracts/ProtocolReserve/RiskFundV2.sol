// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { IRiskFund } from "../Interfaces/IRiskFund.sol";
import { RiskFundV2Storage } from "./RiskFundStorage.sol";

/// @title RiskFundV2
/// @author Venus
/// @notice Contract with basic features to hold base asset for different Comptrollers
/// @dev This contract does not support BNB
/// @custom:security-contact https://github.com/VenusProtocol/protocol-reserve#discussion
contract RiskFundV2 is AccessControlledV8, RiskFundV2Storage, IRiskFund {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Emitted when convertible base asset address is updated
    event ConvertibleBaseAssetUpdated(address indexed oldConvertibleBaseAsset, address indexed newConvertibleBaseAsset);

    /// @notice Emitted when risk fund converter address is updated
    event RiskFundConverterUpdated(address indexed oldRiskFundConverter, address indexed newRiskFundConverter);

    /// @notice Emitted when shortfall contract address is updated
    event ShortfallContractUpdated(address indexed oldShortfallContract, address indexed newShortfallContract);

    /// @notice Emitted when reserves are transferred for auction
    event TransferredReserveForAuction(address indexed comptroller, uint256 amount);

    /// @notice Event emitted when tokens are swept
    event SweepToken(address indexed token, address indexed to, uint256 amount);

    /// @notice Error is thrown when transferReserveForAuction is called by non shortfall address
    error InvalidShortfallAddress();

    /// @notice thrown when amount entered is greater than balance
    error InsufficientBalance();

    /// @dev Convertible base asset setter
    /// @param convertibleBaseAsset_ Address of the convertible base asset
    /// @custom:event ConvertibleBaseAssetUpdated emit on success
    /// @custom:error ZeroAddressNotAllowed is thrown when convertible base asset address is zero
    /// @custom:access Only Governance
    function setConvertibleBaseAsset(address convertibleBaseAsset_) external onlyOwner {
        ensureNonzeroAddress(convertibleBaseAsset_);
        emit ConvertibleBaseAssetUpdated(convertibleBaseAsset, convertibleBaseAsset_);
        convertibleBaseAsset = convertibleBaseAsset_;
    }

    /// @dev Risk fund converter setter
    /// @param riskFundConverter_ Address of the risk fund converter
    /// @custom:event RiskFundConverterUpdated emit on success
    /// @custom:error ZeroAddressNotAllowed is thrown when risk fund converter address is zero
    /// @custom:access Only Governance
    function setRiskFundConverter(address riskFundConverter_) external onlyOwner {
        ensureNonzeroAddress(riskFundConverter_);
        emit RiskFundConverterUpdated(riskFundConverter, riskFundConverter_);
        riskFundConverter = riskFundConverter_;
    }

    /// @dev Shortfall contract address setter
    /// @param shortfallContractAddress_ Address of the auction contract
    /// @custom:event ShortfallContractUpdated emit on success
    /// @custom:error ZeroAddressNotAllowed is thrown when shortfall contract address is zero
    /// @custom:access Only Governance
    function setShortfallContractAddress(address shortfallContractAddress_) external onlyOwner {
        ensureNonzeroAddress(shortfallContractAddress_);
        emit ShortfallContractUpdated(shortfall, shortfallContractAddress_);
        shortfall = shortfallContractAddress_;
    }

    /// @dev Transfers convertibleBaseAsset to the Shortfall contract for an auction.
    ///      Per-pool accounting was removed (isolated pools are wound down and core pool
    ///      does not auction), so the call now draws against this contract's raw balance.
    ///      The `comptroller` argument is kept for ABI parity with Shortfall.sol and is
    ///      echoed in the event only.
    /// @param comptroller Comptroller of the pool (attribution only)
    /// @param amount Amount to be transferred to the shortfall
    /// @return Amount of tokens transferred to the shortfall
    /// @custom:event TransferredReserveForAuction emit on success
    /// @custom:error InvalidShortfallAddress is thrown when caller is not shortfall contract
    /// @custom:error InsufficientBalance is thrown when amount exceeds the contract balance
    /// @custom:access Only Shortfall contract
    function transferReserveForAuction(address comptroller, uint256 amount)
        external
        override
        nonReentrant
        returns (uint256)
    {
        if (msg.sender != shortfall) {
            revert InvalidShortfallAddress();
        }

        uint256 balance = IERC20Upgradeable(convertibleBaseAsset).balanceOf(address(this));
        if (amount > balance) {
            revert InsufficientBalance();
        }

        IERC20Upgradeable(convertibleBaseAsset).safeTransfer(shortfall, amount);
        emit TransferredReserveForAuction(comptroller, amount);

        return amount;
    }

    /// @notice Function to sweep any token held by this contract
    /// @param tokenAddress Address of the asset(token)
    /// @param to Address to which assets will be transferred
    /// @param amount Amount to sweep
    /// @custom:event Emits SweepToken event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when tokenAddress/to address is zero
    /// @custom:error ZeroValueNotAllowed is thrown when amount is zero
    /// @custom:error InsufficientBalance is thrown when amount exceeds the contract balance
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
        preSweepToken(tokenAddress, amount);
        token.safeTransfer(to, amount);

        emit SweepToken(tokenAddress, to, amount);
    }

    /// @notice Returns the RiskFund reserves attributed to a comptroller.
    /// @dev Kept on the ABI for compatibility with `Shortfall.sol` which reads this
    ///      value during auction sizing. Per-pool accounting was removed alongside the
    ///      `poolAssetsFunds` mapping, so this always returns 0 — Shortfall auctions
    ///      for isolated pools are not expected to fire post-migration, and returning
    ///      0 is safer than the raw contract balance (prevents any zombie auction
    ///      from over-sizing its seizedRiskFund against the global pool).
    /// @param comptroller Comptroller address (unused; retained for ABI parity)
    /// @return Always 0
    function getPoolsBaseAssetReserves(address comptroller) external view returns (uint256) {
        comptroller; // silence unused-parameter warning
        return 0;
    }

    /// @dev Operations to perform before sweeping tokens
    /// @param tokenAddress Address of the token
    /// @param amount Amount transferred to address(to)
    /// @custom:error InsufficientBalance is thrown when amount entered is greater than balance
    function preSweepToken(address tokenAddress, uint256 amount) internal view {
        uint256 balance = IERC20Upgradeable(tokenAddress).balanceOf(address(this));
        if (amount > balance) revert InsufficientBalance();
    }
}
