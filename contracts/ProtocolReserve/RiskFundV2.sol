// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

import { IRiskFund } from "../Interfaces/IRiskFund.sol";
import { ensureNonzeroAddress } from "../Utils/Validators.sol";
import { RiskFundV2Storage } from "./RiskFundStorage.sol";

/// @title RiskFundV2
/// @author Venus
/// @notice Contract with basic features to hold base asset for different Comptrollers
/// @dev This contract does not support BNB
contract RiskFundV2 is Ownable2StepUpgradeable, AccessControlledV8, RiskFundV2Storage, IRiskFund {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Emitted when convertible base asset address is updated
    event ConvertibleBaseAssetUpdated(address indexed oldConvertibleBaseAsset, address indexed newConvertibleBaseAsset);

    /// @notice Emitted when pool registry address is updated
    event RiskFundTransformerUpdated(address indexed oldRiskFundTransformer, address indexed newRiskFundTransformer);

    /// @notice Emitted when shortfall contract address is updated
    event ShortfallContractUpdated(address indexed oldShortfallContract, address indexed newShortfallContract);

    /// @notice Emitted when reserves are transferred for auction
    event TransferredReserveForAuction(address indexed comptroller, uint256 amount);

    /// @notice Emitted when pool states is updated with amount transferred to this contract
    event PoolStateUpdated(address comptroller, uint256 amount);

    /// @notice Error is thrown when updatePoolState is not called by riskFundTransformer
    error InvalidRiskFundTransformer();

    /// @notice Error is thrown when transferReserveForAuction is not called by shortfall
    error InvalidShortfallAddress();

    /// @notice Error is thrown when pool reserve is less than the amount needed
    error InsufficientPoolReserve(uint256 amount, uint256 poolReserve);

    /// @dev Convertible base asset setter
    /// @param convertibleBaseAsset_ Address of the convertible base asset
    /// @custom:event ConvertibleBaseAssetUpdated emit on success
    /// @custom:error ZeroAddressNotAllowed is thrown when risk fund transformer address is zero
    function setConvertibleBaseAsset(address convertibleBaseAsset_) external onlyOwner {
        ensureNonzeroAddress(convertibleBaseAsset_);
        address oldConvertibleBaseAsset = convertibleBaseAsset;
        convertibleBaseAsset = convertibleBaseAsset_;
        emit ConvertibleBaseAssetUpdated(oldConvertibleBaseAsset, convertibleBaseAsset_);
    }

    /// @dev Risk fund transformer setter
    /// @param riskFundTransformer_ Address of the risk fund transformer
    /// @custom:event RiskFundTransformerUpdated emit on success
    /// @custom:error ZeroAddressNotAllowed is thrown when risk fund transformer address is zero
    function setRiskFundTransformer(address riskFundTransformer_) external onlyOwner {
        ensureNonzeroAddress(riskFundTransformer_);
        address oldRiskFundTransformer = riskFundTransformer;
        riskFundTransformer = riskFundTransformer_;
        emit RiskFundTransformerUpdated(oldRiskFundTransformer, riskFundTransformer_);
    }

    /// @dev Shortfall contract address setter
    /// @param shortfallContractAddress_ Address of the auction contract
    /// @custom:error ZeroAddressNotAllowed is thrown when shortfall contract address is zero
    function setShortfallContractAddress(address shortfallContractAddress_) external onlyOwner {
        ensureNonzeroAddress(shortfallContractAddress_);
        address oldShortfallContractAddress = shortfall;
        shortfall = shortfallContractAddress_;
        emit ShortfallContractUpdated(oldShortfallContractAddress, shortfallContractAddress_);
    }

    /// @dev Transfer tokens for auction
    /// @param comptroller Comptroller of the pool
    /// @param bidder Amount transferred to bidder address
    /// @param amount Amount to be transferred to auction contract
    /// @return Number reserved tokens.
    /// @custom:error InvalidShortfallAddress is thrown when risk fund transformer address is zero
    /// @custom:error InsufficientPoolReserve is thrown when risk fund transformer address is zero
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
            revert InsufficientPoolReserve(amount, poolReserve);
        }

        unchecked {
            poolReserves[comptroller] = poolReserve - amount;
        }

        IERC20Upgradeable(convertibleBaseAsset).safeTransfer(bidder, amount);
        emit TransferredReserveForAuction(comptroller, amount);

        return amount;
    }

    /// @dev Update the reserve of the asset for the specific pool after transferring to risk fund
    /// @param comptroller  Comptroller address(pool)
    /// @param amount Amount transferred for the pool
    function updatePoolState(address comptroller, uint256 amount) public {
        if (msg.sender != riskFundTransformer) {
            revert InvalidRiskFundTransformer();
        }

        poolReserves[comptroller] += amount;
        emit PoolStateUpdated(comptroller, amount);
    }
}
