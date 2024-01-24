import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESS_ONE, multisigs } from "../helpers/utils";

const MAX_LOOPS_LIMIT = 20;

module.exports = async ({ network: { live, name }, getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const timelockAddress = (await ethers.getContractOrNull("NormalTimelock"))?.address || multisigs[name];
  const acmAddress = (await ethers.getContractOrNull("AccessControlManager"))?.address || ADDRESS_ONE;

  await deploy("ConverterNetwork", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      owner: live ? timelockAddress : deployer,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [acmAddress, MAX_LOOPS_LIMIT],
      },
    },
  });

  const converterNetwork = await ethers.getContract("ConverterNetwork");

  if (live) {
    const tx = await converterNetwork.transferOwnership(timelockAddress);
    await tx.wait();
    console.log("Transferred ownership of ConverterNetwork to Timelock");
  }
};

module.exports.tags = ["ConverterNetwork"];
