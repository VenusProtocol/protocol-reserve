import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESS_ONE, multisigs } from "../helpers/utils";

module.exports = async ({ network: { live, name }, getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const xvsAddress = (await ethers.getContractOrNull("XVS"))?.address || ADDRESS_ONE;
  const proxyOwnerAddress =
    (await ethers.getContractOrNull("NormalTimelock"))?.address || ADDRESS_ONE || multisigs[name];
  const acmAddress = (await ethers.getContractOrNull("AccessControlManager"))?.address || ADDRESS_ONE;
  const xvsVaultAddress = (await ethers.getContractOrNull("XVSVaultProxy"))?.address || ADDRESS_ONE;

  await deploy("XVSVaultTreasury", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [xvsAddress],
    proxy: {
      owner: live ? proxyOwnerAddress : deployer,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [acmAddress, xvsVaultAddress],
      },
    },
  });

  const xvsVaultTreasury = await ethers.getContract("XVSVaultTreasury");

  if (live) {
    const tx = await xvsVaultTreasury.transferOwnership(proxyOwnerAddress);
    await tx.wait();
    console.log("Transferred ownership of XVSVaultTreasury to Timelock");
  }
};

module.exports.tags = ["XVSVaultTreasury"];
