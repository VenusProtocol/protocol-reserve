import { ethers } from "hardhat";
import { DeploymentsExtension } from "hardhat-deploy/types";

export async function getContractAddressOrNullAddress(
  deployments: DeploymentsExtension,
  name: string,
): Promise<string> {
  const deployment = await deployments.getOrNull(name);
  return deployment ? deployment.address : ethers.constants.AddressZero;
}

/// Default USD caps and slippage threshold for TokenBuyback instances. All values are
/// 1e18-scaled. Governance can tune per-instance via the ACM-gated setters after deploy.
export const TOKEN_BUYBACK_DEFAULTS = {
  dailyCapUsd: ethers.utils.parseUnits("30000", 18), // $30k / 24h
  perBlockCapUsd: ethers.utils.parseUnits("5000", 18), // $5k / block
  slippageEventUsd: ethers.utils.parseUnits("500", 18), // $500 absolute floor
};
