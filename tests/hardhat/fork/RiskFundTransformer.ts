import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import hre,{ ethers, network, helpers } from "hardhat";
const { expect } = chai;

const initMainnetUser = async (user: string) => {
  await impersonateAccount(user);
  return ethers.getSigner(user);
};
export async function setForkBlock(blockNumber: number) {
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.BSC_ARCHIVE_NODE,
          blockNumber: blockNumber,
        },
      },
    ],
  });
}

const forking = (blockNumber: number, fn: () => void) => {
  describe(`RiskFundTransformer #${blockNumber}`, () => {
    before(async () => {
      await setForkBlock(blockNumber);
    });
    fn();
  });
};

const Owner = "0x02EB950C215D12d723b44a18CfF098C6E166C531";
const BNB = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
const BNBx = "0x327d6e6fac0228070884e913263cff9efed4a2c8";
const USDT = "0xa11c8d9dc9b66e209ef60f0c8d969d3cd988782c ";
const HAY = "0xe73774dfcd551bf75650772dc2cc56a2b6323453";
const USDD = "0x2e2466e22fcbe0732be385ee2fbb9c59a1098382";
const BSW = "0x7fcc76fc1f573d8eb445c236cc282246bc562bce";
const ALPACA = "0x6923189d91fdf62dbae623a55273f1d20306d9f2";
const ANKR = "0xe4a90eb942cf2da7238e8f6cc9ef510c49fc8b4b";
const RACA = "0xd60cc803d888a3e743f21d0bde4bf2cafdea1f26";
const PoolRegistryAddress = "0xC85491616Fa949E048F3aAc39fbf5b0703800667";
const XVSAddress = "0xB9e0E753630434d7863528cc73CB7AC638a7c8ff";
const PriceOracleAddress = "0x3cD69251D04A28d887Ac14cbe2E14c52F3D57823";
const RiskFundProxyAddress = "0x27481F538C36eb366FAB4752a8dd5a03ed04a3cF";
const ProtocolShareReserveProxyAddress = "0x4eDB103c9Fe0863C62559Ccc3301dd3003A7dec2";
const RiskFundTransformerProxyAddress = "0x8CC7ecFa3AF1D78dD2ceE2239E2b58aA206f8952";
const ACMAddress = "0x45f8a08F534f34A97187626E05d4b6648Eeaa9AA";
let owner;

async function impersonateAccount(accountAddress) {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [accountAddress],
  });
}

forking(31922059, () => {
  let RiskFundTransformer : ethers.Contract;
  let AccessController : ethers.Contract;
  let poolRegistry : ether.Contract;
  let ProtocolShareReserve : ethers.Contract;
  let PriceOracle : ethers.Contract;
  if (process.env.FORK_TESTNET === "true") {
    before(async () => {
      /*
       *  Forking mainnet
       * */
      /**
       *  sending gas cost to owner
       * */
    //   await impersonateAccount(Owner);
    //   owner = await ethers.getSigner(Owner);
    //   const [signer] = await ethers.getSigners();

    });
    describe("RiskFundTransformer", () => {
      beforeEach(async () => {
        RiskFundTransformer = await hre.ethers.getContractAt("RiskFundTransformer", RiskFundTransformerProxyAddress);
        // AccessController = await hre.ethers.getContractAt("MockACM", ACMAddress);
        // poolRegistry = await hre.ethers.getContractAt("MockPoolRegistry", PoolRegistryAddress);
        ProtocolShareReserve = await hre.ethers.getContractAt("ProtocolShareReserve", ProtocolShareReserveProxyAddress);
        PriceOracle = await hre.ethers.getContractAt("ResilientOracle", PriceOracleAddress);
        // console.log(await RiskFundTransformer.destinationAddress());
        console.log( await hre.ethers.provider.getBlock("latest"));
        // console.log(await ProtocolShareReserve.owner());

        await expect(RiskFundTransformer.destinationAddress()).to.be.revertedWithCustomError(RiskFundTransformer, "InsufficientInputAmount");
      })
      it("just work", async () => {
        
        //   console.log()
          console.log(await PriceOracle.getPrice(BNB));
      });
    });
  }
});