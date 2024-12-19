import timelocksDeployment from "@venusprotocol/governance-contracts/dist/deploy/001-source-timelocks";
import accessControlManagerDeployment from "@venusprotocol/governance-contracts/dist/deploy/002-access-control";
import mockTokensILDeployment from "@venusprotocol/isolated-pools/dist/deploy/001-deploy-mock-tokens";
import poolRegistryDeployment from "@venusprotocol/isolated-pools/dist/deploy/006-deploy-pool-registry";
import resilientOracleDeployment from "@venusprotocol/oracle/dist/deploy/1-deploy-oracles";
import comptrollerDeployment from "@venusprotocol/venus-protocol/dist/deploy/001-comptroller";
import interestRateModelDeployment from "@venusprotocol/venus-protocol/dist/deploy/002-interest-rate-model";
import mockTokensDeployment from "@venusprotocol/venus-protocol/dist/deploy/003-deploy-VBep20";
import xvsDeployment from "@venusprotocol/venus-protocol/dist/deploy/007-deploy-xvs";
import vaultsDeployment from "@venusprotocol/venus-protocol/dist/deploy/008-deploy-vaults";
import primeConverterDeployment from "@venusprotocol/venus-protocol/dist/deploy/012-deploy-prime";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  await timelocksDeployment(hre);
  await accessControlManagerDeployment(hre);
  await comptrollerDeployment(hre);
  await resilientOracleDeployment(hre);
  await interestRateModelDeployment(hre);
  await mockTokensDeployment(hre);
  await mockTokensILDeployment(hre);
  await poolRegistryDeployment(hre);
  await xvsDeployment(hre);
  await vaultsDeployment(hre);
  await primeConverterDeployment(hre);
};

func.tags = ["Setup"];

func.skip = async hre => hre.network.name !== "hardhat";

export default func;
