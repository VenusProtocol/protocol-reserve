import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import hre from "hardhat";

import { ResilientOracleInterface } from "../../typechain";
import { forking, initMainnetUser } from "../utils";

const { expect } = chai;

async function getToken(tokenAddress) {
  const token = await hre.ethers.getContractAt("MockToken", tokenAddress);
  return token;
}

const NORMAL_TIMELOCK = "0xce10739590001705f7ff231611ba4a48b2820327";
const USDT = "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c";
const ALPACA = "0x6923189d91fdF62dBAe623a55273F1d20306D9f2";
const RISK_FUND_CONVERTER = "0x74C758D90D327b51066BaD6656832836ced45d97";
const COMPTROLLER_ALPACA_USDT = "0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD";
const CORE_POOL_COMPTROLLER = "0x94d1820b2D1c7c7452A163983Dc888CEC546b77D";
const ACM = "0x45f8a08F534f34A97187626E05d4b6648Eeaa9AA";
const PRICE_ORACLE = "0x3cD69251D04A28d887Ac14cbe2E14c52F3D57823";
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
const CONVERTER_OWNER = "0x7Bf1Fe2C42E79dbA813Bf5026B7720935a55ec5f";
const WBNB_HOLDER = "0x352a7a5277ec7619500b06fa051974621c1acd12";
const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
const INCENTIVE = parseUnits("0.02", 18);

