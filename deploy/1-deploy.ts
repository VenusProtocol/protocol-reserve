import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async ({
  network: { live },
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) => {
  const MOCK_ADDRESS = live ? undefined : "0x0000000000000000000000000000000000000001";
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const vBNBAddress = (await ethers.getContractOrNull("vBNB"))?.address || MOCK_ADDRESS;
  const comptrollerAddress = (await ethers.getContractOrNull("Unitroller"))?.address || MOCK_ADDRESS;
  const WBNBAddress = (await ethers.getContractOrNull("WBNB"))?.address || MOCK_ADDRESS;
  const timelockAddress = (await ethers.getContractOrNull("NormalTimelock"))?.address || MOCK_ADDRESS;
  const acmAddress = (await ethers.getContractOrNull("AccessControlManager"))?.address || MOCK_ADDRESS;
  const loopsLimit = 20;

  await deploy("ProtocolShareReserve", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [comptrollerAddress, WBNBAddress, vBNBAddress],
    proxy: {
      owner: live ? timelockAddress : deployer,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [acmAddress, loopsLimit],
      },
    },
  });
};

func.tags = ["deploy"];

export default func;
