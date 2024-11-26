import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployResult } from "hardhat-deploy/dist/types";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { multisigs } from "../helpers/utils";

type NETWORK = "hardhat" | "bsctestnet" | "bscmainnet" | "sepolia" | "ethereum";

interface BaseAssets {
  [key: string]: string;
}

async function getBaseAssets(network: NETWORK): Promise<BaseAssets> {
  const networkBaseAssets = {
    hardhat: async () => ({
      USDTPrimeConverter: (await ethers.getContract("USDT"))?.address,
      USDCPrimeConverter: (await ethers.getContract("USDC"))?.address,
      BTCBPrimeConverter: (await ethers.getContract("BTCB"))?.address,
      ETHPrimeConverter: (await ethers.getContract("ETH"))?.address,
      XVSVaultConverter: (await ethers.getContract("XVS"))?.address,
    }),
    bsctestnet: async () => ({
      USDTPrimeConverter: (await ethers.getContract("USDT"))?.address,
      USDCPrimeConverter: (await ethers.getContract("USDC"))?.address,
      BTCBPrimeConverter: (await ethers.getContract("BTCB"))?.address,
      ETHPrimeConverter: (await ethers.getContract("ETH"))?.address,
      XVSVaultConverter: (await ethers.getContract("XVS"))?.address,
    }),
    bscmainnet: async () => ({
      USDTPrimeConverter: (await ethers.getContract("USDT"))?.address,
      USDCPrimeConverter: (await ethers.getContract("USDC"))?.address,
      BTCBPrimeConverter: (await ethers.getContract("BTCB"))?.address,
      ETHPrimeConverter: (await ethers.getContract("ETH"))?.address,
      XVSVaultConverter: (await ethers.getContract("XVS"))?.address,
    }),
    sepolia: async () => ({
      USDTPrimeConverter: (await ethers.getContract("MockUSDT"))?.address,
      USDCPrimeConverter: (await ethers.getContract("MockUSDC"))?.address,
      WBTCPrimeConverter: (await ethers.getContract("MockWBTC"))?.address,
      WETHPrimeConverter: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", // WETH on Sepolia
      XVSVaultConverter: (await ethers.getContract("XVS"))?.address,
    }),
    ethereum: async () => ({
      USDTPrimeConverter: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT on Ethereum
      USDCPrimeConverter: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
      WBTCPrimeConverter: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC on Ethereum
      WETHPrimeConverter: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH on Ethereum
      XVSVaultConverter: (await ethers.getContract("XVS"))?.address,
    }),
    arbitrumsepolia: async () => ({
      USDTPrimeConverter: "0xf3118a17863996B9F2A073c9A66Faaa664355cf8", // USDT on arbitrum sepolia
      USDCPrimeConverter: "0x86f096B1D970990091319835faF3Ee011708eAe8", // USDC on arbitrum sepolia
      WBTCPrimeConverter: "0xFb8d93FD3Cf18386a5564bb5619cD1FdB130dF7D", // WBTC on arbitrum sepolia
      WETHPrimeConverter: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH on arbitrum sepolia
      XVSVaultConverter: "0x877Dc896e7b13096D3827872e396927BbE704407", // XVS on arbitrum sepolia
    }),
    arbitrumone: async () => ({
      USDTPrimeConverter: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT on arbitrum one
      USDCPrimeConverter: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // USDC on arbitrum one
      WBTCPrimeConverter: "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f", // WBTC on arbitrum one
      WETHPrimeConverter: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH on arbitrum one
      XVSVaultConverter: "0xc1Eb7689147C81aC840d4FF0D298489fc7986d52", // XVS on arbitrum one
    }),
    // add more networks
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
  const proxyOwnerAddress = (await ethers.getContract("NormalTimelock"))?.address || multisigs[networkName];

  const singleTokenConverterImp: DeployResult = await deploy("SingleTokenConverterImp", {
    contract: "SingleTokenConverter",
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const SingleTokenConverterBeacon: DeployResult = await deploy("SingleTokenConverterBeacon", {
    contract: "UpgradeableBeacon",
    from: deployer,
    args: [singleTokenConverterImp.address],
    log: true,
    autoMine: true,
  });

  const SingleTokenConverter = await ethers.getContractFactory("SingleTokenConverter");

  for (const singleTokenConverterName in baseAssets) {
    const baseAsset: string = baseAssets[singleTokenConverterName];

    let destinationAddress = (await ethers.getContract("PrimeLiquidityProvider"))?.address;

    if (baseAsset == (await ethers.getContract("XVS"))?.address) {
      destinationAddress = (await ethers.getContract("XVSVaultTreasury"))?.address;
    }

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

func.tags = ["SingleTokenConverter", "Converters"];

export default func;
