import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { verifyDeployment } from "../helpers/verify";

// VAI, its Peg Stability Module (PegStability_USDT), the PSM stable token (USDT), and the treasury
// (VTreasury) per network. VAI is redeemed for USDT at the PSM by `convertVaiViaPsm` and the USDT is
// sent straight back to the treasury (USDT is already a base asset and needs no buyback conversion).
// The VAI/PSM/USDT values are verified against the live PSM getters (`VAI()`, `STABLE_TOKEN_ADDRESS()`).
// The treasury is VTreasury — the treasury being cleaned up by the VIP; on bscmainnet it also happens
// to equal the PSM's `venusTreasury()` (the PSM fee destination), so both the redeemed USDT and the
// PSM fee land in VTreasury there.
const VAI_PSM_CONFIG: { [network: string]: { vai: string; psm: string; stable: string; treasury: string } } = {
  bscmainnet: {
    vai: "0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7",
    psm: "0xC138aa4E424D1A8539e8F38Af5a754a2B7c3Cc36",
    stable: "0x55d398326f99059fF775485246999027B3197955",
    treasury: "0xF322942f644A996A617BD29c16bd7d231d9F35E9",
  },
  bsctestnet: {
    vai: "0x5fFbE5302BadED40941A403228E6AD03f93752d9",
    psm: "0xB21E69eef4Bc1D64903fa28D9b32491B1c0786F1",
    stable: "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c",
    treasury: "0x8b293600C50D6fbdc6Ed4251cc75ECe29880276f",
  },
};

// The distributor's six destinations are the Treasury TokenBuyback proxies deployed by
// `009-treasury-buyback.ts`. They are read from the already-committed deployment artifacts so the
// immutable wiring always matches the live buyback addresses on each network. We deliberately do
// NOT declare a `func.dependencies = ["TreasuryBuyback"]`: the buybacks are already deployed on
// both bsctestnet and bscmainnet (their artifacts are committed), so declaring the dependency only
// forces a redundant re-run of the buyback deploy — which can spuriously redeploy a buyback
// implementation and shadow this script during a single-tag deploy of the distributor.
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

  const psmConfig = VAI_PSM_CONFIG[hre.network.name];
  if (!psmConfig) {
    throw new Error(`No VAI/PSM config for network ${hre.network.name}`);
  }

  await deploy("TreasuryTokenBuybackDistributor", {
    from: deployer,
    contract: "TreasuryTokenBuybackDistributor",
    args: [
      btcbBuyback,
      ethBuyback,
      xvsBuyback,
      usdtBuyback,
      usdcBuyback,
      uBuyback,
      psmConfig.vai,
      psmConfig.psm,
      psmConfig.stable,
      psmConfig.treasury,
    ],
    log: true,
    autoMine: true,
    deterministicDeployment: false,
  });

  await verifyDeployment(hre, "TreasuryTokenBuybackDistributor");
};

func.tags = ["TreasuryTokenBuybackDistributor"];

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  return hre.network.name !== "bscmainnet" && hre.network.name !== "bsctestnet";
};

export default func;
