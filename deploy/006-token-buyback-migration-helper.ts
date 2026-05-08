import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("TokenBuybackMigrationHelper", {
    from: deployer,
    contract: "TokenBuybackMigrationHelper",
    args: [],
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: true,
    waitConfirmations: network.live ? 5 : 1,
  });
};

func.tags = ["TokenBuybackMigrationHelper"];

// Helper hardcodes BSC mainnet addresses; restrict deployment to that network
// (and hardhat for local fork testing).
func.skip = async hre => !["bscmainnet", "hardhat"].includes(hre.network.name);

export default func;
