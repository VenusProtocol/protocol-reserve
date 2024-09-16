import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESS_ONE } from "../helpers/utils";

const MIN_AMOUNT_TO_CONVERT = parseUnits("10", 18).toString();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const usdcAddress = (await ethers.getContractOrNull("USDC"))?.address || ADDRESS_ONE;

  const acmAddress = (await ethers.getContractOrNull("AccessControlManager"))?.address || ADDRESS_ONE;
  const oracleAddress = (await ethers.getContractOrNull("ResilientOracle"))?.address || ADDRESS_ONE;
  const singleTokenConverterBeacon = await ethers.getContract("SingleTokenConverterBeacon")!;

  const SingleTokenConverter = await ethers.getContractFactory("SingleTokenConverter");

  const destinationAddress = (await ethers.getContractOrNull("VTreasury"))?.address || ADDRESS_ONE;

  const args: string[] = [acmAddress, oracleAddress, destinationAddress, usdcAddress, MIN_AMOUNT_TO_CONVERT];

  await deploy("USDCTreasuryConverter", {
    from: deployer,
    contract: "BeaconProxy",
    args: [singleTokenConverterBeacon.address, SingleTokenConverter.interface.encodeFunctionData("initialize", args)],
    log: true,
    autoMine: true,
  });
};

func.tags = ["SingleTokenConverter"];
func.id = "usdc-treasury-converter"; // id required to prevent re-execution

export default func;
