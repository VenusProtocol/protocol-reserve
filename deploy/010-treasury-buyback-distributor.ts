import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { verifyDeployment } from "../helpers/verify";

// The distributor's six destinations are the Treasury TokenBuyback proxies deployed by
// `009-treasury-buyback.ts`. They are read from the deployment artifacts so the immutable
// wiring always matches the current buyback addresses on each network.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const btcbBuyback = (await deployments.get("BTCBTreasuryBuyback")).address;
  const ethBuyback = (await deployments.get("ETHTreasuryBuyback")).address;
  const xvsBuyback = (await deployments.get("XVSTreasuryBuyback")).address;
  const usdtBuyback = (await deployments.get("USDTTreasuryBuyback")).address;
  const usdcBuyback = (await deployments.get("USDCTreasuryBuyback")).address;
  const uBuyback = (await deployments.get("UTreasuryBuyback")).address;

  await deploy("TreasuryTokenBuybackDistributor", {
    from: deployer,
    contract: "TreasuryTokenBuybackDistributor",
    args: [btcbBuyback, ethBuyback, xvsBuyback, usdtBuyback, usdcBuyback, uBuyback],
    log: true,
    autoMine: true,
    deterministicDeployment: false,
  });

  await verifyDeployment(hre, "TreasuryTokenBuybackDistributor");
};

func.tags = ["TreasuryTokenBuybackDistributor"];
func.dependencies = ["TreasuryBuyback"];

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  return hre.network.name !== "bscmainnet" && hre.network.name !== "bsctestnet";
};

export default func;
