import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getContractAddressOrNullAddress } from "../helpers/deploymentConfig";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const acmAddress = (await deployments.get("AccessControlManager")).address;
  const plpAddress = (await deployments.get("PrimeLiquidityProvider")).address;
  const psrAddress = (await deployments.get("ProtocolShareReserve")).address;

  const baseAssets: Record<string, string> = {
    USDTPrimeBuyback: (await deployments.get("USDT")).address,
    USDCPrimeBuyback: (await deployments.get("USDC")).address,
    BTCBPrimeBuyback: (await deployments.get(hre.network.name === "hardhat" ? "MockBTCB" : "BTCB")).address,
    ETHPrimeBuyback: (await deployments.get("ETH")).address,
  };

  const proxyAdminOwner = await getContractAddressOrNullAddress(deployments, "NormalTimelock");

  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  for (const instanceName in baseAssets) {
    const baseAsset = baseAssets[instanceName];

    await deploy(instanceName, {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      contract: "TokenBuyback",
      args: [plpAddress, baseAsset, psrAddress],
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
      const buyback = await ethers.getContract(instanceName);
      const currentOwner = (await buyback.owner()).toLowerCase();
      const pendingOwner = (await buyback.pendingOwner()).toLowerCase();

      if (currentOwner !== timelockAddress.toLowerCase() && pendingOwner === ethers.constants.AddressZero) {
        const tx = await buyback.transferOwnership(timelockAddress);
        await tx.wait();
        console.log(`Ownership transfer of ${instanceName} initiated to NormalTimelock (${timelockAddress})`);
      } else {
        console.log(`Ownership transfer of ${instanceName} already pending to ${pendingOwner}`);
      }
    }
  }
};

func.tags = ["PrimeBuyback"];

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  return hre.network.name !== "bscmainnet" && hre.network.name !== "bsctestnet";
};

export default func;
