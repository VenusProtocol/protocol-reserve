import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getContractAddressOrNullAddress } from "../helpers/deploymentConfig";

// Deploying with USDT as a placeholder. Because BASE_ASSET is a constructor immutable,
// changing it requires redeploying a new proxy instance. Confirm with tokenomics
// before mainnet deploy.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const acmAddress = (await deployments.get("AccessControlManager")).address;
  const vTreasuryAddress = (await deployments.get("VTreasury")).address;
  const baseAssetAddress = (await deployments.get("USDT")).address;
  const psrAddress = (await deployments.get("ProtocolShareReserve")).address;

  const proxyAdminOwner = await getContractAddressOrNullAddress(deployments, "NormalTimelock");

  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  await deploy("TreasuryBuyback", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    contract: "TokenBuyback",
    args: [vTreasuryAddress, baseAssetAddress, psrAddress],
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
    const treasuryBuyback = await ethers.getContract("TreasuryBuyback");
    const currentOwner = (await treasuryBuyback.owner()).toLowerCase();
    const pendingOwner = (await treasuryBuyback.pendingOwner()).toLowerCase();

    if (currentOwner !== timelockAddress.toLowerCase() && pendingOwner === ethers.constants.AddressZero) {
      const tx = await treasuryBuyback.transferOwnership(timelockAddress);
      await tx.wait();
      console.log(`Ownership transfer initiated to NormalTimelock (${timelockAddress})`);
    } else {
      console.log(`Ownership transfer already pending to ${pendingOwner}`);
    }
  }
};

func.tags = ["TreasuryBuyback"];

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  return hre.network.name !== "bscmainnet" && hre.network.name !== "bsctestnet";
};

export default func;
