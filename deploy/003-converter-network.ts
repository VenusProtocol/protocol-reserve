import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

type CommonAddresses = {
  acm: string;
  proxyOwnerAddress: string; //Normal timelock
};

type Addresses = {
  bsctestnet: CommonAddresses;
  bscmainnet: CommonAddresses;
  sepolia: CommonAddresses;
  ethereum: CommonAddresses;
};

const addresses: Addresses = {
  bsctestnet: {
    acm: "0x45f8a08F534f34A97187626E05d4b6648Eeaa9AA",
    proxyOwnerAddress: "0xce10739590001705F7FF231611ba4A48B2820327", //Normal timelock
  },
  bscmainnet: {
    acm: "0x4788629abc6cfca10f9f969efdeaa1cf70c23555",
    proxyOwnerAddress: "0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396", //Normal timelock
  },
  sepolia: {
    acm: "",
    proxyOwnerAddress: "",
  },
  ethereum: {
    acm: "",
    proxyOwnerAddress: "",
  },
};

const MAX_LOOPS_LIMIT = 100;

module.exports = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const ContractAddresses = addresses[network.name];

  await deploy("ConverterNetwork", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      owner: ContractAddresses.proxyOwnerAddress,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [ContractAddresses.acm, MAX_LOOPS_LIMIT],
      },
    },
  });

  const converterNetwork = await ethers.getContract("ConverterNetwork");
  const converterNetworkOwner = await converterNetwork.owner();
  if (converterNetworkOwner === deployer) {
    const tx = await converterNetwork.transferOwnership(ContractAddresses.proxyOwnerAddress);
    await tx.wait();
    console.log("Transferred ownership of ConverterNetwork to Timelock");
  }
};

module.exports.tags = ["ConverterNetwork"];
