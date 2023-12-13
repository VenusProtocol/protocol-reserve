import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

module.exports = async ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const xvsAddress = (await ethers.getContract("XVS")).address;
  const proxyOwnerAddress = (await ethers.getContract("NormalTimelock")).address;
  const acmAddress = (await ethers.getContract("AccessControlManager")).address;
  const xvsVaultAddress = (await ethers.getContract("XVSVaultProxy")).address;

  await deploy("XVSVaultTreasury", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [xvsAddress],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [acmAddress, xvsVaultAddress],
      },
    },
  });

  const xvsVaultTreasury = await ethers.getContract("XVSVaultTreasury");
  const xvsVaultTreasuryOwner = await xvsVaultTreasury.owner();
  if (xvsVaultTreasuryOwner === deployer) {
    const tx = await xvsVaultTreasury.transferOwnership(proxyOwnerAddress);
    await tx.wait();
    console.log("Transferred ownership of XVSVaultTreasury to Timelock");
  }
};

module.exports.tags = ["XVSVaultTreasury"];
