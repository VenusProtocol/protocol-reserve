import "module-alias/register";

import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import dotenv from "dotenv";
import "hardhat-dependency-compiler";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import { HardhatUserConfig, extendConfig, task } from "hardhat/config";
import { HardhatConfig } from "hardhat/types";
import "solidity-coverage";
import "solidity-docgen";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// The order of dependencies should be kept in order such that it does not overwrite the deployments in the current repository such that:
// if we define the Oracle deployments at last then DefaultProxyAdmin of current repository will be overwritten by DefaultProxyAdmin of Oracle
// when the export deployment command executes independently for each network.
const externalDeployments = {
  hardhat: [
    "node_modules/@venusprotocol/isolated-pools/deployments/bscmainnet",
    "node_modules/@venusprotocol/venus-protocol/deployments/bscmainnet",
    "node_modules/@venusprotocol/governance-contracts/deployments/bscmainnet",
    "node_modules/@venusprotocol/oracle/deployments/bscmainnet",
  ],
  bsctestnet: [
    "node_modules/@venusprotocol/governance-contracts/deployments/bsctestnet",
    "node_modules/@venusprotocol/oracle/deployments/bsctestnet",
  ],
  sepolia: [
    "node_modules/@venusprotocol/isolated-pools/deployments/sepolia",
    "node_modules/@venusprotocol/token-bridge/deployments/sepolia",
    "node_modules/@venusprotocol/venus-protocol/deployments/sepolia",
    "node_modules/@venusprotocol/governance-contracts/deployments/sepolia",
    "node_modules/@venusprotocol/oracle/deployments/sepolia",
  ],
  opbnbtestnet: [
    "node_modules/@venusprotocol/governance-contracts/deployments/opbnbtestnet",
    "node_modules/@venusprotocol/oracle/deployments/opbnbtestnet",
  ],
  bscmainnet: [
    "node_modules/@venusprotocol/venus-protocol/deployments/bscmainnet",
    "node_modules/@venusprotocol/governance-contracts/deployments/bscmainnet",
    "node_modules/@venusprotocol/oracle/deployments/bscmainnet",
  ],
  ethereum: [
    "node_modules/@venusprotocol/isolated-pools/deployments/ethereum",
    "node_modules/@venusprotocol/token-bridge/deployments/ethereum",
    "node_modules/@venusprotocol/venus-protocol/deployments/ethereum",
    "node_modules/@venusprotocol/governance-contracts/deployments/ethereum",
    "node_modules/@venusprotocol/oracle/deployments/ethereum",
  ],
  opbnbmainnet: [
    "node_modules/@venusprotocol/governance-contracts/deployments/opbnbmainnet",
    "node_modules/@venusprotocol/oracle/deployments/opbnbmainnet",
  ],
  arbitrumsepolia: [
    "node_modules/@venusprotocol/governance-contracts/deployments/arbitrumsepolia",
    "node_modules/@venusprotocol/oracle/deployments/arbitrumsepolia",
  ],
  arbitrumone: [
    "node_modules/@venusprotocol/governance-contracts/deployments/arbitrumone",
    "node_modules/@venusprotocol/oracle/deployments/arbitrumone",
  ],
  opsepolia: [
    "node_modules/@venusprotocol/governance-contracts/deployments/opsepolia",
    "node_modules/@venusprotocol/oracle/deployments/opsepolia",
  ],
  opmainnet: [
    "node_modules/@venusprotocol/governance-contracts/deployments/opmainnet",
    "node_modules/@venusprotocol/oracle/deployments/opmainnet",
  ],
  basesepolia: [
    "node_modules/@venusprotocol/governance-contracts/deployments/basesepolia",
    "node_modules/@venusprotocol/oracle/deployments/basesepolia",
  ],
  basemainnet: [
    "node_modules/@venusprotocol/governance-contracts/deployments/basemainnet",
    "node_modules/@venusprotocol/oracle/deployments/basemainnet",
  ],
};

