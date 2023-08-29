import chai from "chai";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
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

async function getToken(tokenAddress) {
  const token = await hre.ethers.getContractAt("MockToken", tokenAddress);
  return token;
}

const NORMAL_TIMELOCK = "0xce10739590001705f7ff231611ba4a48b2820327";
const USDT = "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c";
const ALPACA = "0x6923189d91fdF62dBAe623a55273F1d20306D9f2";
const RISK_FUND_CONVERTER = "0x4512e9579734f7B8730f0a05Cd0D92DC33EB2675";
const COMPTROLLER_ALPACA_USDT = "0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD";
const ACM = "0x45f8a08F534f34A97187626E05d4b6648Eeaa9AA";
const PRICE_ORACLE = "0x3cD69251D04A28d887Ac14cbe2E14c52F3D57823";
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
const POOL_REGISTRY = "0xC85491616Fa949E048F3aAc39fbf5b0703800667";
const CONVERTER_OWNER = "0x7Bf1Fe2C42E79dbA813Bf5026B7720935a55ec5f";
const RISK_FUND = "0xBe4609d972FdEBAa9DC870F4A957F40C301bEb1D";
const INCENTIVE = parseUnits("0.02", 18);

forking(32843073, () => {
  let usdtToken: ethers.Contract;
  let priceOracle: ethers.Contract;
  let alpacaToken: ethers.Contract;
  let accessController: ethers.Contract;
  let riskFundConverter: ethers.Contract;
  let signer: ethers.Signer;
  let timeLockSigner: ethers.Signer;
  let converterOwnerSigner: ethers.Signer;
  let converterTokenData: object;
  let amountIn: BigNumber;
  let amountOutExpected: BigNumber;

  if (process.env.FORK_TESTNET === "true") {
    describe("riskFundConverter", () => {
      beforeEach(async () => {
        accessController = await hre.ethers.getContractAt("MockACM", ACM);
        priceOracle = await hre.ethers.getContractAt("ResilientOracle", PRICE_ORACLE);
        riskFundConverter = await hre.ethers.getContractAt("RiskFundConverter", RISK_FUND_CONVERTER);

        usdtToken = await getToken(USDT);
        alpacaToken = await getToken(ALPACA);

        timeLockSigner = await initMainnetUser(NORMAL_TIMELOCK);
        converterOwnerSigner = await initMainnetUser(CONVERTER_OWNER);

        await riskFundConverter.connect(converterOwnerSigner).setPoolRegistry(POOL_REGISTRY);

        const signers = await ethers.getSigners();
        signer = await signers[0].getAddress();

        converterTokenData = {
          tokenAddressIn: ALPACA,
          tokenAddressOut: USDT,
          incentive: INCENTIVE,
          enabled: true,
        };
      });

      describe("setConversionConfig()", () => {
        it("should revert when access is not given to set token config", async () => {
          await expect(riskFundConverter.setConversionConfig(converterTokenData)).to.be.revertedWithCustomError(
            riskFundConverter,
            "Unauthorized",
          );
        });

        it("should revert on zero token Address", async () => {
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_CONVERTER, "setConversionConfig(ConversionConfig)", signer);

          converterTokenData.tokenAddressIn = ADDRESS_ZERO;
          await expect(riskFundConverter.setConversionConfig(converterTokenData)).to.be.revertedWithCustomError(
            riskFundConverter,
            "ZeroAddressNotAllowed",
          );

          converterTokenData.tokenAddressOut = ADDRESS_ZERO;
          await expect(riskFundConverter.setConversionConfig(converterTokenData)).to.be.revertedWithCustomError(
            riskFundConverter,
            "ZeroAddressNotAllowed",
          );
        });

        it("should revert when hign incentive is given", async () => {
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_CONVERTER, "setConversionConfig(ConversionConfig)", signer);
          converterTokenData.incentive = parseUnits("6", 18);
          await expect(riskFundConverter.setConversionConfig(converterTokenData)).to.be.revertedWithCustomError(
            riskFundConverter,
            "IncentiveTooHigh",
          );
        });

        it("set conversion config successfully", async () => {
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_CONVERTER, "setConversionConfig(ConversionConfig)", signer);

          const tx = await riskFundConverter.setConversionConfig(converterTokenData);
          await tx.wait();
          await expect(tx)
            .to.emit(riskFundConverter, "ConversionConfigUpdated")
            .withArgs(
              converterTokenData.tokenAddressIn,
              converterTokenData.tokenAddressOut,
              0,
              converterTokenData.incentive,
              false,
              converterTokenData.enabled,
            );
        });
      });

      describe("getAmountOut()", async () => {
        it("should revert when token config is not set or enabled", async () => {
          amountIn = parseUnits("1", 18);
          converterTokenData = {
            tokenAddressIn: ALPACA,
            tokenAddressOut: USDT,
            incentive: INCENTIVE,
            enabled: false,
          };
          await riskFundConverter.setConversionConfig(converterTokenData);
          await expect(riskFundConverter.getAmountOut(amountIn, ALPACA, USDT)).to.be.revertedWithCustomError(
            riskFundConverter,
            "ConversionConfigNotEnabled",
          );
        });

        it("should revert when amountIn is 0", async () => {
          amountIn = parseUnits("0", 0);
          await expect(riskFundConverter.getAmountOut(amountIn, ALPACA, USDT)).to.be.revertedWithCustomError(
            riskFundConverter,
            "InsufficientInputAmount",
          );
        });

        it.only("getAmountOut should execute successfully", async () => {
          converterTokenData = {
            tokenAddressIn: ALPACA,
            tokenAddressOut: USDT,
            incentive: INCENTIVE,
            enabled: true,
          };

          amountIn = parseUnits("1", 18);

          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_CONVERTER, "setConversionConfig(ConversionConfig)", signer);

          await riskFundConverter.setConversionConfig(converterTokenData);

          //amountOut should be zero as riskFundConverter does not have USDT faucet now.
          let actualAmountOut = await riskFundConverter.callStatic.getAmountOut(amountIn, ALPACA, USDT);
          expect(actualAmountOut[0]).to.equal(0);

          // Calculation for Token out.
          const alpacaPrice = await priceOracle.getPrice(ALPACA);
          const usdtPrice = await priceOracle.getPrice(USDT);
          const incentivePlusMantissa = parseUnits("1.02", 18);
          const tokenInToOutConversion = alpacaPrice.mul(incentivePlusMantissa).div(usdtPrice);
          const amountOut = amountIn.mul(tokenInToOutConversion).div(parseUnits("1", 18));

          await usdtToken.allocateTo(RISK_FUND_CONVERTER, parseUnits("1", 6));
          await riskFundConverter.updateAssetsState(COMPTROLLER_ALPACA_USDT, USDT);

          actualAmountOut = await riskFundConverter.callStatic.getAmountOut(amountIn, ALPACA, USDT);
          expect(actualAmountOut[1]).to.equal(amountOut);
        });
      });

      describe("convertExactTokens()", () => {
        it("should revert when token conversion is paused", async () => {
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_CONVERTER, "pauseConversion()", signer);

          await riskFundConverter.pauseConversion();
          await expect(
            riskFundConverter.convertExactTokens(amountIn, parseUnits("1", 5), ALPACA, USDT, signer),
          ).to.be.revertedWithCustomError(riskFundConverter, "ConversionTokensPaused");
        });

        it("should revert when amountOut desired is high", async () => {
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_CONVERTER, "resumeConversion()", signer);
          await riskFundConverter.resumeConversion();

          await expect(
            riskFundConverter.convertExactTokens(amountIn, parseUnits("5", 6), ALPACA, USDT, signer),
          ).to.be.revertedWithCustomError(riskFundConverter, "AmountOutLowerThanMinRequired");
        });

        it.only("token conversion should execute succesfully", async () => {
          amountIn = parseUnits("1", 18);
          await alpacaToken.faucet(parseUnits("6", 18));

          converterTokenData = {
            tokenAddressIn: ALPACA,
            tokenAddressOut: USDT,
            incentive: INCENTIVE,
            enabled: true,
          };
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_CONVERTER, "setConversionConfig(ConversionConfig)", signer);

          await riskFundConverter.setConversionConfig(converterTokenData);
          await riskFundConverter.connect(converterOwnerSigner).setDestination(RISK_FUND);

          // Transfering some asset to RISK_FUND_CONVERTER.
          await alpacaToken.transfer(RISK_FUND_CONVERTER, parseUnits("5", 18));
          await riskFundConverter.updateAssetsState(COMPTROLLER_ALPACA_USDT, ALPACA);

          await usdtToken.allocateTo(RISK_FUND_CONVERTER, parseUnits("1", 6));
          await riskFundConverter.updateAssetsState(COMPTROLLER_ALPACA_USDT, USDT);

          await alpacaToken.approve(RISK_FUND_CONVERTER, parseUnits("1", 18));

          const actualAmountOut = await riskFundConverter.callStatic.getAmountOut(amountIn, ALPACA, USDT);

          const signerPreviousBalance = await usdtToken.balanceOf(signer);

          const tx = await riskFundConverter.convertExactTokens(amountIn, parseUnits("1", 3), ALPACA, USDT, signer);
          await tx.wait();

          await expect(tx).emit(riskFundConverter, "ConvertExactTokens").withArgs(amountIn, actualAmountOut[1]);

          const signerAfterBalance = await usdtToken.balanceOf(signer);

          expect(signerAfterBalance.sub(signerPreviousBalance)).to.equal(actualAmountOut[1]);
        });
      });

      describe("getAmountIn()", () => {
        it("should revert when amount out expected is 0", async () => {
          amountOutExpected = parseUnits("0", 0);
          await expect(riskFundConverter.getAmountIn(amountOutExpected, ALPACA, USDT)).to.be.revertedWithCustomError(
            riskFundConverter,
            "InsufficientInputAmount",
          );
        });

        it("should revert when token config is not set or enabled", async () => {
          amountOutExpected = parseUnits("1", 6);
          converterTokenData = {
            tokenAddressIn: ALPACA,
            tokenAddressOut: USDT,
            incentive: INCENTIVE,
            enabled: false,
          };
          await riskFundConverter.setConversionConfig(converterTokenData);
          await expect(riskFundConverter.getAmountIn(amountOutExpected, ALPACA, USDT)).to.be.revertedWithCustomError(
            riskFundConverter,
            "ConversionConfigNotEnabled",
          );
        });

        it("getAmountIn should execute successfully", async () => {
          converterTokenData = {
            tokenAddressIn: ALPACA,
            tokenAddressOut: USDT,
            incentive: INCENTIVE,
            enabled: true,
          };

          await riskFundConverter.setConversionConfig(converterTokenData);

          // Minting some more USDT to Converter Address.
          await usdtToken.allocateTo(RISK_FUND_CONVERTER, parseUnits("1", 6));
          // Updating riskFundConverter state.
          await riskFundConverter.updateAssetsState(COMPTROLLER_ALPACA_USDT, USDT);

          // Calculation for Token In.
          const alpacaPrice = await priceOracle.getPrice(ALPACA);
          const usdtPrice = await priceOracle.getPrice(USDT);
          const incentivePlusMantissa = parseUnits("1.02", 18);
          const tokenInToOutConversion = alpacaPrice.mul(incentivePlusMantissa).div(usdtPrice);
          const amountInToTake = amountOutExpected.mul(parseUnits("1", 18)).div(tokenInToOutConversion);

          const actualAmounts = await riskFundConverter.callStatic.getAmountIn(amountOutExpected, ALPACA, USDT);
          expect(actualAmounts[1]).to.equal(amountInToTake);
        });
      });

      describe("convertForExactTokens()", () => {
        it("should revert when conversion is paused", async () => {
          await riskFundConverter.pauseConversion();
          await expect(
            riskFundConverter.convertForExactTokens(parseUnits("10", 18), amountOutExpected, ALPACA, USDT, signer),
          ).to.be.revertedWithCustomError(riskFundConverter, "ConversionTokensPaused");
        });

        it("should revert when amountOut desired is high", async () => {
          await riskFundConverter.resumeConversion();
          amountOutExpected = parseUnits("1", 6);
          await expect(
            riskFundConverter.convertForExactTokens(parseUnits("1", 18), amountOutExpected, ALPACA, USDT, signer),
          ).to.be.revertedWithCustomError(riskFundConverter, "AmountInHigherThanMax");
        });

        it.only("token conversion should execute successfully", async () => {
          converterTokenData = {
            tokenAddressIn: ALPACA,
            tokenAddressOut: USDT,
            incentive: INCENTIVE,
            enabled: true,
          };
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_CONVERTER, "setConversionConfig(ConversionConfig)", signer);

          await riskFundConverter.setConversionConfig(converterTokenData);
          await riskFundConverter.connect(converterOwnerSigner).setDestination(RISK_FUND);
          await alpacaToken.faucet(parseUnits("6", 18));

          await alpacaToken.approve(RISK_FUND_CONVERTER, parseUnits("5", 18));
          amountOutExpected = parseUnits("1", 6);

          const actualAmounts = await riskFundConverter.callStatic.getAmountIn(amountOutExpected, ALPACA, USDT);
          const signerPreviousBalance = await alpacaToken.balanceOf(signer);

          const tx = await riskFundConverter.convertForExactTokens(
            parseUnits("5", 18),
            amountOutExpected,
            ALPACA,
            USDT,
            signer,
          );
          await tx.wait();

          await expect(tx)
            .emit(riskFundConverter, "ConvertForExactTokens")
            .withArgs(actualAmounts[1], actualAmounts[0]);

          const signerAfterBalance = await alpacaToken.balanceOf(signer);

          expect(signerPreviousBalance.sub(signerAfterBalance)).to.equal(actualAmounts[1]);
        });
      });

      //TODO: Need to write test cases for supporting fee methods once protocol share reserve V1 deployed to mainnet
    });
  }
});
