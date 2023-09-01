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
    vBNB: string;
    wBNB: string;
    proxyOwnerAddress: string;
  };
};

const addresses: Addresses = {
  bsctestnet: {
    acm: "0x45f8a08F534f34A97187626E05d4b6648Eeaa9AA",
    oracle: "0x3cD69251D04A28d887Ac14cbe2E14c52F3D57823",
    riskFund: "0xBe4609d972FdEBAa9DC870F4A957F40C301bEb1D",
    poolRegistry: "0xC85491616Fa949E048F3aAc39fbf5b0703800667",
    corePool: "0x94d1820b2D1c7c7452A163983Dc888CEC546b77D",
    vBNB: "0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c",
    wBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    proxyOwnerAddress: "0xce10739590001705F7FF231611ba4A48B2820327", //Normal timelock
  },
  bscmainnet: {
    acm: "",
    oracle: "",
    riskFund: "",
    poolRegistry: "",
    corePool: "",
    vBNB: "",
    wBNB: "",
    proxyOwnerAddress: "",
  },
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const { acm, oracle, riskFund, poolRegistry, corePool, vBNB, wBNB, proxyOwnerAddress } = addresses[network.name];

  await deploy("RiskFundConverter", {
    from: deployer,
    contract: "RiskFundConverter",
    args: [corePool, vBNB, wBNB],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [acm, oracle, riskFund, poolRegistry],
      },
      upgradeIndex: 0,
    },
    autoMine: true,
    log: true,
  });
};
func.tags = ["RiskFundConverter"];

export default func;