extendConfig((config: HardhatConfig) => {
  if (process.env.EXPORT !== "true") {
    config.external = { ...config.external, deployments: externalDeployments };
  }
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
      }
    : {
        allowUnlimitedContractSize: true,
        loggingEnabled: false,
        live: false,
      };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
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
    bsctestnet: {
      url: process.env.ARCHIVE_NODE_bsctestnet || "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      live: true,
      accounts: {
        mnemonic: process.env.MNEMONIC || "",
      },
      gasPrice: 10000000000, // 10 gwei
      gasMultiplier: 10,
      timeout: 12000000,
    },
    bscmainnet: {
      url: process.env.ARCHIVE_NODE_bscmainnet || "https://bsc-dataseed.binance.org/",
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
      live: true,
    },
    sepolia: {
      url: process.env.ARCHIVE_NODE_sepolia || "https://ethereum-sepolia.blockpi.network/v1/rpc/public",
      chainId: 11155111,
      live: true,
      gasPrice: 20000000000, // 20 gwei
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
    },
    ethereum: {
      url: process.env.ARCHIVE_NODE_ethereum || "https://ethereum.blockpi.network/v1/rpc/public",
      chainId: 1,
      live: true,
      timeout: 1200000, // 20 minutes
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
    },
    opbnbtestnet: {
      url: process.env.ARCHIVE_NODE_opbnbtestnet || "https://opbnb-testnet-rpc.bnbchain.org",
      chainId: 5611,
      live: true,
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
    },
    opbnbmainnet: {
      url: process.env.ARCHIVE_NODE_opbnbmainnet || "https://opbnb-mainnet-rpc.bnbchain.org",
      chainId: 204,
      live: true,
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
    },
    arbitrumsepolia: {
      url: process.env.ARCHIVE_NODE_arbitrumsepolia || "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      live: true,
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
    },
    arbitrumone: {
      url: process.env.ARCHIVE_NODE_arbitrumone || "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      live: true,
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
    },
    opsepolia: {
      url: process.env.ARCHIVE_NODE_opsepolia || "https://sepolia.optimism.io",
      chainId: 11155420,
      live: true,
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
    },
    opmainnet: {
      url: process.env.ARCHIVE_NODE_opmainnet || "https://mainnet.optimism.io",
      chainId: 10,
      live: true,
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
    },
    basesepolia: {
      url: process.env.ARCHIVE_NODE_basesepolia || "https://sepolia.base.org",
      chainId: 84532,
      live: true,
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
    },
    basemainnet: {
      url: process.env.ARCHIVE_NODE_basemainnet || "https://mainnet.base.org",
      chainId: 8453,
      live: true,
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
    },
  },
  etherscan: {
    apiKey: {
      bscmainnet: ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      bsctestnet: ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      sepolia: ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      ethereum: ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      opbnbtestnet: ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      opbnbmainnet: ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      arbitrumsepolia: ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      arbitrumone: ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      opsepolia: ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      opmainnet: ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      basesepolia: ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      basemainnet: ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
    },
    customChains: [
      {
        network: "bscmainnet",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://bscscan.com",
        },
      },
      {
        network: "bsctestnet",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com",
        },
      },
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api-sepolia.etherscan.io/api",
          browserURL: "https://sepolia.etherscan.io",
        },
      },
      {
        network: "ethereum",
        chainId: 1,
        urls: {
          apiURL: "https://api.etherscan.io/api",
          browserURL: "https://etherscan.io",
        },
      },
      {
        network: "opbnbtestnet",
        chainId: 5611,
        urls: {
          apiURL: `https://open-platform.nodereal.io/${ETHERSCAN_API_KEY}/op-bnb-testnet/contract/`,
          browserURL: "https://testnet.opbnbscan.com/",
        },
      },
      {
        network: "opbnbmainnet",
        chainId: 204,
        urls: {
          apiURL: `https://open-platform.nodereal.io/${ETHERSCAN_API_KEY}/op-bnb-mainnet/contract/`,
          browserURL: "https://opbnbscan.com/",
        },
      },
      {
        network: "arbitrumsepolia",
        chainId: 421614,
        urls: {
          apiURL: `https://api-sepolia.arbiscan.io/api`,
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
      {
        network: "arbitrumone",
        chainId: 42161,
        urls: {
          apiURL: `https://api.arbiscan.io/api/`,
          browserURL: "https://arbiscan.io/",
        },
      },
      {
        network: "opsepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api/",
          browserURL: "https://sepolia-optimistic.etherscan.io/",
        },
      },
      {
        network: "opmainnet",
        chainId: 10,
        urls: {
          apiURL: "https://api-optimistic.etherscan.io/api",
          browserURL: "https://optimistic.etherscan.io/",
        },
      },
      {
        network: "basesepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org/",
        },
      },
      {
        network: "basemainnet",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org/",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./tests",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  external: {
    deployments: {},
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
  docgen: {
    outputDir: "./docgen-docs",
    pages: "files",
    templates: "docgen-templates",
  },
  dependencyCompiler: {
    paths: [
      "hardhat-deploy/solc_0.8/proxy/OptimizedTransparentUpgradeableProxy.sol",
      "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol",
    ],
  },
};

export default config;