forking(33039953, () => {
  let usdtToken: ethers.Contract;
  let priceOracle: ethers.Contract;
  let alpacaToken: ethers.Contract;
  let wBNBToken: ethers.Contract;
  let accessController: ethers.Contract;
  let riskFundConverter: ethers.Contract;
  let signer: ethers.Signer;
  let timeLockSigner: ethers.Signer;
  let converterOwnerSigner: ethers.Signer;
  let wBNBHolder: ethers.Signer;
  let converterTokenData: object;
  let amountIn: BigNumber;
  let amountOutExpected: BigNumber;
  const FORK_TESTNET = process.env.FORK === "true" && process.env.FORKED_NETWORK === "bsctestnet";

  if (FORK_TESTNET) {
    describe("riskFundConverter", () => {
      beforeEach(async () => {
        accessController = await hre.ethers.getContractAt("MockACM", ACM);
        priceOracle = await hre.ethers.getContractAt("ResilientOracle", PRICE_ORACLE);
        riskFundConverter = await hre.ethers.getContractAt("RiskFundConverter", RISK_FUND_CONVERTER);

        usdtToken = await getToken(USDT);
        alpacaToken = await getToken(ALPACA);
        wBNBToken = await getToken(WBNB);

        timeLockSigner = await initMainnetUser(NORMAL_TIMELOCK);
        converterOwnerSigner = await initMainnetUser(CONVERTER_OWNER);
        wBNBHolder = await initMainnetUser(WBNB_HOLDER);

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

        it("getAmountOut should execute successfully", async () => {
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

        it("token conversion should execute succesfully", async () => {
          amountIn = parseUnits("1", 18);
          await alpacaToken.faucet(parseUnits("6", 18));

          // Transfering some asset to RISK_FUND_CONVERTER.
          await usdtToken.allocateTo(RISK_FUND_CONVERTER, parseUnits("1", 18));
          await riskFundConverter.updateAssetsState(COMPTROLLER_ALPACA_USDT, USDT);

          await alpacaToken.approve(RISK_FUND_CONVERTER, parseUnits("1", 18));

          const actualAmountOut = await riskFundConverter.callStatic.getAmountOut(amountIn, ALPACA, USDT);

          const signerPreviousBalance = await usdtToken.balanceOf(signer);

          const tx = await riskFundConverter.convertExactTokens(amountIn, parseUnits("1", 5), ALPACA, USDT, signer);
          await tx.wait();

          await expect(tx).emit(riskFundConverter, "ConvertExactTokens").withArgs(amountIn, actualAmountOut[1]);

          const signerAfterBalance = await usdtToken.balanceOf(signer);

          expect(signerAfterBalance.sub(signerPreviousBalance)).to.equal(actualAmountOut[1]);
        });

        it("token conversion wrapped native token (WBNB) should execute succesfully", async () => {
          converterTokenData = {
            tokenAddressIn: USDT,
            tokenAddressOut: WBNB,
            incentive: INCENTIVE,
            enabled: true,
          };
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_CONVERTER, "setConversionConfig(ConversionConfig)", signer);

          await riskFundConverter.setConversionConfig(converterTokenData);

          amountIn = parseUnits("1", 18);

          // Transfering some asset to RISK_FUND_CONVERTER.
          await usdtToken.allocateTo(signer, parseUnits("1", 18));
          await usdtToken.approve(RISK_FUND_CONVERTER, parseUnits("1", 18));

          await wBNBToken.connect(wBNBHolder).transfer(RISK_FUND_CONVERTER, parseUnits("1", 18));
          await riskFundConverter.updateAssetsState(CORE_POOL_COMPTROLLER, WBNB);

          const actualAmountOut = await riskFundConverter.callStatic.getAmountOut(amountIn, USDT, WBNB);

          const signerPreviousBalance = await wBNBToken.balanceOf(signer);

          const tx = await riskFundConverter.convertExactTokens(amountIn, parseUnits("1", 5), USDT, WBNB, signer);
          await tx.wait();

          await expect(tx)
            .emit(riskFundConverter, "ConvertExactTokens")
            .withArgs(actualAmountOut[0], actualAmountOut[1]);

          const signerAfterBalance = await wBNBToken.balanceOf(signer);

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

        it("token conversion should execute successfully", async () => {
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
          await alpacaToken.faucet(parseUnits("6", 18));

          await alpacaToken.approve(RISK_FUND_CONVERTER, parseUnits("5", 18));
          amountOutExpected = parseUnits("1", 5);

          await usdtToken.allocateTo(RISK_FUND_CONVERTER, parseUnits("1", 18));
          await riskFundConverter.updateAssetsState(COMPTROLLER_ALPACA_USDT, USDT);

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

        it("token conversion of wrapped native token (WBNB) should execute successfully", async () => {
          converterTokenData = {
            tokenAddressIn: WBNB,
            tokenAddressOut: USDT,
            incentive: INCENTIVE,
            enabled: true,
          };
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_CONVERTER, "setConversionConfig(ConversionConfig)", signer);

          await riskFundConverter.setConversionConfig(converterTokenData);

          await wBNBToken.connect(wBNBHolder).transfer(signer, parseUnits("6", 18));

          await wBNBToken.approve(RISK_FUND_CONVERTER, parseUnits("5", 18));
          await usdtToken.allocateTo(RISK_FUND_CONVERTER, parseUnits("1", 18));
          await riskFundConverter.updateAssetsState(CORE_POOL_COMPTROLLER, USDT);

          amountOutExpected = parseUnits("1", 6);
          const actualAmounts = await riskFundConverter.callStatic.getAmountIn(amountOutExpected, WBNB, USDT);
          const signerPreviousBalance = await wBNBToken.balanceOf(signer);

          const tx = await riskFundConverter.convertForExactTokens(
            parseUnits("5", 18),
            amountOutExpected,
            WBNB,
            USDT,
            signer,
          );
          await tx.wait();

          await expect(tx)
            .emit(riskFundConverter, "ConvertForExactTokens")
            .withArgs(actualAmounts[1], actualAmounts[0]);

          const signerAfterBalance = await wBNBToken.balanceOf(signer);

          expect(signerPreviousBalance.sub(signerAfterBalance)).to.equal(actualAmounts[1]);
        });
      });

      describe("Set price oracle", () => {
        it("Set price oracle", async () => {
          const newOracle = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");

          const tx = await riskFundConverter.connect(converterOwnerSigner).setPriceOracle(newOracle.address);
          await tx.wait();

          await expect(tx).to.emit(riskFundConverter, "PriceOracleUpdated").withArgs(PRICE_ORACLE, newOracle.address);
        });
      });

      describe("Pause/Resume converter functionality", () => {
        it("Pause Converter", async () => {
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_CONVERTER, "pauseConversion()", converterOwnerSigner.address);

          const tx = await riskFundConverter.connect(converterOwnerSigner).pauseConversion();
          tx.wait();

          await expect(tx).to.emit(riskFundConverter, "ConversionPaused").withArgs(converterOwnerSigner.address);
        });

        it("Resume Converter", async () => {
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_CONVERTER, "resumeConversion()", converterOwnerSigner.address);

          const tx = await riskFundConverter.connect(converterOwnerSigner).resumeConversion();
          tx.wait();

          await expect(tx).to.emit(riskFundConverter, "ConversionResumed").withArgs(converterOwnerSigner.address);
        });
      });
      //TODO: Need to write test cases for supporting fee methods once protocol share reserve V1 deployed to mainnet
    });
  }
});
