import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

type CommonAddresses = {
  acm: string;
  xvs: string;
  xvsVault: string;
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
    xvs: "0xB9e0E753630434d7863528cc73CB7AC638a7c8ff",
    xvsVault: "0x9aB56bAD2D7631B2A857ccf36d998232A8b82280",
    proxyOwnerAddress: "0xce10739590001705F7FF231611ba4A48B2820327", //Normal timelock
  },
  bscmainnet: {
    acm: "0x4788629abc6cfca10f9f969efdeaa1cf70c23555",
    xvs: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63",
    xvsVault: "0x051100480289e704d20e9DB4804837068f3f9204",
    proxyOwnerAddress: "0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396", //Normal timelock
  },
  sepolia: {
    acm: "",
    xvs: "",
    xvsVault: "",
    proxyOwnerAddress: "",
  },
  ethereum: {
    acm: "",
    xvs: "",
    xvsVault: "",
    proxyOwnerAddress: "",
  },
};

module.exports = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const ContractAddresses = addresses[network.name];

  await deploy("XVSVaultTreasury", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [ContractAddresses.xvs],
    proxy: {
      owner: ContractAddresses.proxyOwnerAddress,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [ContractAddresses.acm, ContractAddresses.xvsVault],
      },
    },
  });

  const xvsVaultTreasury = await ethers.getContract("XVSVaultTreasury");
  const xvsVaultTreasuryOwner = await xvsVaultTreasury.owner();
  if (xvsVaultTreasuryOwner === deployer) {
    const tx = await xvsVaultTreasury.transferOwnership(ContractAddresses.proxyOwnerAddress);
    await tx.wait();
    console.log("Transferred ownership of XVSVaultTreasury to Timelock");
  }
};

module.exports.tags = ["XVSVaultTreasury"];
