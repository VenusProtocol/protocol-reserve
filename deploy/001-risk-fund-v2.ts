import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { verifyDeployment } from "../helpers/verify";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {
    network: { live },
    getNamedAccounts,
    deployments,
  } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  let owner = deployer;
  if (live) {
    const proxyAdmin = await ethers.getContract("DefaultProxyAdmin");
    owner = await proxyAdmin.owner();
  }

  await deploy("RiskFundV2", {
    from: deployer,
    contract: "RiskFundV2",
    proxy: live
      ? {
          owner: owner,
          proxyContract: "OpenZeppelinTransparentProxy",
          upgradeIndex: 0,
        }
      : undefined,
    autoMine: true,
    log: true,
  });

  if (live) {
    const targetOwner = (await ethers.getContract("NormalTimelock")).address;

    const contract = await ethers.getContract("RiskFundV2");
    if ((await contract.owner()) !== targetOwner && (await contract.pendingOwner()) !== targetOwner) {
      console.log(`Transferring ownership of RiskFundV2 to ${targetOwner}`);
      const tx = await contract.transferOwnership(targetOwner);
      await tx.wait();
    }
  }

  await verifyDeployment(hre, "RiskFundV2");
};

func.tags = ["RiskFundV2"];

export default func;
