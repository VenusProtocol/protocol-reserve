import mainnetDeployments from "@venusprotocol/venus-protocol/networks/mainnet.json";
import testnetDeployments from "@venusprotocol/venus-protocol/networks/testnet.json";
import hre, { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

interface Contracts {
  vBNBAddress: string;
  comptroller: string;
  WBNBAddress: string;
  timelock: string;
  acm: string;
}

enum NetworkName {
  bsctestnet = "bsctestnet",
  bscmainnet = "bscmainnet",
  sepolia = "sepolia",
}

type Addresses = {
  [key in NetworkName]: Contracts; // Note the "in" operator.
};

const ADDRESSES: Addresses = {
  bsctestnet: {
    vBNBAddress: testnetDeployments.Contracts.vBNB,
    comptroller: testnetDeployments.Contracts.Unitroller,
    WBNBAddress: testnetDeployments.Contracts.WBNB,
    timelock: testnetDeployments.Contracts.Timelock,
    acm: "0x45f8a08F534f34A97187626E05d4b6648Eeaa9AA",
  },
  bscmainnet: {
    vBNBAddress: mainnetDeployments.Contracts.vBNB,
    comptroller: mainnetDeployments.Contracts.Unitroller,
    WBNBAddress: testnetDeployments.Contracts.WBNB,
    timelock: mainnetDeployments.Contracts.Timelock,
    acm: "0x4788629ABc6cFCA10F9f969efdEAa1cF70c23555",
  },
  sepolia: {
    vBNBAddress: ethers.constants.AddressZero,
    comptroller: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    timelock: ethers.constants.AddressZero,
    acm: ethers.constants.AddressZero,
  },
};

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName = network.name as NetworkName;

  const { vBNBAddress, comptroller, WBNBAddress, timelock, acm } = ADDRESSES[networkName];
  const loopsLimit = 20;

  await deploy("ProtocolShareReserve", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [comptroller, WBNBAddress, vBNBAddress],
    proxy: {
      owner: timelock,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [acm, loopsLimit],
      },
    },
  });

  const psr = await hre.ethers.getContract("ProtocolShareReserve");
  const psrOwner = await psr.owner();

  if (psrOwner === deployer) {
    const tx = await psr.transferOwnership(ADDRESSES[networkName].timelock);
    await tx.wait();
    console.log("Transferred ownership of PSR to Timelock");
  }
};

export default func;
func.tags = ["deploy"];
