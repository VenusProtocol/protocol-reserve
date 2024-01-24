import { parseUnits } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESS_ONE, multisigs } from "../helpers/utils";

const MIN_AMOUNT_TO_CONVERT = parseUnits("10", 18);

const func: DeployFunction = async ({
  network: { live, name },
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const acmAddress = (await ethers.getContractOrNull("AccessControlManager"))?.address || ADDRESS_ONE;
  const oracleAddress = (await ethers.getContractOrNull("ResilientOracle"))?.address || ADDRESS_ONE;
  const usdtAddress = (await ethers.getContractOrNull("USDT"))?.address || ADDRESS_ONE;
  const corePoolAddress = (await ethers.getContractOrNull("Unitroller"))?.address || ADDRESS_ONE;
  const btcbAddress = (await ethers.getContractOrNull("BTCB"))?.address || ADDRESS_ONE;
  const ethAddress = (await ethers.getContractOrNull("ETH"))?.address || ADDRESS_ONE;
  const vBNBAddress = (await ethers.getContractOrNull("vBNB"))?.address || ADDRESS_ONE;
  const wBNBAddress = (await ethers.getContractOrNull("WBNB"))?.address || ADDRESS_ONE;
  const riskFundAddress = (await ethers.getContractOrNull("RiskFund"))?.address || ADDRESS_ONE;
  const poolRegistryAddress = (await ethers.getContractOrNull("PoolRegistry"))?.address || ADDRESS_ONE;
  const poolDeFiAddress = (await ethers.getContractOrNull("Comptroller_DeFi"))?.address || ADDRESS_ONE;
  const poolGameFiAddress = (await ethers.getContractOrNull("Comptroller_GameFi"))?.address || ADDRESS_ONE;
  const poolTronAddress = (await ethers.getContractOrNull("Comptroller_Tron"))?.address || ADDRESS_ONE;
  const timelockAddress = (await ethers.getContractOrNull("NormalTimelock"))?.address || multisigs[name];

  let poolStableCoinAddress;
  if (network.name === "bscmainnet") {
    poolStableCoinAddress = (await ethers.getContractOrNull("Comptroller_Stablecoins"))?.address || ADDRESS_ONE;
  } else {
    poolStableCoinAddress = (await ethers.getContractOrNull("Comptroller_StableCoins"))?.address || ADDRESS_ONE;
  }

  const comptrollers = [corePoolAddress, poolStableCoinAddress, poolDeFiAddress, poolGameFiAddress, poolTronAddress];
  const assets = [[usdtAddress, btcbAddress, ethAddress], [usdtAddress], [usdtAddress], [usdtAddress], [usdtAddress]];
  const values = [[true, true, true], [true], [true], [true], [true]];

  await deploy("RiskFundConverter", {
    from: deployer,
    contract: "RiskFundConverter",
    args: [corePoolAddress, vBNBAddress, wBNBAddress],
    proxy: {
      owner: live ? timelockAddress : deployer,
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

  if (live) {
    const tx = await converter.transferOwnership(timelockAddress);
    await tx.wait();
    console.log(`Transferred ownership of RiskFundConverter to Timelock`);
  }
};

func.tags = ["RiskFundConverter"];

export default func;
