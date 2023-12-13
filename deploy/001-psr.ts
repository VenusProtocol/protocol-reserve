import hre, { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

module.exports = async ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const loopsLimit = 20;
  const corepoolAddress = (await ethers.getContract("Unitroller")).address;
  const wBNBAddress = (await ethers.getContract("WBNB")).address;
  const vBNBAddress = (await ethers.getContract("vBNB")).address;
  const acmAddress = (await ethers.getContract("AccessControlManager")).address;
  const timelockAddress = (await ethers.getContract("NormalTimelock")).address;

  await deploy("ProtocolShareReserve", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [corepoolAddress, wBNBAddress, vBNBAddress],
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

module.exports.tags = ["ProtocolShareReserve"];
