import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getContractAddressOrNullAddress } from "../helpers/deploymentConfig";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const acmAddress = (await deployments.get("AccessControlManager")).address;
  const riskFundAddress = (await deployments.get("RiskFundV2")).address;
  const usdtAddress = (await deployments.get("USDT")).address;
  const psrAddress = (await deployments.get("ProtocolShareReserve")).address;

  const proxyAdminOwner = await getContractAddressOrNullAddress(deployments, "NormalTimelock");

  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  await deploy("RiskFundBuyback", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    contract: "TokenBuyback",
    args: [riskFundAddress, usdtAddress, psrAddress],
    proxy: {
      owner: proxyAdminOwner,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      execute: {
        methodName: "initialize",
        args: [acmAddress],
      },
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
  });

  // transfer ownership to timelock
  {
    const timelockAddress = await getContractAddressOrNullAddress(deployments, "NormalTimelock");
    const riskFundBuyback = await ethers.getContract("RiskFundBuyback");
    const currentOwner = (await riskFundBuyback.owner()).toLowerCase();
    const pendingOwner = (await riskFundBuyback.pendingOwner()).toLowerCase();

    if (currentOwner !== timelockAddress.toLowerCase() && pendingOwner === ethers.constants.AddressZero) {
      const tx = await riskFundBuyback.transferOwnership(timelockAddress);
      await tx.wait();
      console.log(`Ownership transfer initiated to NormalTimelock (${timelockAddress})`);
    } else {
      console.log(`Ownership transfer already pending to ${pendingOwner}`);
    }
  }
};

func.tags = ["RiskFundBuyback"];

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  return hre.network.name !== "bscmainnet" && hre.network.name !== "bsctestnet";
};

export default func;
