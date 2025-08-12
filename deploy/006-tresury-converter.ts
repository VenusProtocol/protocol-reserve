import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployResult } from "hardhat-deploy/dist/types";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

type NETWORK = "hardhat" | "bsctestnet" | "bscmainnet" | "ethereum" | "arbitrumone";
interface BaseAssets {
  [key: string]: string;
}
async function getBaseAssets(network: NETWORK): Promise<BaseAssets> {
  const networkBaseAssets = {
    hardhat: async () => ({
      USDTTreasuryConverter: (await ethers.getContract("USDT"))?.address,
    }),
    bsctestnet: async () => ({
      USDTTreasuryConverter: (await ethers.getContract("USDT"))?.address,
    }),
    bscmainnet: async () => ({
      USDTTreasuryConverter: (await ethers.getContract("USDT"))?.address,
    }),
    ethereum: async () => ({
      USDTTreasuryConverter: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT on Ethereum
    }),
    arbitrumone: async () => ({
      USDTTreasuryConverter: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT on arbitrum one
    }),
  };
  return await networkBaseAssets[network]();
}

async function getTreasuryAddress(network: NETWORK): Promise<string> {
  const networkBaseAssets = {
    hardhat: async () => (await ethers.getContract("USDT"))?.address,

    bsctestnet: async () => "0x8b293600c50d6fbdc6ed4251cc75ece29880276f",
    bscmainnet: async () => "0xf322942f644a996a617bd29c16bd7d231d9f35e9",
    ethereum: async () => "0xFD9B071168bC27DBE16406eC3Aba050Ce8Eb22FA",
    arbitrumone: async () => "0x8a662ceAC418daeF956Bc0e6B2dd417c80CDA631",
  };
  return await networkBaseAssets[network]();
}

const MIN_AMOUNT_TO_CONVERT = parseUnits("10", 18).toString();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName = network.name as NETWORK;

  const baseAssets: BaseAssets = await getBaseAssets(networkName);

  const acmAddress = (await ethers.getContract("AccessControlManager"))?.address;
  const oracleAddress = (await ethers.getContract("ResilientOracle"))?.address;
  const proxyOwnerAddress = (await ethers.getContract("NormalTimelock")).address;

  const singleTokenConverterImp: DeployResult = await deploy("SingleTokenConverterImp", {
    contract: "SingleTokenConverter",
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: true,
  });

  const SingleTokenConverterBeacon: DeployResult = await deploy("SingleTokenConverterBeacon", {
    contract: "UpgradeableBeacon",
    from: deployer,
    args: [singleTokenConverterImp.address],
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: true,
  });

  const SingleTokenConverter = await ethers.getContractFactory("SingleTokenConverter");

  for (const singleTokenConverterName in baseAssets) {
    const baseAsset: string = baseAssets[singleTokenConverterName];

    const destinationAddress = await getTreasuryAddress(networkName);

    const args: string[] = [acmAddress, oracleAddress, destinationAddress, baseAsset, MIN_AMOUNT_TO_CONVERT];

    const converterProxy: DeployResult = await deploy(singleTokenConverterName, {
      from: deployer,
      contract: "BeaconProxy",
      args: [SingleTokenConverterBeacon.address, SingleTokenConverter.interface.encodeFunctionData("initialize", args)],
      log: true,
      autoMine: true,
    });

    if (network.live) {
      const converter = await ethers.getContractAt("SingleTokenConverter", converterProxy.address);

      const tx = await converter.transferOwnership(proxyOwnerAddress);
      await tx.wait();
      console.log(`Transferred ownership of ${singleTokenConverterName} to Timelock: ` + proxyOwnerAddress);
    }
  }
};

func.tags = ["TreasuryConverter", "Converters"];

export default func;
