import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { TOKEN_BUYBACK_DEFAULTS } from "../helpers/deploymentConfig";

// U token is not registered in `@venusprotocol/venus-protocol` external deployments.
// Hard-coded per-network so TokenBuyback's immutable BASE_ASSET can be set at deploy.
const U_ADDRESSES: Record<string, string> = {
  bsctestnet: "0x180Bc1a9843A65D4116e44886FD3558515a56A49",
  bscmainnet: "0xcE24439F2D9C6a2289F741120FE202248B666666",
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const acmAddress = (await deployments.get("AccessControlManager")).address;
  const plpAddress = (await deployments.get("PrimeLiquidityProvider")).address;
  const psrAddress = (await deployments.get("ProtocolShareReserve")).address;
  const oracleAddress = (await deployments.get("ResilientOracle")).address;
  const timelockAddress = (await ethers.getContract("NormalTimelock")).address;

  const baseAssets: Record<string, string> = {
    USDTPrimeBuyback: (await deployments.get("USDT")).address,
    UPrimeBuyback: U_ADDRESSES[hre.network.name],
  };

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
      args: [plpAddress, baseAsset, psrAddress, oracleAddress],
      proxy: {
        owner: timelockAddress,
        proxyContract: "OptimizedTransparentUpgradeableProxy",
        execute: {
          methodName: "initialize",
          args: [acmAddress, TOKEN_BUYBACK_DEFAULTS.dailyCapUsd, TOKEN_BUYBACK_DEFAULTS.slippageEventUsd],
        },
        viaAdminContract: {
          name: "DefaultProxyAdmin",
          artifact: defaultProxyAdmin,
        },
      },
    });

    // transfer ownership to timelock
    {
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
