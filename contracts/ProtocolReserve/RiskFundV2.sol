// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import { IRiskFund } from "../Interfaces/IRiskFund.sol";
import { ensureNonzeroAddress } from "../Utils/Validators.sol";
import { RiskFundV2Storage } from "./RiskFundStorage.sol";

/// @title RiskFundV2
/// @author Venus
/// @notice Contract with basic features to hold base asset for different Comptrollers
/// @dev This contract does not support BNB
contract RiskFundV2 is
    Ownable2StepUpgradeable,
    AccessControlledV8,
    RiskFundV2Storage,
    IRiskFund,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Emitted when convertible base asset address is updated
    event ConvertibleBaseAssetUpdated(address indexed oldConvertibleBaseAsset, address indexed newConvertibleBaseAsset);

    /// @notice Emitted when risk fund converter address is updated
    event RiskFundConverterUpdated(address indexed oldRiskFundConverter, address indexed newRiskFundConverter);

    /// @notice Emitted when shortfall contract address is updated
    event ShortfallContractUpdated(address indexed oldShortfallContract, address indexed newShortfallContract);

    /// @notice Emitted when reserves are transferred for auction
    event TransferredReserveForAuction(address indexed comptroller, uint256 amount);

    /// @notice Emitted when pool states is updated with amount transferred to this contract
    event PoolStateUpdated(address indexed comptroller, uint256 amount);

    /// @notice Event emitted when tokens are swept
    event SweepToken(address indexed comptroller, uint256 amount);

    /// @notice Error is thrown when updatePoolState is not called by riskFundConverter
    error InvalidRiskFundConverter();

    /// @notice Error is thrown when transferReserveForAuction is called by non shortfall address
    error InvalidShortfallAddress();

    /// @notice Error is thrown when pool reserve is less than the amount needed
    error InsufficientPoolReserve(address comptroller, uint256 amount, uint256 poolReserve);

    /// @dev Convertible base asset setter
    /// @param convertibleBaseAsset_ Address of the convertible base asset
    /// @custom:event ConvertibleBaseAssetUpdated emit on success
    /// @custom:error ZeroAddressNotAllowed is thrown when risk fund converter address is zero
    function setConvertibleBaseAsset(address convertibleBaseAsset_) external onlyOwner {
        ensureNonzeroAddress(convertibleBaseAsset_);
        emit ConvertibleBaseAssetUpdated(convertibleBaseAsset, convertibleBaseAsset_);
        convertibleBaseAsset = convertibleBaseAsset_;
    }

    /// @dev Risk fund converter setter
    /// @param riskFundConverter_ Address of the risk fund converter
    /// @custom:event RiskFundConverterUpdated emit on success
    /// @custom:error ZeroAddressNotAllowed is thrown when risk fund converter address is zero
    function setRiskFundConverter(address riskFundConverter_) external onlyOwner {
        ensureNonzeroAddress(riskFundConverter_);
        emit RiskFundConverterUpdated(riskFundConverter, riskFundConverter_);
        riskFundConverter = riskFundConverter_;
    }

    /// @dev Shortfall contract address setter
    /// @param shortfallContractAddress_ Address of the auction contract
    /// @custom:error ZeroAddressNotAllowed is thrown when shortfall contract address is zero
    function setShortfallContractAddress(address shortfallContractAddress_) external onlyOwner {
        ensureNonzeroAddress(shortfallContractAddress_);
        emit ShortfallContractUpdated(shortfall, shortfallContractAddress_);
        shortfall = shortfallContractAddress_;
    }

    /// @dev Transfer tokens for auction
    /// @param comptroller Comptroller of the pool
    /// @param bidder Amount transferred to bidder address
    /// @param amount Amount to be transferred to auction contract
    /// @return Number reserved tokens.
    /// @custom:error InvalidShortfallAddress is thrown on invalid shortfall address
    /// @custom:error InsufficientPoolReserve is thrown when pool reserve is less than the amount needed
    function transferReserveForAuction(
        address comptroller,
        address bidder,
        uint256 amount
    ) external override returns (uint256) {
        uint256 poolReserve = poolReserves[comptroller];

        if (msg.sender != shortfall) {
            revert InvalidShortfallAddress();
        }
        if (amount > poolReserve) {
            revert InsufficientPoolReserve(comptroller, amount, poolReserve);
        }

        unchecked {
            poolReserves[comptroller] = poolReserve - amount;
        }

        IERC20Upgradeable(convertibleBaseAsset).safeTransfer(bidder, amount);
        emit TransferredReserveForAuction(comptroller, amount);

        return amount;
    }

    /// @notice Function to sweep baseAsset for pool, Tokens are sent to admin (timelock)
    /// @param comptroller The address of the pool for the amount need to be sweeped
    /// @param amount Amount need to sweep for the pool
    /// @custom:event Emits SweepToken event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when tokenAddress/to address is zero
    /// @custom:error InsufficientPoolReserve is thrown when pool reserve is less than the amount needed
    /// @custom:access Only Governance
    function sweepToken(address comptroller, uint256 amount) external onlyOwner nonReentrant {
        ensureNonzeroAddress(comptroller);

        uint256 poolReserve = poolReserves[comptroller];
        if (amount > poolReserve) {
            revert InsufficientPoolReserve(comptroller, amount, poolReserve);
        }
        poolReserves[comptroller] = poolReserve - amount;

        IERC20Upgradeable token = IERC20Upgradeable(convertibleBaseAsset);
        token.safeTransfer(owner(), amount);

        emit SweepToken(comptroller, amount);
    }

    /// @dev Update the reserve of the asset for the specific pool after transferring to risk fund
    /// @param comptroller Comptroller address (pool)
    /// @param amount Amount transferred for the pool
    function updatePoolState(address comptroller, uint256 amount) public {
        if (msg.sender != riskFundConverter) {
            revert InvalidRiskFundConverter();
        }

        poolReserves[comptroller] += amount;
        emit PoolStateUpdated(comptroller, amount);
    }
}
