import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployResult } from "hardhat-deploy/dist/types";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESS_ONE, ADDRESS_TWO, multisigs } from "../helpers/utils";

interface BaseAssets {
  [key: string]: string;
}

async function getBaseAssets(network: string): Promise<BaseAssets> {
  const networkBaseAssets: { [key: string]: BaseAssets } = {
    bsctestnet: {
      USDTPrimeConverter: (await ethers.getContractOrNull("USDT"))?.address || ADDRESS_ONE,
      USDCPrimeConverter: (await ethers.getContractOrNull("USDC"))?.address || ADDRESS_ONE,
      BTCBPrimeConverter: (await ethers.getContractOrNull("BTCB"))?.address || ADDRESS_ONE,
      ETHPrimeConverter: (await ethers.getContractOrNull("ETH"))?.address || ADDRESS_ONE,
      XVSVaultConverter: (await ethers.getContractOrNull("XVS"))?.address || ADDRESS_TWO,
    },
    bscmainnet: {
      USDTPrimeConverter: (await ethers.getContractOrNull("USDT"))?.address || ADDRESS_ONE,
      USDCPrimeConverter: (await ethers.getContractOrNull("USDC"))?.address || ADDRESS_ONE,
      BTCBPrimeConverter: (await ethers.getContractOrNull("BTCB"))?.address || ADDRESS_ONE,
      ETHPrimeConverter: (await ethers.getContractOrNull("ETH"))?.address || ADDRESS_ONE,
      XVSVaultConverter: (await ethers.getContractOrNull("XVS"))?.address || ADDRESS_TWO,
    },
    sepolia: {
      USDTPrimeConverter: (await ethers.getContractOrNull("MockUSDT"))?.address || ADDRESS_ONE,
      USDCPrimeConverter: (await ethers.getContractOrNull("MockUSDC"))?.address || ADDRESS_ONE,
      WBTCPrimeConverter: (await ethers.getContractOrNull("MockWBTC"))?.address || ADDRESS_ONE,
      WETHPrimeConverter: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", // WETH on Sepolia
      XVSVaultConverter: (await ethers.getContractOrNull("XVS"))?.address || ADDRESS_TWO,
    },
    ethereum: {
      USDTPrimeConverter: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT on Ethereum
      USDCPrimeConverter: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
      WBTCPrimeConverter: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC on Ethereum
      WETHPrimeConverter: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH on Ethereum
      XVSVaultConverter: (await ethers.getContractOrNull("XVS"))?.address || ADDRESS_TWO,
    },
    // add more networks
  };
  return networkBaseAssets[network];
}

const MIN_AMOUNT_TO_CONVERT = parseUnits("10", 18).toString();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName = network.name;
  const baseAssets: BaseAssets = await getBaseAssets(networkName);

  const acmAddress = (await ethers.getContractOrNull("AccessControlManager"))?.address || ADDRESS_ONE;
  const oracleAddress = (await ethers.getContractOrNull("ResilientOracle"))?.address || ADDRESS_ONE;
  const proxyOwnerAddress =
    (await ethers.getContractOrNull("NormalTimelock"))?.address || multisigs[networkName] || ADDRESS_ONE;

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

    let destinationAddress = (await ethers.getContractOrNull("PrimeLiquidityProvider"))?.address || ADDRESS_ONE;

    if (baseAsset == ((await ethers.getContractOrNull("XVS"))?.address || ADDRESS_TWO)) {
      destinationAddress = (await ethers.getContractOrNull("XVSVaultTreasury"))?.address || ADDRESS_ONE;
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
func.id = "xvs-and-prime-converters"; // id required to prevent re-execution

export default func;
