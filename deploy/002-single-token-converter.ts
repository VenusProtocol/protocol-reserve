import { parseUnits } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { DeployResult } from "hardhat-deploy/dist/types";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

type CommonAddresses = {
  acm: string;
  oracle: string;
  primeLiquidityProvider: string;
  xvsVaultTreasury: string;
  baseAsset: string;
  proxyOwnerAddress: string; //Normal timelock
};
type Addresses = {
  bsctestnet: CommonAddresses;
  bscmainnet: CommonAddresses;
  sepolia: CommonAddresses;
  ethereum: CommonAddresses;
};

const BaseAssets = {
  bsctestnet: {
    USDTPrimeConverter: "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c", // USDT
    USDCPrimeConverter: "0x16227D60f7a0e586C66B005219dfc887D13C9531", // USDC
    BTCBPrimeConverter: "0xA808e341e8e723DC6BA0Bb5204Bafc2330d7B8e4", // BTCB
    ETHPrimeConverter: "0x98f7A83361F7Ac8765CcEBAB1425da6b341958a7", // ETH
    XVSVaultConverter: "0xB9e0E753630434d7863528cc73CB7AC638a7c8ff", // XVS
  },
  bscmainnet: {
    USDTPrimeConverter: "0x55d398326f99059fF775485246999027B3197955", // USDT
    USDCPrimeConverter: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
    BTCBPrimeConverter: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", // BTCB
    ETHPrimeConverter: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", // ETH
    XVSVaultConverter: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63", // XVS
  },
  sepolia: {
    USDTPrimeConverter: "", // USDT
    USDCPrimeConverter: "", // USDC
    BTCBPrimeConverter: "", // BTCB
    ETHPrimeConverter: "", // ETH
    XVSVaultConverter: "", // XVS
  },
  ethereum: {
    USDTPrimeConverter: "", // USDT
    USDCPrimeConverter: "", // USDC
    BTCBPrimeConverter: "", // BTCB
    ETHPrimeConverter: "", // ETH
    XVSVaultConverter: "", // XVS
  },
};

const addresses: Addresses = {
  bsctestnet: {
    acm: "0x45f8a08F534f34A97187626E05d4b6648Eeaa9AA",
    oracle: "0x3cD69251D04A28d887Ac14cbe2E14c52F3D57823",
    primeLiquidityProvider: "0xAdeddc73eAFCbed174e6C400165b111b0cb80B7E",
    xvsVaultTreasury: "",
    baseAsset: BaseAssets.bsctestnet.USDTPrimeConverter,
    proxyOwnerAddress: "0xce10739590001705F7FF231611ba4A48B2820327", //Normal timelock
  },
  bscmainnet: {
    acm: "0x4788629abc6cfca10f9f969efdeaa1cf70c23555",
    oracle: "0x6592b5DE802159F3E74B2486b091D11a8256ab8A",
    primeLiquidityProvider: "0x23c4F844ffDdC6161174eB32c770D4D8C07833F2",
    xvsVaultTreasury: "",
    baseAsset: BaseAssets.bscmainnet.USDTPrimeConverter,
    proxyOwnerAddress: "0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396",
  },
  sepolia: {
    acm: "",
    oracle: "",
    primeLiquidityProvider: "",
    xvsVaultTreasury: "",
    baseAsset: "",
    proxyOwnerAddress: "",
  },
  ethereum: {
    acm: "",
    oracle: "",
    primeLiquidityProvider: "",
    xvsVaultTreasury: "",
    baseAsset: "",
    proxyOwnerAddress: "",
  },
};

const CONTRACT_NAME: string = "";
const MIN_AMOUNT_TO_CONVERT = parseUnits("10", 18);

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const ContractAddresses = addresses[network.name];
  let destinationAddress = ContractAddresses.primeLiquidityProvider;

  if (CONTRACT_NAME === "XVSVaultConverter") {
    destinationAddress = ContractAddresses.xvsVaultTreasury;
  }

  // SingleTokenConverter Beacon
  const singleTokenConverterImp: DeployResult = await deploy("SingleTokenConverterImp", {
    contract: "SingleTokenConverter",
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const SingleTokenConverterBeacon: DeployResult = await deploy("SingleTokenConverterBeacon", {
    contract: "UpgradeableBeacon",
    from: deployer,
    args: [singleTokenConverterImp.address],
    log: true,
    autoMine: true,
  });

  const SingleTokenConverter = await ethers.getContractFactory("SingleTokenConverter");

  const args: string[] = [
    ContractAddresses.acm,
    ContractAddresses.oracle,
    destinationAddress,
    ContractAddresses.baseAsset,
    MIN_AMOUNT_TO_CONVERT,
  ];
  await deploy(CONTRACT_NAME, {
    from: deployer,
    contract: "BeaconProxy",
    args: [SingleTokenConverterBeacon.address, SingleTokenConverter.interface.encodeFunctionData("initialize", args)],
    log: true,
    autoMine: true,
  });
};

func.tags = ["SingleTokenConverter"];

export default func;
