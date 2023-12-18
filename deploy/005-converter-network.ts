import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const MAX_LOOPS_LIMIT = 100;

module.exports = async ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const timelockAddress = (await ethers.getContract("NormalTimelock")).address;
  const acmAddress = (await ethers.getContract("AccessControlManager")).address;

  await deploy("ConverterNetwork", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      owner: timelockAddress,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [acmAddress, MAX_LOOPS_LIMIT],
      },
    },
  });

  const converterNetwork = await ethers.getContract("ConverterNetwork");
  const converterNetworkOwner = await converterNetwork.owner();
  if (converterNetworkOwner === deployer) {
    const tx = await converterNetwork.transferOwnership(timelockAddress);
    await tx.wait();
    console.log("Transferred ownership of ConverterNetwork to Timelock");
  }
};

module.exports.tags = ["ConverterNetwork"];
