import "module-alias/register";

import "@matterlabs/hardhat-zksync";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-dependency-compiler";
import "hardhat-deploy";
import { HardhatUserConfig, extendConfig, extendEnvironment, task } from "hardhat/config";
import { HardhatConfig } from "hardhat/types";

require("dotenv").config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const externalDeployments = {
  zksyncsepolia: ["node_modules/@venusprotocol/governance-contracts/deployments/zksyncsepolia"],
};
extendConfig((config: HardhatConfig) => {
  if (process.env.EXPORT !== "true") {
    config.external = { ...config.external, deployments: externalDeployments };
  }
});

extendEnvironment(hre => {
  hre.getNetworkName = () => process.env.HARDHAT_FORK_NETWORK || hre.network.name;
});

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

function isFork() {
  return process.env.FORK === "true"
    ? {
        allowUnlimitedContractSize: false,
        loggingEnabled: false,
        forking: {
          url:
            process.env[`ARCHIVE_NODE_${process.env.FORKED_NETWORK}`] ||
            "https://data-seed-prebsc-1-s1.binance.org:8545",
          blockNumber: 21068448,
        },
        accounts: {
          accountsBalance: "1000000000000000000",
        },
        live: false,
        zksync: true,
      }
    : {
        allowUnlimitedContractSize: true,
        loggingEnabled: false,
        live: false,
        zksync: true,
      };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  zksolc: {
    version: "1.5.3",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.25",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
          evmVersion: "paris",
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
        },
      },
    ],
  },
  networks: {
    hardhat: isFork(),
    zksyncsepolia: {
      url: process.env.ARCHIVE_NODE_zksyncsepolia || "https://sepolia.era.zksync.dev",
      ethNetwork: "sepolia",
      verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
      zksync: true,
      live: true,
    },
    zksyncmainnet: {
      url: process.env.ARCHIVE_NODE_zksyncmainnet || "https://mainnet.era.zksync.io",
      ethNetwork: "mainnet",
      verifyURL: "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
      zksync: true,
      live: true,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./tests",
    cache: "./cache-zk",
    artifacts: "./artifacts-zk",
  },
  mocha: {
    timeout: 200000000,
  },

  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  // Hardhat deploy
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
    },
  },
  dependencyCompiler: {
    paths: [
      "hardhat-deploy/solc_0.8/proxy/OptimizedTransparentUpgradeableProxy.sol",
      "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol",
      "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
    ],
  },
};

export default config;
