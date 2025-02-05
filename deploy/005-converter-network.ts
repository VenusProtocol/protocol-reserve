import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { multisigs } from "../helpers/utils";

const MAX_LOOPS_LIMIT = 20;

const func = async ({ network: { live, name }, getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const timelockAddress = (await ethers.getContractOrNull("NormalTimelock"))?.address || multisigs[name];
  const acmAddress = (await ethers.getContract("AccessControlManager"))?.address;

  await deploy("ConverterNetwork", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: live
      ? {
          owner: timelockAddress,
          proxyContract: "OpenZeppelinTransparentProxy",
          execute: {
            methodName: "initialize",
            args: [acmAddress, MAX_LOOPS_LIMIT],
          },
        }
      : undefined,
  });

  const converterNetwork = await ethers.getContract("ConverterNetwork");

  if (live) {
    const tx = await converterNetwork.transferOwnership(timelockAddress);
    await tx.wait();
    console.log("Transferred ownership of ConverterNetwork to Timelock");
  }
};

func.tags = ["ConverterNetwork", "Converters"];

export default func;
