import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const MIN_AMOUNT_TO_CONVERT = parseUnits("10", 18);

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const acmAddress = (await ethers.getContract("AccessControlManager")).address;
  const oracleAddress = (await ethers.getContract("ResilientOracle")).address;
  const usdtAddress = (await ethers.getContract("USDT")).address;
  const corePoolAddress = (await ethers.getContract("Unitroller")).address;
  const btcbAddress = (await ethers.getContract("BTCB")).address;
  const ethAddress = (await ethers.getContract("ETH")).address;
  const vBNBAddress = (await ethers.getContract("vBNB")).address;
  const wBNBAddress = (await ethers.getContract("WBNB")).address;
  const riskFundAddress = (await ethers.getContract("RiskFund")).address;
  const poolRegistryAddress = (await ethers.getContract("PoolRegistry")).address;
  const poolStableCoinAddress = (await ethers.getContract("Comptroller_StableCoins")).address;
  const poolDeFiAddress = (await ethers.getContract("Comptroller_DeFi")).address;
  const poolGameFiAddress = (await ethers.getContract("Comptroller_GameFi")).address;
  const poolTronAddress = (await ethers.getContract("Comptroller_Tron")).address;
  const timelockAddress = (await ethers.getContract("NormalTimelock")).address;

  const comptrollers = [corePoolAddress, poolStableCoinAddress, poolDeFiAddress, poolGameFiAddress, poolTronAddress];
  const assets = [[usdtAddress, btcbAddress, ethAddress], [usdtAddress], [usdtAddress], [usdtAddress], [usdtAddress]];
  const values = [[true, true, true], [true], [true], [true], [true]];

  await deploy("RiskFundConverter", {
    from: deployer,
    contract: "RiskFundConverter",
    args: [corePoolAddress, vBNBAddress, wBNBAddress],
    proxy: {
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
    },
    autoMine: true,
    log: true,
  });

  const converter = await ethers.getContract("RiskFundConverter");
  const converterOwner = await converter.owner();
  if (converterOwner === deployer) {
    const tx = await converter.transferOwnership(timelockAddress);
    await tx.wait();
    console.log(`Transferred ownership of RiskFundConverter to Timelock`);
  }
};
func.tags = ["RiskFundConverter"];

export default func;
