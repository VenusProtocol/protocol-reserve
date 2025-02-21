import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESS_ONE } from "../helpers/utils";

const MIN_AMOUNT_TO_CONVERT = parseUnits("10", 18);

const getTokenOrMockName = (name: string, live: boolean) => {
  return `${live ? "" : "Mock"}${name}`;
};

const func: DeployFunction = async ({
  network: { live },
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const acmAddress = (await ethers.getContract("AccessControlManager"))?.address;
  const oracleAddress = (await ethers.getContract("ResilientOracle"))?.address;
  const usdtAddress = (await ethers.getContract("USDT"))?.address;
  const corePoolAddress = (await ethers.getContract("Unitroller"))?.address;
  const btcbAddress = (await ethers.getContract(getTokenOrMockName("BTCB", live)))?.address;

  const ethAddress = (await ethers.getContract("ETH"))?.address;
  const vBNBAddress = (await ethers.getContractOrNull("vBNB"))?.address || ADDRESS_ONE;
  const wBNBAddress = (await ethers.getContractOrNull("WBNB"))?.address || ADDRESS_ONE;
  const riskFundAddress = (await ethers.getContract("RiskFundV2"))?.address;
  const poolRegistryAddress = (await ethers.getContract("PoolRegistry"))?.address;
  let comptrollers;
  const timelockAddress = (await ethers.getContract("NormalTimelock")).address;
  if (live) {
    const poolDeFiAddress = (await ethers.getContract("Comptroller_DeFi"))?.address;
    const poolGameFiAddress = (await ethers.getContract("Comptroller_GameFi"))?.address;
    const poolTronAddress = (await ethers.getContract("Comptroller_Tron"))?.address;
    const poolStableCoinAddress = (await ethers.getContract("Comptroller_Stablecoins"))?.address;
    comptrollers = [corePoolAddress, poolStableCoinAddress, poolDeFiAddress, poolGameFiAddress, poolTronAddress];
  } else {
    const pool1Address = (await ethers.getContractOrNull("Comptroller_Pool1"))?.address || ADDRESS_ONE;
    const pool2Address = (await ethers.getContractOrNull("Comptroller_Pool2"))?.address || ADDRESS_ONE;
    comptrollers = [pool1Address, pool2Address];
  }

  const assets = [[usdtAddress, btcbAddress, ethAddress], [usdtAddress], [usdtAddress], [usdtAddress], [usdtAddress]];
  const values = [[true, true, true], [true], [true], [true], [true]];

  await deploy("RiskFundConverter", {
    from: deployer,
    contract: "RiskFundConverter",
    args: [corePoolAddress, vBNBAddress, wBNBAddress],
    proxy: live
      ? {
          owner: timelockAddress,
          proxyContract: "OpenZeppelinTransparentProxy",
          execute: {
            methodName: "initialize",
            args: [
              acmAddress,
              oracleAddress,
              riskFundAddress,
              poolRegistryAddress,
              MIN_AMOUNT_TO_CONVERT,
              comptrollers,
              assets,
              values,
            ],
          },
          upgradeIndex: 0,
        }
      : undefined,
    autoMine: true,
    log: true,
  });

  const converter = await ethers.getContract("RiskFundConverter");

  if (live) {
    const tx = await converter.transferOwnership(timelockAddress);
    await tx.wait();
    console.log(`Transferred ownership of RiskFundConverter to Timelock`);
  }
};

func.tags = ["RiskFundConverter"];

export default func;
