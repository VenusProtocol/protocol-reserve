import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESS_ONE, multisigs } from "../helpers/utils";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {
    network: { live, name },
    getNamedAccounts,
    deployments,
  } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const vBNBAddress = (await ethers.getContractOrNull("vBNB"))?.address || ADDRESS_ONE;

  // Support BSC and other networks
  let comptrollerAddress = ADDRESS_ONE;
  try {
    comptrollerAddress = (await ethers.getContract("Unitroller"))?.address;
  } catch (e) {
    console.log("Unitroller not found, using AddressOne");
  }

  const WBNBAddress = (await ethers.getContractOrNull("WBNB"))?.address || ADDRESS_ONE;
  const timelockAddress = (await ethers.getContract("NormalTimelock"))?.address || multisigs[name];
  const acmAddress = (await ethers.getContract("AccessControlManager"))?.address;
  const loopsLimit = 20;

  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  await deploy("ProtocolShareReserve", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [comptrollerAddress, WBNBAddress, vBNBAddress],
    proxy: live
      ? {
          owner: timelockAddress,
          proxyContract: "OpenZeppelinTransparentProxy",
          execute: {
            methodName: "initialize",
            args: [acmAddress, loopsLimit],
          },
          viaAdminContract: {
            name: "DefaultProxyAdmin",
            artifact: defaultProxyAdmin,
          },
        }
      : {
          owner: deployer,
          proxyContract: "OpenZeppelinTransparentProxy",
          execute: {
            methodName: "initialize",
            args: [acmAddress, loopsLimit],
          },
        },
  });

  const psr = await hre.ethers.getContract("ProtocolShareReserve");

  if (live) {
    const tx = await psr.transferOwnership(timelockAddress);
    await tx.wait();
    console.log("Transferred ownership of PSR to Timelock");
  }
};

func.tags = ["ProtocolShareReserve"];

export default func;
