import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployResult } from "hardhat-deploy/dist/types";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

interface BaseAssets {
  USDTPrimeConverter: string;
  USDCPrimeConverter: string;
  BTCBPrimeConverter: string;
  ETHPrimeConverter: string;
  XVSVaultConverter: string;
}

const MIN_AMOUNT_TO_CONVERT = parseUnits("10", 18);

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const BaseAssets: BaseAssets = {
    USDTPrimeConverter: (await ethers.getContract("USDT")).address,
    USDCPrimeConverter: (await ethers.getContract("USDC")).address,
    BTCBPrimeConverter: (await ethers.getContract("BTCB")).address,
    ETHPrimeConverter: (await ethers.getContract("ETH")).address,
    XVSVaultConverter: (await ethers.getContract("XVS")).address,
  };

  const acmAddress = (await ethers.getContract("AccessControlManager")).address;
  const oracleAddress = (await ethers.getContract("ResilientOracle")).address;

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

  for (const asset in BaseAssets) {
    const baseAsset = BaseAssets[asset];

    let destinationAddress = (await ethers.getContract("PrimeLiquidityProvider")).address;
    if (baseAsset == (await ethers.getContract("XVS")).address) {
      destinationAddress = (await ethers.getContract("XVSVaultTreasury")).address;
    }
    const args: string[] = [acmAddress, oracleAddress, destinationAddress, baseAsset, MIN_AMOUNT_TO_CONVERT];

    await deploy(asset, {
      from: deployer,
      contract: "BeaconProxy",
      args: [SingleTokenConverterBeacon.address, SingleTokenConverter.interface.encodeFunctionData("initialize", args)],
      log: true,
      autoMine: true,
    });
  }
};
func.tags = ["SingleTokenConverter"];
export default func;
