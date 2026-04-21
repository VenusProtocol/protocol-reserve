import { ethers } from "hardhat";
import { DeploymentsExtension } from "hardhat-deploy/types";

export async function getContractAddressOrNullAddress(
  deployments: DeploymentsExtension,
  name: string,
): Promise<string> {
  const deployment = await deployments.getOrNull(name);
  return deployment ? deployment.address : ethers.constants.AddressZero;
}
