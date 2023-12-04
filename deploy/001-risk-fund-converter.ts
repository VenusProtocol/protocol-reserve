import { network } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

type Addresses = {
  bsctestnet: {
    acm: string;
    oracle: string;
    riskFund: string;
    poolRegistry: string;
    corePool: string;
    poolStableCoin: string;
    poolDeFi: string;
    poolGameFi: string;
    poolTron: string;
    poolLiquidStakedBNB: string;
    USDT: string;
    vBNB: string;
    wBNB: string;
    proxyOwnerAddress: string;
  };
  bscmainnet: {
    acm: string;
    oracle: string;
    riskFund: string;
    poolRegistry: string;
    corePool: string;
    poolStableCoin: string;
    poolDeFi: string;
    poolGameFi: string;
    poolLiquidStakedBNB: string;
    poolTron: string;
    USDT: string;
    vBNB: string;
    wBNB: string;
    proxyOwnerAddress: string;
  };
};

let comptrollers: string[];
let assets: string[][];
let values: boolean[][];

const addresses: Addresses = {
  bsctestnet: {
    acm: "0x45f8a08F534f34A97187626E05d4b6648Eeaa9AA",
    oracle: "0x3cD69251D04A28d887Ac14cbe2E14c52F3D57823",
    riskFund: "0xBe4609d972FdEBAa9DC870F4A957F40C301bEb1D",
    poolRegistry: "0xC85491616Fa949E048F3aAc39fbf5b0703800667",
    corePool: "0x94d1820b2D1c7c7452A163983Dc888CEC546b77D",
    poolStableCoin: "0x10b57706AD2345e590c2eA4DC02faef0d9f5b08B",
    poolDeFi: "0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD",
    poolGameFi: "0x1F4f0989C51f12DAcacD4025018176711f3Bf289",
    poolLiquidStakedBNB: "0x596B11acAACF03217287939f88d63b51d3771704",
    poolTron: "0x11537D023f489E4EF0C7157cc729C7B69CbE0c97",
    USDT: "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c",
    vBNB: "0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c",
    wBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    proxyOwnerAddress: "0xce10739590001705F7FF231611ba4A48B2820327", //Normal timelock
  },
  bscmainnet: {
    acm: "0x4788629abc6cfca10f9f969efdeaa1cf70c23555",
    oracle: "0x6592b5DE802159F3E74B2486b091D11a8256ab8A",
    riskFund: "", // TODO
    poolRegistry: "0x9F7b01A536aFA00EF10310A162877fd792cD0666",
    corePool: "0xfD36E2c2a6789Db23113685031d7F16329158384",
    poolStableCoin: "0x94c1495cD4c557f1560Cbd68EAB0d197e6291571",
    poolDeFi: "0x3344417c9360b963ca93A4e8305361AEde340Ab9",
    poolGameFi: "0x1b43ea8622e76627B81665B1eCeBB4867566B963",
    poolLiquidStakedBNB: "0xd933909A4a2b7A4638903028f44D1d38ce27c352",
    poolTron: "0x23b4404E4E5eC5FF5a6FFb70B7d14E3FabF237B0",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    vBNB: "0xA07c5b74C9B40447a954e1466938b865b6BBea36",
    wBNB: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    proxyOwnerAddress: "0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396",
  },
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const {
    acm,
    oracle,
    riskFund,
    poolRegistry,
    corePool,
    poolStableCoin,
    poolDeFi,
    poolGameFi,
    poolLiquidStakedBNB,
    poolTron,
    USDT,
    vBNB,
    wBNB,
    proxyOwnerAddress,
  } = addresses[network.name as keyof Addresses];

  comptrollers = [corePool, poolStableCoin, poolDeFi, poolGameFi, poolLiquidStakedBNB, poolTron];
  assets = [[USDT], [USDT], [USDT], [USDT], [USDT], [USDT]];
  values = [[true], [true], [true], [true], [true], [true]];

  await deploy("RiskFundConverter", {
    from: deployer,
    contract: "RiskFundConverter",
    args: [corePool, vBNB, wBNB],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [acm, oracle, riskFund, poolRegistry, comptrollers, assets, values],
      },
      upgradeIndex: 0,
    },
    autoMine: true,
    log: true,
  });
};
func.tags = ["RiskFundConverter"];

export default func;
