import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { multisigs } from "../helpers/utils";

const func = async ({ network: { live, name }, getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const xvsAddress = (await ethers.getContract("XVS"))?.address;
  const proxyOwnerAddress = (await ethers.getContractOrNull("NormalTimelock"))?.address || multisigs[name];
  const acmAddress = (await ethers.getContract("AccessControlManager"))?.address;
  const xvsVaultAddress = (await ethers.getContract("XVSVaultProxy"))?.address;

  await deploy("XVSVaultTreasury", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [xvsAddress],
    proxy: live
      ? {
          owner: proxyOwnerAddress,
          proxyContract: "OpenZeppelinTransparentProxy",
          execute: {
            methodName: "initialize",
            args: [acmAddress, xvsVaultAddress],
          },
        }
      : undefined,
  });

  const xvsVaultTreasury = await ethers.getContract("XVSVaultTreasury");

  if (live) {
    const tx = await xvsVaultTreasury.transferOwnership(proxyOwnerAddress);
    await tx.wait();
    console.log("Transferred ownership of XVSVaultTreasury to Timelock");
  }
};

func.tags = ["XVSVaultTreasury"];

export default func;
