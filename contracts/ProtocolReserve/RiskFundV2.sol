// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { IRiskFund } from "../Interfaces/IRiskFund.sol";
import { IRiskFundConverter } from "../Interfaces/IRiskFundConverter.sol";
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

    /// @notice Emitted when pool asset states is updated with amount transferred to this contract
    event PoolAssetsIncreased(address indexed comptroller, address indexed asset, uint256 amount);

    /// @notice Emitted when pool asset states is updated with amount transferred from this contract on sweeping tokens
    event PoolAssetsDecreased(address indexed comptroller, address indexed asset, uint256 amount);

    /// @notice Event emitted when tokens are swept
    event SweepToken(address indexed token, address indexed to, uint256 amount);

    /// @notice Event emitted when tokens are swept and transferred from pool
    event SweepTokenFromPool(address indexed token, address indexed comptroller, uint256 amount);

    /// @notice Error is thrown when updatePoolState is not called by riskFundConverter
    error InvalidRiskFundConverter();

    /// @notice Error is thrown when transferReserveForAuction is called by non shortfall address
    error InvalidShortfallAddress();

    /// @notice thrown when amount entered is greater than balance
    error InsufficientBalance();

    /// @notice Error is thrown when pool reserve is less than the amount needed
    error InsufficientPoolReserve(address comptroller, uint256 amount, uint256 poolReserve);

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

    /// @dev Transfer tokens for auction to shortfall contract
    /// @param comptroller Comptroller of the pool
    /// @param amount Amount to be transferred to the shortfall
    /// @return Amount of tokens transferred to the shortfall
    /// @custom:event TransferredReserveForAuction emit on success
    /// @custom:error InvalidShortfallAddress is thrown when caller is not shortfall contract
    /// @custom:error InsufficientPoolReserve is thrown when pool reserve is less than the amount needed
    /// @custom:access Only Shortfall contract
    function transferReserveForAuction(address comptroller, uint256 amount)
        external
        override
        nonReentrant
        returns (uint256)
    {
        uint256 poolReserve = poolAssetsFunds[comptroller][convertibleBaseAsset];

        if (msg.sender != shortfall) {
            revert InvalidShortfallAddress();
        }
        if (amount > poolReserve) {
            revert InsufficientPoolReserve(comptroller, amount, poolReserve);
        }

        unchecked {
            poolAssetsFunds[comptroller][convertibleBaseAsset] = poolReserve - amount;
        }

        IERC20Upgradeable(convertibleBaseAsset).safeTransfer(shortfall, amount);
        emit TransferredReserveForAuction(comptroller, amount);

        return amount;
    }

    /// @notice Function to sweep baseAsset for pool, Tokens are sent to address(to)
    /// @param tokenAddress Address of the asset(token)
    /// @param to Address to which assets will be transferred
    /// @param amount Amount need to sweep for the pool
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
        preSweepToken(tokenAddress, amount);
        token.safeTransfer(to, amount);

        emit SweepToken(tokenAddress, to, amount);
    }

    /// @notice Function to sweep token from pool
    /// @param tokenAddress Address of the asset(token)
    /// @param comptroller Pool address to which assets will be transferred
    /// @param amount Amount need to sweep from the pool
    /// @custom:event Emits sweepTokenFromPool event on success
    /// @custom:error ZeroAddressNotAllowed is thrown when tokenAddress/comptroller address is zero
    /// @custom:error ZeroValueNotAllowed is thrown when amount is zero
    /// @custom:access Only Governance
    function sweepTokenFromPool(
        address tokenAddress,
        address comptroller,
        uint256 amount
    ) external onlyOwner nonReentrant {
        ensureNonzeroAddress(tokenAddress);
        ensureNonzeroAddress(comptroller);
        ensureNonzeroValue(amount);

        uint256 poolReserve = poolAssetsFunds[comptroller][tokenAddress];

        if (amount > poolReserve) {
            revert InsufficientPoolReserve(comptroller, amount, poolReserve);
        }

        unchecked {
            poolAssetsFunds[comptroller][tokenAddress] = poolReserve - amount;
        }

        IERC20Upgradeable(tokenAddress).safeTransfer(comptroller, amount);

        emit SweepTokenFromPool(tokenAddress, comptroller, amount);
    }

    /**
     * @notice Get the Amount of the Base asset in the risk fund for the specific pool.
     * @param comptroller  Comptroller address(pool).
     * @return Base Asset's reserve in risk fund.
     */
    function getPoolsBaseAssetReserves(address comptroller) external view returns (uint256) {
        return poolAssetsFunds[comptroller][convertibleBaseAsset];
    }

    /// @dev Update the reserve of the asset for the specific pool after transferring to risk fund
    /// @param comptroller Comptroller address (pool)
    /// @param asset Address of the asset(token)
    /// @param amount Amount transferred for the pool
    /// @custom:event PoolAssetsIncreased emits on success
    /// @custom:error InvalidRiskFundConverter is thrown if caller is not riskFundConverter contract
    /// @custom:access Only RiskFundConverter contract
    function updatePoolState(
        address comptroller,
        address asset,
        uint256 amount
    ) public {
        if (msg.sender != riskFundConverter) {
            revert InvalidRiskFundConverter();
        }

        poolAssetsFunds[comptroller][asset] += amount;
        emit PoolAssetsIncreased(comptroller, asset, amount);
    }

    /// @dev Operations to perform before sweeping tokens
    /// @param tokenAddress Address of the token
    /// @param amount Amount transferred to address(to)
    /// @custom:error InsufficientBalance is thrown when amount entered is greater than balance
    function preSweepToken(address tokenAddress, uint256 amount) internal {
        uint256 balance = IERC20Upgradeable(tokenAddress).balanceOf(address(this));
        if (amount > balance) revert InsufficientBalance();

        address[] memory pools = IRiskFundConverter(riskFundConverter).getPools(tokenAddress);

        uint256 assetReserves;
        uint256 poolsLength = pools.length;
        for (uint256 i; i < poolsLength; ) {
            assetReserves += poolAssetsFunds[pools[i]][tokenAddress];
            unchecked {
                ++i;
            }
        }

        uint256 balanceDiff = balance - assetReserves;

        if (balanceDiff < amount) {
            uint256 amountDiff;
            unchecked {
                amountDiff = amount - balanceDiff;
            }
            uint256 distributedShare;
            for (uint256 i; i < poolsLength; ) {
                if (poolAssetsFunds[pools[i]][tokenAddress] != 0) {
                    uint256 poolAmountShare;
                    if (i < (poolsLength - 1)) {
                        poolAmountShare = (poolAssetsFunds[pools[i]][tokenAddress] * amount) / assetReserves;
                        distributedShare += poolAmountShare;
                    } else {
                        poolAmountShare = amountDiff - distributedShare;
                    }
                    poolAssetsFunds[pools[i]][tokenAddress] -= poolAmountShare;
                    emit PoolAssetsDecreased(pools[i], tokenAddress, poolAmountShare);
                }
                unchecked {
                    ++i;
                }
            }
        }
    }
}
