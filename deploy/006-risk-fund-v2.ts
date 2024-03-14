import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { multisigs } from "../helpers/utils";

const func: DeployFunction = async ({
  network: { name },
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyAdmin = await ethers.getContract("DefaultProxyAdmin");
  const owner = await proxyAdmin.owner();

  await deploy("RiskFundV2", {
    from: deployer,
    contract: "RiskFundV2",
    proxy: {
      owner: owner,
      proxyContract: "OpenZeppelinTransparentProxy",
      upgradeIndex: 0,
    },
    autoMine: true,
    log: true,
  });

  const targetOwner = (await ethers.getContractOrNull("NormalTimelock"))?.address || multisigs[name];

  const contract = await ethers.getContract("RiskFundV2");
  if ((await contract.owner()) !== targetOwner && (await contract.pendingOwner()) !== targetOwner) {
    console.log(`Transferring ownership of RiskFundV2 to ${targetOwner}`);
    const tx = await contract.transferOwnership(targetOwner);
    await tx.wait();
  }
};

func.tags = ["RiskFundV2"];

export default func;
