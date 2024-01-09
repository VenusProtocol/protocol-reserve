import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployResult } from "hardhat-deploy/dist/types";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESS_ONE, ADDRESS_TWO } from "../helpers/utils";

interface BaseAssets {
  [key: string]: string;
}

const MIN_AMOUNT_TO_CONVERT = parseUnits("10", 18).toString();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const baseAssets: BaseAssets = {
    USDTPrimeConverter: (await ethers.getContractOrNull("USDT"))?.address || ADDRESS_ONE,
    USDCPrimeConverter: (await ethers.getContractOrNull("USDC"))?.address || ADDRESS_ONE,
    BTCBPrimeConverter: (await ethers.getContractOrNull("BTCB"))?.address || ADDRESS_ONE,
    ETHPrimeConverter: (await ethers.getContractOrNull("ETH"))?.address || ADDRESS_ONE,
    XVSVaultConverter: (await ethers.getContractOrNull("XVS"))?.address || ADDRESS_TWO,
  };

  const acmAddress = (await ethers.getContractOrNull("AccessControlManager"))?.address || ADDRESS_ONE;
  const oracleAddress = (await ethers.getContractOrNull("ResilientOracle"))?.address || ADDRESS_ONE;

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

    await deploy(singleTokenConverterName, {
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
