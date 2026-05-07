import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { TOKEN_BUYBACK_DEFAULTS, getContractAddressOrNullAddress } from "../helpers/deploymentConfig";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const acmAddress = (await deployments.get("AccessControlManager")).address;
  const xvsVaultTreasuryAddress = (await deployments.get("XVSVaultTreasury")).address;
  const xvsAddress = (await deployments.get("XVS")).address;
  const psrAddress = (await deployments.get("ProtocolShareReserve")).address;
  const oracleAddress = (await deployments.get("ResilientOracle")).address;

  const proxyAdminOwner = await getContractAddressOrNullAddress(deployments, "NormalTimelock");

  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  await deploy("XVSBuyback", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    contract: "TokenBuyback",
    args: [xvsVaultTreasuryAddress, xvsAddress, psrAddress, oracleAddress],
    proxy: {
      owner: proxyAdminOwner,
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
    const timelockAddress = await getContractAddressOrNullAddress(deployments, "NormalTimelock");
    const xvsBuyback = await ethers.getContract("XVSBuyback");
    const currentOwner = (await xvsBuyback.owner()).toLowerCase();
    const pendingOwner = (await xvsBuyback.pendingOwner()).toLowerCase();

    if (currentOwner !== timelockAddress.toLowerCase() && pendingOwner === ethers.constants.AddressZero) {
      const tx = await xvsBuyback.transferOwnership(timelockAddress);
      await tx.wait();
      console.log(`Ownership transfer initiated to NormalTimelock (${timelockAddress})`);
    } else {
      console.log(`Ownership transfer already pending to ${pendingOwner}`);
    }
  }
};

func.tags = ["XVSBuyback"];

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  return hre.network.name !== "bscmainnet" && hre.network.name !== "bsctestnet";
};

export default func;
