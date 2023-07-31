import chai from "chai";
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
  describe(`RiskFundTransformer #${blockNumber}`, () => {
    before(async () => {
      await setForkBlock(blockNumber);
    });
    fn();
  });
};

const NORMAL_TIMELOCK = "0xce10739590001705f7ff231611ba4a48b2820327";
const USDT = "0xa11c8d9dc9b66e209ef60f0c8d969d3cd988782c";
const ALPACA = "0x6923189d91fdf62dbae623a55273f1d20306d9f2";
const RiskFundTransformerProxyAddress = "0x8CC7ecFa3AF1D78dD2ceE2239E2b58aA206f8952";
const Comptroller_ALPACA_USDT = "0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD";
const ACMAddress = "0x45f8a08F534f34A97187626E05d4b6648Eeaa9AA";
const PriceOracleAddress = "0x3cD69251D04A28d887Ac14cbe2E14c52F3D57823";
const incentive = parseUnits("0.02", 18);

async function impersonateAccount(accountAddress) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [accountAddress],
  });
}

async function getMockTokenContract(tokenAddress) {
  const token = await hre.ethers.getContractAt("MockToken", tokenAddress);
  return token;
}

forking(32038478, () => {
  let RiskFundTransformer: ethers.Contract;
  let AccessController: ethers.Contract;
  let PriceOracle: ethers.Contract;

  if (process.env.FORK_TESTNET === "true") {
    describe("RiskFundTransformer", () => {
      beforeEach(async () => {
        RiskFundTransformer = await hre.ethers.getContractAt("RiskFundTransformer", RiskFundTransformerProxyAddress);
        AccessController = await hre.ethers.getContractAt("MockACM", ACMAddress);
        PriceOracle = await hre.ethers.getContractAt("ResilientOracle", PriceOracleAddress);
      });

      it("should set tokens configurations", async () => {
        const timeLockSigner = await initMainnetUser(NORMAL_TIMELOCK);
        const signers = await ethers.getSigners();
        const Signer = await signers[0].getAddress();

        await AccessController.connect(timeLockSigner).giveCallPermission(
          RiskFundTransformerProxyAddress,
          "setTransformationConfig(TransformationConfig)",
          Signer,
        );

        const transformerTokenData = {
          tokenAddressIn: ALPACA,
          tokenAddressOut: USDT,
          incentive: incentive,
          enabled: true,
        };
        // Setting token Config for Transformer.
        await RiskFundTransformer.setTransformationConfig(transformerTokenData);

        const AlpacaToken = await getMockTokenContract(ALPACA);
        const USDTToken = await getMockTokenContract(USDT);

        // Minting Faucet to Signer and RiskFundTransformerProxyAddress.
        await USDTToken.allocateTo(RiskFundTransformerProxyAddress, 1e6);
        await AlpacaToken.faucet(parseUnits("6", 18));

        // Transfering some asset to RiskFundTransformerProxyAddress.
        await AlpacaToken.transfer(RiskFundTransformerProxyAddress, parseUnits("5", 18));

        await RiskFundTransformer.updateAssetsState(Comptroller_ALPACA_USDT, USDT);
        await RiskFundTransformer.updateAssetsState(Comptroller_ALPACA_USDT, ALPACA);

        await AlpacaToken.approve(RiskFundTransformerProxyAddress, parseUnits("1", 18));

        const amountIn = parseUnits("1", 18);

        // Calculation for Token out.
        const alpacaPrice = await PriceOracle.getPrice(ALPACA);
        const usdtPrice = await PriceOracle.getPrice(USDT);
        const incentivePlusMantissa = parseUnits("1.02", 18);
        const tokenInToOutConversion = alpacaPrice.mul(incentivePlusMantissa).div(usdtPrice);
        const amountOut = amountIn.mul(tokenInToOutConversion).div(parseUnits("1", 18));

        // revert on wrong expected amountOutValue
        await expect(
          RiskFundTransformer.transformExactTokens(amountIn, parseUnits("5", 6), ALPACA, USDT, Signer),
        ).to.be.revertedWithCustomError(RiskFundTransformer, "AmountOutLowerThanMinRequired");

        const signerPreviousBalance = await USDTToken.balanceOf(Signer);
        await RiskFundTransformer.transformExactTokens(amountIn, parseUnits("1", 5), ALPACA, USDT, Signer);
        const signerAfterBalance = await USDTToken.balanceOf(Signer);
        expect(signerAfterBalance - signerPreviousBalance).to.equal(amountOut);
      });
    });
  }
});
