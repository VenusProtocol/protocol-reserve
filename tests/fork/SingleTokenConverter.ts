import chai from "chai";
import hre, { network } from "hardhat";

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
  describe(`riskFundConverter #${blockNumber}`, () => {
    before(async () => {
      await setForkBlock(blockNumber);
    });
    fn();
  });
};

async function impersonateAccount(accountAddress) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [accountAddress],
  });
}

const NORMAL_TIMELOCK = "0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396";
const PROTOCOL_SHARE_RESERVE = "0xCa01D5A9A248a830E9D93231e791B1afFed7c446";
const SINGLE_TOKEN_CONVERTER_BEACON_PROXY = "0x4c9D57b05B245c40235D720A5f3A592f3DfF11ca";
const RISK_FUND_CONVERTER_PROXY = "0xA5622D276CcbB8d9BBE3D1ffd1BB11a0032E53F0";
const PROXY_ADMIN = "0x6beb6D2695B67FEb73ad4f172E8E2975497187e4";

const CORE_POOL = "0xfd36e2c2a6789db23113685031d7f16329158384";
//Assets listed in core pool and need to release mfunds for them
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BTCB = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";
const ETH = "0x2170Ed0880ac9A755fd29B2688956BD959F933F8";
const DAI = "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3";
const TUSD = "0x40af3827F39D0EAcBF4A168f8D4ee67c121D11c9";
const DOT = "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402";
const CAKE = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
const LINK = "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD";
const TRX = "0xCE7de646e7208a4Ef112cb6ed5038FA6cC6b12e3";
const FDUSD = "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

forking(35936683, () => {
  let protocolShareReserve: ethers.Contract;
  let singleTokenConverterBeaconProxy: ethers.Contract;
  let proxyAdmin = ethers.Contract;
  let singleTokenConverterImplementation = ethers.Contract;
  let timeLockSigner: ethers.Signer;

  if (process.env.FORK_MAINNET === "true") {
    describe("Single token converter", () => {
      before(async () => {
        const singleTokenConverterFactory = await hre.ethers.getContractFactory("SingleTokenConverter");
        singleTokenConverterImplementation = await singleTokenConverterFactory.deploy();

        protocolShareReserve = await hre.ethers.getContractAt("ProtocolShareReserve", PROTOCOL_SHARE_RESERVE);
        timeLockSigner = await initMainnetUser(NORMAL_TIMELOCK);
      });

      describe("Failing releaseFund when getAmountIn and getAmountOut are rounding up the values", () => {
        it("Failed releaseFund for core pool through PROTOCOL_SHARE_RESERVE", async () => {
          await expect(
            protocolShareReserve.releaseFunds(CORE_POOL, [
              USDT,
              BTCB,
              ETH,
              DAI,
              TUSD,
              DOT,
              CAKE,
              LINK,
              TRX,
              FDUSD,
              WBNB,
            ]),
          ).to.be.revertedWithCustomError(singleTokenConverterImplementation, "InsufficientPoolLiquidity");
        });
      });

      describe("Success on releaseFund when getAmountIn and getAmountOut are not rounding up the values", () => {
        before(async () => {
          const riskFundConverterFactory = await ethers.getContractFactory("RiskFundConverter");
          const riskFundConverterImplementation = await riskFundConverterFactory.deploy(
            "0xfD36E2c2a6789Db23113685031d7F16329158384",
            "0xA07c5b74C9B40447a954e1466938b865b6BBea36",
            "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
          );

          singleTokenConverterBeaconProxy = await hre.ethers.getContractAt(
            "UpgradeableBeacon",
            SINGLE_TOKEN_CONVERTER_BEACON_PROXY,
          );
          proxyAdmin = await hre.ethers.getContractAt("ProxyAdmin", PROXY_ADMIN);

          await singleTokenConverterBeaconProxy
            .connect(timeLockSigner)
            .upgradeTo(singleTokenConverterImplementation.address);
          await proxyAdmin
            .connect(timeLockSigner)
            .upgrade(RISK_FUND_CONVERTER_PROXY, riskFundConverterImplementation.address);
        });

        it("Succes for core pool through PROTOCOL_SHARE_RESERVE", async () => {
          await protocolShareReserve.releaseFunds(CORE_POOL, [
            USDT,
            BTCB,
            ETH,
            DAI,
            TUSD,
            DOT,
            CAKE,
            LINK,
            TRX,
            FDUSD,
            WBNB,
          ]);
        });
      });
    });
  }
});
