import hre, { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const vBNBAddress = (await ethers.getContract("vBNB")).address;
  const comptrollerAddress = (await ethers.getContract("Unitroller")).address;
  const WBNBAddress = (await ethers.getContract("WBNB")).address;
  const timelockAddress = (await ethers.getContract("NormalTimelock")).address;
  const acmAddress = (await ethers.getContract("AccessControlManager")).address;
  const loopsLimit = 20;

  await deploy("ProtocolShareReserve", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [comptrollerAddress, WBNBAddress, vBNBAddress],
    proxy: {
      owner: timelockAddress,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [acmAddress, loopsLimit],
      },
    },
  });

  const psr = await hre.ethers.getContract("ProtocolShareReserve");
  const psrOwner = await psr.owner();

  if (psrOwner === deployer) {
    const tx = await psr.transferOwnership(timelockAddress);
    await tx.wait();
    console.log("Transferred ownership of PSR to Timelock");
  }
};

func.tags = ["deploy"];

export default func;
