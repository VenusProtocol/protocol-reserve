import { HardhatRuntimeEnvironment } from "hardhat/types";

const func = async ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy("RiskFundV2", {
    contract: "RiskFundV2",
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
};

func.tags = ["RiskFundV2"];

export default func;
