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
  describe(`riskFundTransformer #${blockNumber}`, () => {
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
const RISK_FUND_TRANSFORMER = "0x8CC7ecFa3AF1D78dD2ceE2239E2b58aA206f8952";
const COMPTROLLER_ALPACA_USDT = "0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD";
const ACM = "0x45f8a08F534f34A97187626E05d4b6648Eeaa9AA";
const PRICE_ORACLE = "0x3cD69251D04A28d887Ac14cbe2E14c52F3D57823";
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

const INCENTIVE = parseUnits("0.02", 18);

forking(32038478, () => {
  let usdtToken: ethers.Contract;
  let priceOracle: ethers.Contract;
  let alpacaToken: ethers.Contract;
  let accessController: ethers.Contract;
  let riskFundTransformer: ethers.Contract;
  let signer: ethers.Signer;
  let timeLockSigner: ethers.Signer;
  let transformerTokenData: object;
  let amountIn: BigNumber;
  let amountOutExpected: BigNumber;

  if (process.env.FORK_TESTNET === "true") {
    describe("riskFundTransformer", () => {
      beforeEach(async () => {
        accessController = await hre.ethers.getContractAt("MockACM", ACM);
        priceOracle = await hre.ethers.getContractAt("ResilientOracle", PRICE_ORACLE);
        riskFundTransformer = await hre.ethers.getContractAt("RiskFundTransformer", RISK_FUND_TRANSFORMER);

        usdtToken = await getToken(USDT);
        alpacaToken = await getToken(ALPACA);

        timeLockSigner = await initMainnetUser(NORMAL_TIMELOCK);

        const signers = await ethers.getSigners();
        signer = await signers[0].getAddress();

        transformerTokenData = {
          tokenAddressIn: ALPACA,
          tokenAddressOut: USDT,
          incentive: INCENTIVE,
          enabled: true,
        };
      });

      describe("setTransformationConfig()", () => {
        it("should revert when access is not given to set token config", async () => {
          await expect(riskFundTransformer.setTransformationConfig(transformerTokenData)).to.be.revertedWithCustomError(
            riskFundTransformer,
            "Unauthorized",
          );
        });

        it("should revert on zero token Address", async () => {
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_TRANSFORMER, "setTransformationConfig(TransformationConfig)", signer);

          transformerTokenData.tokenAddressIn = ADDRESS_ZERO;
          await expect(riskFundTransformer.setTransformationConfig(transformerTokenData)).to.be.revertedWithCustomError(
            riskFundTransformer,
            "ZeroAddressNotAllowed",
          );

          transformerTokenData.tokenAddressOut = ADDRESS_ZERO;
          await expect(riskFundTransformer.setTransformationConfig(transformerTokenData)).to.be.revertedWithCustomError(
            riskFundTransformer,
            "ZeroAddressNotAllowed",
          );
        });

        it("should revert when hign incentive is given", async () => {
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_TRANSFORMER, "setTransformationConfig(TransformationConfig)", signer);
          transformerTokenData.incentive = parseUnits("6", 18);
          await expect(riskFundTransformer.setTransformationConfig(transformerTokenData)).to.be.revertedWithCustomError(
            riskFundTransformer,
            "IncentiveTooHigh",
          );
        });

        it("set transform config successfully", async () => {
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_TRANSFORMER, "setTransformationConfig(TransformationConfig)", signer);

          const tx = await riskFundTransformer.setTransformationConfig(transformerTokenData);
          await tx.wait();
          await expect(tx)
            .to.emit(riskFundTransformer, "TransformationConfigUpdated")
            .withArgs(
              transformerTokenData.tokenAddressIn,
              transformerTokenData.tokenAddressOut,
              0,
              transformerTokenData.incentive,
              false,
              transformerTokenData.enabled,
            );
        });
      });

      describe("getAmountOut()", async () => {
        it("should revert when token config is not set or enabled", async () => {
          amountIn = parseUnits("1", 18);
          transformerTokenData = {
            tokenAddressIn: ALPACA,
            tokenAddressOut: USDT,
            incentive: INCENTIVE,
            enabled: false,
          };
          await riskFundTransformer.setTransformationConfig(transformerTokenData);
          await expect(riskFundTransformer.getAmountOut(amountIn, ALPACA, USDT)).to.be.revertedWithCustomError(
            riskFundTransformer,
            "TransformationConfigNotEnabled",
          );
        });

        it("should revert when amountIn is 0", async () => {
          amountIn = parseUnits("0", 0);
          await expect(riskFundTransformer.getAmountOut(amountIn, ALPACA, USDT)).to.be.revertedWithCustomError(
            riskFundTransformer,
            "InsufficientInputAmount",
          );
        });

        it("getAmountOut should execute successfully", async () => {
          transformerTokenData = {
            tokenAddressIn: ALPACA,
            tokenAddressOut: USDT,
            incentive: INCENTIVE,
            enabled: true,
          };

          amountIn = parseUnits("1", 18);

          await riskFundTransformer.setTransformationConfig(transformerTokenData);

          //amountOut should be zero as riskFundTransformer does not have USDT faucet now.
          let actualAmountOut = await riskFundTransformer.callStatic.getAmountOut(amountIn, ALPACA, USDT);
          expect(actualAmountOut[0]).to.equal(0);

          // Calculation for Token out.
          const alpacaPrice = await priceOracle.getPrice(ALPACA);
          const usdtPrice = await priceOracle.getPrice(USDT);
          const incentivePlusMantissa = parseUnits("1.02", 18);
          const tokenInToOutConversion = alpacaPrice.mul(incentivePlusMantissa).div(usdtPrice);
          let amountOut = amountIn.mul(tokenInToOutConversion).div(parseUnits("1", 18));
          amountOut = amountIn.mul(tokenInToOutConversion).div(parseUnits("1", 18));

          await usdtToken.allocateTo(RISK_FUND_TRANSFORMER, parseUnits("1", 6));
          await riskFundTransformer.updateAssetsState(COMPTROLLER_ALPACA_USDT, USDT);

          actualAmountOut = await riskFundTransformer.callStatic.getAmountOut(amountIn, ALPACA, USDT);
          expect(actualAmountOut[1]).to.equal(amountOut);
        });
      });

      describe("transformExactTokens()", () => {
        it("should revert when token transformtion is paused", async () => {
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_TRANSFORMER, "pauseTransformation()", signer);

          await riskFundTransformer.pauseTransformation();
          await expect(
            riskFundTransformer.transformExactTokens(amountIn, parseUnits("1", 5), ALPACA, USDT, signer),
          ).to.be.revertedWithCustomError(riskFundTransformer, "TransformationTokensPaused");
        });

        it("should revert when amoutOut desired is high", async () => {
          await accessController
            .connect(timeLockSigner)
            .giveCallPermission(RISK_FUND_TRANSFORMER, "resumeTransformation()", signer);
          await riskFundTransformer.resumeTransformation();

          await expect(
            riskFundTransformer.transformExactTokens(amountIn, parseUnits("5", 6), ALPACA, USDT, signer),
          ).to.be.revertedWithCustomError(riskFundTransformer, "AmountOutLowerThanMinRequired");
        });

        it("token transformation should execute succesfully", async () => {
          await alpacaToken.faucet(parseUnits("6", 18));

          // Transfering some asset to RISK_FUND_TRANSFORMER.
          await alpacaToken.transfer(RISK_FUND_TRANSFORMER, parseUnits("5", 18));

          await riskFundTransformer.updateAssetsState(COMPTROLLER_ALPACA_USDT, USDT);
          await riskFundTransformer.updateAssetsState(COMPTROLLER_ALPACA_USDT, ALPACA);

          await alpacaToken.approve(RISK_FUND_TRANSFORMER, parseUnits("1", 18));

          const actualAmountOut = await riskFundTransformer.callStatic.getAmountOut(amountIn, ALPACA, USDT);

          const signerPreviousBalance = await usdtToken.balanceOf(signer);

          const tx = await riskFundTransformer.transformExactTokens(amountIn, parseUnits("1", 5), ALPACA, USDT, signer);
          await tx.wait();

          await expect(tx).emit(riskFundTransformer, "TransformExactTokens").withArgs(amountIn, actualAmountOut[1]);

          const signerAfterBalance = await usdtToken.balanceOf(signer);

          expect(signerAfterBalance.sub(signerPreviousBalance)).to.equal(actualAmountOut[1]);
        });
      });

      describe("getAmountIn()", () => {
        it("should revert when amount out expected is 0", async () => {
          amountOutExpected = parseUnits("0", 0);
          await expect(riskFundTransformer.getAmountIn(amountOutExpected, ALPACA, USDT)).to.be.revertedWithCustomError(
            riskFundTransformer,
            "InsufficientInputAmount",
          );
        });

        it("should revert when token config is not set or enabled", async () => {
          amountOutExpected = parseUnits("1", 6);
          transformerTokenData = {
            tokenAddressIn: ALPACA,
            tokenAddressOut: USDT,
            incentive: INCENTIVE,
            enabled: false,
          };
          await riskFundTransformer.setTransformationConfig(transformerTokenData);
          await expect(riskFundTransformer.getAmountIn(amountOutExpected, ALPACA, USDT)).to.be.revertedWithCustomError(
            riskFundTransformer,
            "TransformationConfigNotEnabled",
          );
        });

        it("getAmountIn should execute successfully", async () => {
          transformerTokenData = {
            tokenAddressIn: ALPACA,
            tokenAddressOut: USDT,
            incentive: INCENTIVE,
            enabled: true,
          };

          await riskFundTransformer.setTransformationConfig(transformerTokenData);

          // Minting some more USDT to Transformer Address.
          await usdtToken.allocateTo(RISK_FUND_TRANSFORMER, parseUnits("1", 6));
          // Updating riskFundTransformer state.
          await riskFundTransformer.updateAssetsState(COMPTROLLER_ALPACA_USDT, USDT);

          // Calculation for Token In.
          const alpacaPrice = await priceOracle.getPrice(ALPACA);
          const usdtPrice = await priceOracle.getPrice(USDT);
          const incentivePlusMantissa = parseUnits("1.02", 18);
          const tokenInToOutConversion = alpacaPrice.mul(incentivePlusMantissa).div(usdtPrice);
          const amountInToTake = amountOutExpected.mul(parseUnits("1", 18)).div(tokenInToOutConversion);

          const actualAmounts = await riskFundTransformer.callStatic.getAmountIn(amountOutExpected, ALPACA, USDT);
          expect(actualAmounts[1]).to.equal(amountInToTake);
        });
      });

      describe("transformForExactTokens", () => {
        it("should revert when transformtion is paused", async () => {
          await riskFundTransformer.pauseTransformation();
          await expect(
            riskFundTransformer.transformForExactTokens(parseUnits("10", 18), amountOutExpected, ALPACA, USDT, signer),
          ).to.be.revertedWithCustomError(riskFundTransformer, "TransformationTokensPaused");
        });

        it("should revert when amoutOut desired is high", async () => {
          await riskFundTransformer.resumeTransformation();
          amountOutExpected = parseUnits("1", 6);
          await expect(
            riskFundTransformer.transformForExactTokens(parseUnits("1", 18), amountOutExpected, ALPACA, USDT, signer),
          ).to.be.revertedWithCustomError(riskFundTransformer, "AmountInHigherThanMax");
        });

        it("token transformation should execute succesfully", async () => {
          await alpacaToken.faucet(parseUnits("6", 18));

          await alpacaToken.approve(RISK_FUND_TRANSFORMER, parseUnits("5", 18));
          amountOutExpected = parseUnits("1", 6);

          const actualAmounts = await riskFundTransformer.callStatic.getAmountIn(amountOutExpected, ALPACA, USDT);
          const signerPreviousBalance = await alpacaToken.balanceOf(signer);

          const tx = await riskFundTransformer.transformForExactTokens(
            parseUnits("5", 18),
            amountOutExpected,
            ALPACA,
            USDT,
            signer,
          );
          await tx.wait();

          await expect(tx)
            .emit(riskFundTransformer, "TransformForExactTokens")
            .withArgs(actualAmounts[1], actualAmounts[0]);

          const signerAfterBalance = await alpacaToken.balanceOf(signer);

          expect(signerPreviousBalance.sub(signerAfterBalance)).to.equal(actualAmounts[1]);
        });
      });

      //TODO: Need to write test cases for supporting fee methods once protocol share reserve V1 deployed to mainnet
    });

  }
});
