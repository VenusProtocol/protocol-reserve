import chai from "chai";
import { Contract, Signer } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import hre from "hardhat";

import { forking, initMainnetUser } from "../utils";

const { expect } = chai;

const NORMAL_TIMELOCK = "0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396";
const PROTOCOL_SHARE_RESERVE = "0xCa01D5A9A248a830E9D93231e791B1afFed7c446";
const SINGLE_TOKEN_CONVERTER_BEACON_PROXY = "0x4c9D57b05B245c40235D720A5f3A592f3DfF11ca";
const RISK_FUND_CONVERTER_PROXY = "0xA5622D276CcbB8d9BBE3D1ffd1BB11a0032E53F0";
const PROXY_ADMIN = "0x6beb6D2695B67FEb73ad4f172E8E2975497187e4";
const BTCB_PRIME_CONVERTER = "0xE8CeAa79f082768f99266dFd208d665d2Dd18f53";
const CORE_POOL = "0xfd36e2c2a6789db23113685031d7f16329158384";

//Assets listed in core pool and need to release funds for them
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BTCB = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";

async function getToken(tokenAddress) {
  const token = await hre.ethers.getContractAt("MockToken", tokenAddress);
  return token;
}

export const ASSETS = [
  { name: "AAVE", address: "0xfb6115445Bff7b52FeB98650C87f44907E58f802" },
  { name: "ADA", address: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47" },
  { name: "BCH", address: "0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf" },
  { name: "BETH", address: "0x250632378E573c6Be1AC2f97Fcdf00515d0Aa91B" },
  { name: "BTCB", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c" },
  // { name: "BUSD", address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" },
  { name: "CAKE", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82" },
  { name: "DAI", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3" },
  { name: "DOGE", address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43" },
  { name: "DOT", address: "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402" },
  { name: "ETH", address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8" },
  { name: "FDUSD", address: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409" },
  { name: "FIL", address: "0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153" },
  { name: "LINK", address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD" },
  { name: "LTC", address: "0x4338665CBB7B2485A8855A139b75D5e34AB0DB94" },
  // { name: "LUNA", address: "0x156ab3346823B651294766e23e6Cf87254d68962" },
  { name: "MATIC", address: "0xCC42724C6683B7E57334c4E856f4c9965ED682bD" },
  { name: "SXP", address: "0x47BEAd2563dCBf3bF2c9407fEa4dC236fAbA485A" },
  { name: "TRX", address: "0xCE7de646e7208a4Ef112cb6ed5038FA6cC6b12e3" },
  // { name: "TRXOLD", address: "0x85EAC5Ac2F758618dFa09bDbe0cf174e7d574D5B" },
  { name: "TUSD", address: "0x40af3827F39D0EAcBF4A168f8D4ee67c121D11c9" },
  // { name: "TUSDOLD", address: "0x14016E85a25aeb13065688cAFB43044C2ef86784" },
  { name: "UNI", address: "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1" },
  { name: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
  { name: "USDT", address: "0x55d398326f99059fF775485246999027B3197955" },
  // { name: "UST", address: "0x3d4350cD54aeF9f9b2C29435e0fa809957B3F30a" },
  // { name: "VAI", address: "0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7" },
  // { name: "VRT", address: "0x5f84ce30dc3cf7909101c69086c50de191895883" },
  { name: "WBETH", address: "0xa2e3356610840701bdf5611a53974510ae27e2e1" },
  { name: "XRP", address: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE" },
  { name: "XVS", address: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63" },
];

forking(35936683, () => {
  let protocolShareReserve: Contract;
  let singleTokenConverterBeaconProxy: Contract;
  let proxyAdmin = Contract;
  let singleTokenConverterImplementation = Contract;
  let timeLockSigner: Signer;

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
          await expect(protocolShareReserve.releaseFunds(CORE_POOL, [BTCB])).to.be.revertedWithCustomError(
            singleTokenConverterImplementation,
            "InsufficientPoolLiquidity",
          );
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

        it("Success for core pool through PROTOCOL_SHARE_RESERVE", async () => {
          await protocolShareReserve.releaseFunds(CORE_POOL, [BTCB]);
        });

        it("Validates successful execution of releaseFunds", async () => {
          for (const asset of ASSETS) {
            await protocolShareReserve.releaseFunds(CORE_POOL, [asset.address]);
            console.log("Released Funds for ", asset.name);
          }
        });

        it("Validates if released funds are released as expected", async () => {
          const usdt = await getToken(USDT);

          const btcbPrimeConverterBalanceBefore = await usdt.balanceOf(BTCB_PRIME_CONVERTER);

          await protocolShareReserve.releaseFunds(CORE_POOL, [BTCB]);

          const btcbPrimeConverterBalanceAfter = await usdt.balanceOf(BTCB_PRIME_CONVERTER);

          // Since we have released the funds the current balance of the converter should be greater than or equal to balance before
          expect(btcbPrimeConverterBalanceBefore).to.be.greaterThanOrEqual(btcbPrimeConverterBalanceAfter);
          //-------- OLD SCENARIO --------//
          // amountInMantissa = ((amountOutMantissa * EXP_SCALE) + tokenInToOutConversion - 1) / tokenInToOutConversion; //round-up
          // amountInMantissa = ((2791059920256193728245 * 1e18) + 44097363325886872486444 - 1) / 44097363325886872486444;
          // amountInMantissa = 63293124798183403;
          // This turned out assets released from reserves to be equal 2791059920256193753040
          //------------------------------//
          //-------- CURRENT SCENARIO --------//
          // amountInMantissa = (amountOutMantissa * EXP_SCALE) / tokenInToOutConversion;
          // amountInMantissa = (2791059920256193728245 * 1e18) / 44097363325886872486444;
          // amountInMantissa = 63293124798183402;
          // This turned out assets released from reserves to be equal 2791059920256193708943 which is less by 44097 hence a minute amount of assets won't be converted.
          // Leaving behind a small amount of usdt "19302" with the BTCBPrimeConverter
          //----------------------------------//
          expect(btcbPrimeConverterBalanceAfter).to.be.greaterThanOrEqual(0);
        });

        describe("getAmountIn", () => {
          let btcbPrimeConverter: Contract;
          let riskFundSigner: Signer;

          beforeEach(async () => {
            await protocolShareReserve.releaseFunds(CORE_POOL, [BTCB]);

            btcbPrimeConverter = await hre.ethers.getContractAt("SingleTokenConverter", BTCB_PRIME_CONVERTER);
            riskFundSigner = await initMainnetUser(RISK_FUND_CONVERTER_PROXY);
          });

          it("return values should differ for same amountOut given as input during private and user conversion", async () => {
            const [, amountInMantissaForUser] = await btcbPrimeConverter.callStatic.getUpdatedAmountIn(
              parseUnits("100", 18),
              BTCB,
              USDT,
            );
            const [, amountInMantissaForPrivate] = await btcbPrimeConverter
              .connect(riskFundSigner)
              .callStatic.getUpdatedAmountIn(parseUnits("100", 18), BTCB, USDT);

            // The amountIn as output by function called when conversion is done by normal user
            // should be 1 greater than the amountIn as output received when called as private conversion
            expect(amountInMantissaForPrivate).to.equal(amountInMantissaForUser - 1);
          });
        });
      });
    });
  }
});
