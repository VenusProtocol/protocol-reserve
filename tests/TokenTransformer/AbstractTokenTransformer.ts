import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "bignumber.js";
import chai from "chai";
import { Signer } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import {
  IAccessControlManagerV8,
  MockDeflatingToken,
  MockDeflatingToken__factory,
  MockToken,
  MockToken__factory,
  MockTransformer,
  MockTransformer__factory,
  ResilientOracle,
} from "../../typechain";
import { convertToUnit } from "../utils";

const { expect } = chai;
chai.use(smock.matchers);

let accessControl: FakeContract<IAccessControlManagerV8>;
let transformer: MockContract<MockTransformer>;
let tokenIn: MockContract<MockToken>;
let tokenOut: MockContract<MockToken>;
let oracle: FakeContract<ResilientOracle>;
let tokenInDeflationary: MockContract<MockDeflatingToken>;
let to: Signer;
let destination: Signer;
let owner: Signer;
let TransformationConfig: {
  tokenAddressIn: string;
  tokenAddressOut: string;
  incentive: string;
  enabled: boolean;
};

const INCENTIVE = convertToUnit("1", 17);
const TOKEN_OUT_MAX = convertToUnit("1.5", 18);
const TOKEN_IN_PRICE = convertToUnit("1", 18);
const TOKEN_OUT_PRICE = convertToUnit("0.5", 18);
const MANTISSA_ONE = convertToUnit("1", 18);

async function fixture(): Promise<void> {
  [owner, destination, to] = await ethers.getSigners();
  const Transformer = await smock.mock<MockTransformer__factory>("MockTransformer");

  accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  oracle = await smock.fake<ResilientOracle>("ResilientOracle");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  const MockTokenDeflationary = await smock.mock<MockDeflatingToken__factory>("MockDeflatingToken");
  tokenIn = await MockToken.deploy("TokenIn", "tokenIn", 18);
  await tokenIn.faucet(parseUnits("1000", 18));

  tokenInDeflationary = await MockTokenDeflationary.deploy(parseUnits("1000", 18));

  tokenOut = await MockToken.deploy("TokenOut", "tokenOut", 18);
  await tokenOut.faucet(parseUnits("1000", 18));

  transformer = await Transformer.deploy();
  await transformer.AbstractTokenTransformer_init(
    accessControl.address,
    oracle.address,
    await destination.getAddress(),
  );
  accessControl.isAllowedToCall.returns(true);

  TransformationConfig = {
    tokenAddressIn: tokenIn.address,
    tokenAddressOut: tokenOut.address,
    incentive: INCENTIVE,
    enabled: true,
  };
}

describe("MockTransformer: tests", () => {
  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe("Transform tokens for exact tokens", async () => {
    beforeEach(async () => {
      await tokenInDeflationary.connect(owner).approve(transformer.address, convertToUnit("1", 18));
      await tokenIn.connect(owner).approve(transformer.address, convertToUnit("1", 18));
      await tokenOut.transfer(transformer.address, convertToUnit("1.5", 18));

      await oracle.getPrice.whenCalledWith(tokenInDeflationary.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
    });

    it("Success on transform exact tokens", async () => {
      const MAX_AMOUNT_IN = convertToUnit(".25", 18);
      const AMOUNT_OUT = convertToUnit(".5", 18);
      await transformer.setTransformationConfig(TransformationConfig);
      const expectedResults = await transformer.callStatic.getAmountIn(AMOUNT_OUT, tokenIn.address, tokenOut.address);

      const tx = await transformer.transformForExactTokens(
        MAX_AMOUNT_IN,
        AMOUNT_OUT,
        tokenIn.address,
        tokenOut.address,
        await to.getAddress(),
      );

      await tx.wait();

      await expect(tx).to.emit(transformer, "TransformForExactTokens").withArgs(expectedResults[1], expectedResults[0]);
    });

    it("Revert on lower amount out than expected", async () => {
      await transformer.setTransformationConfig(TransformationConfig);
      await expect(
        transformer.transformForExactTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(transformer, "AmountInHigherThanMax");
    });

    it("Revert on deflationary token transfer", async () => {
      const TransformationConfig = {
        tokenAddressIn: tokenInDeflationary.address,
        tokenAddressOut: tokenOut.address,
        incentive: INCENTIVE,
        enabled: true,
      };

      await transformer.setTransformationConfig(TransformationConfig);

      await expect(
        transformer.transformForExactTokens(
          convertToUnit(".25", 18),
          convertToUnit(".5", 18),
          tokenInDeflationary.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(transformer, "AmountInOrAmountOutMismatched");
    });
  });

  describe("Transform exact tokens for tokens", async () => {
    beforeEach(async () => {
      await tokenInDeflationary.connect(owner).approve(transformer.address, convertToUnit("1", 18));
      await tokenIn.connect(owner).approve(transformer.address, convertToUnit("1", 18));
      await tokenOut.transfer(transformer.address, convertToUnit("1.5", 18));

      await oracle.getPrice.whenCalledWith(tokenInDeflationary.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
    });

    it("Success on transform exact tokens", async () => {
      const AMOUNT_IN = convertToUnit(".25", 18);
      const MIN_AMOUNT_OUT = convertToUnit(".5", 18);
      await transformer.setTransformationConfig(TransformationConfig);

      const expectedResults = await transformer.callStatic.getAmountOut(AMOUNT_IN, tokenIn.address, tokenOut.address);

      const tx = await transformer.transformExactTokens(
        AMOUNT_IN,
        MIN_AMOUNT_OUT,
        tokenIn.address,
        tokenOut.address,
        await to.getAddress(),
      );

      await tx.wait();

      await expect(tx).to.emit(transformer, "TransformExactTokens").withArgs(expectedResults[0], expectedResults[1]);
    });

    it("Revert on lower amount out than expected", async () => {
      await transformer.setTransformationConfig(TransformationConfig);
      await expect(
        transformer.transformExactTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(transformer, "AmountOutLowerThanMinRequired");
    });

    it("Revert on deflationary token transfer", async () => {
      const TransformationConfig = {
        tokenAddressIn: tokenInDeflationary.address,
        tokenAddressOut: tokenOut.address,
        incentive: INCENTIVE,
        enabled: true,
      };

      await transformer.setTransformationConfig(TransformationConfig);

      await expect(
        transformer.transformExactTokens(
          convertToUnit(".25", 18),
          convertToUnit(".5", 18),
          tokenInDeflationary.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(transformer, "AmountInOrAmountOutMismatched");
    });
  });

  describe("Transform exact tokens for tokens with supporting fee", async () => {
    beforeEach(async () => {
      await tokenInDeflationary.connect(owner).approve(transformer.address, convertToUnit("1", 18));
      await tokenIn.connect(owner).approve(transformer.address, convertToUnit("1", 18));
      await tokenOut.transfer(transformer.address, convertToUnit("1.5", 18));

      await oracle.getPrice.whenCalledWith(tokenInDeflationary.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
    });

    it("Revert on lower amount out than expected", async () => {
      await transformer.setTransformationConfig(TransformationConfig);
      await expect(
        transformer.transformExactTokensSupportingFeeOnTransferTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(transformer, "AmountOutLowerThanMinRequired");
    });

    it("Success on transform exact tokens with supporting fee", async () => {
      const TransformationConfig = {
        tokenAddressIn: tokenInDeflationary.address,
        tokenAddressOut: tokenOut.address,
        incentive: INCENTIVE,
        enabled: true,
      };

      await transformer.setTransformationConfig(TransformationConfig);

      // Calculation for token transfer to transformer after fees deduction.
      const amountDeductedInTransfer = parseUnits(".25", 18).div(100);
      const amountTransferredAfterFees = parseUnits(".25", 18).sub(amountDeductedInTransfer);

      const expectedResults = await transformer.callStatic.getAmountOut(
        convertToUnit(".25", 18),
        tokenInDeflationary.address,
        tokenOut.address,
      );

      await expect(
        transformer.transformExactTokensSupportingFeeOnTransferTokens(
          convertToUnit(".25", 18),
          convertToUnit(".5", 18),
          tokenInDeflationary.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      )
        .to.emit(transformer, "TransformExactTokensSupportingFeeOnTransferTokens")
        .withArgs(amountTransferredAfterFees, expectedResults[1]);
    });
  });

  describe("Transform tokens for exact tokens with supporting fee", async () => {
    beforeEach(async () => {
      await tokenInDeflationary.connect(owner).approve(transformer.address, convertToUnit("1", 18));
      await tokenIn.connect(owner).approve(transformer.address, convertToUnit("1", 18));
      await tokenOut.transfer(transformer.address, convertToUnit("1.5", 18));

      await oracle.getPrice.whenCalledWith(tokenInDeflationary.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
    });

    it("Revert on lower amount out than expected", async () => {
      await transformer.setTransformationConfig(TransformationConfig);
      await expect(
        transformer.transformForExactTokensSupportingFeeOnTransferTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(transformer, "AmountInHigherThanMax");
    });

    it("Success on transform exact tokens with supporting fee", async () => {
      const TransformationConfig = {
        tokenAddressIn: tokenInDeflationary.address,
        tokenAddressOut: tokenOut.address,
        incentive: INCENTIVE,
        enabled: true,
      };

      await transformer.setTransformationConfig(TransformationConfig);

      const expectedResults = await transformer.callStatic.getAmountIn(
        convertToUnit(".5", 18),
        tokenInDeflationary.address,
        tokenOut.address,
      );
      // Calculation for Token Transferred to transformer.
      const amountTransferredAfterFees = expectedResults[1].sub(expectedResults[1].div(100));

      await expect(
        transformer.transformForExactTokensSupportingFeeOnTransferTokens(
          convertToUnit(".25", 18),
          convertToUnit(".5", 18),
          tokenInDeflationary.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      )
        .to.emit(transformer, "TransformForExactTokensSupportingFeeOnTransferTokens")
        .withArgs(amountTransferredAfterFees, expectedResults[0]);
    });
  });

  describe("Set transform configurations", () => {
    beforeEach(async () => {
      accessControl.isAllowedToCall.returns(true);
    });

    it("Revert on not access to set transform configurations", async () => {
      accessControl.isAllowedToCall.reset;
      accessControl.isAllowedToCall.returns(false);

      await expect(transformer.setTransformationConfig(TransformationConfig)).to.be.revertedWithCustomError(
        transformer,
        "Unauthorized",
      );
    });

    it("Revert on invalid tokenIn address", async () => {
      const TransformerConfig = {
        ...TransformationConfig,
        tokenAddressIn: ethers.constants.AddressZero,
      };

      await expect(transformer.setTransformationConfig(TransformerConfig)).to.be.revertedWithCustomError(
        transformer,
        "ZeroAddressNotAllowed",
      );
    });

    it("Revert on invalid tokenOut address", async () => {
      const TransformerConfig = {
        ...TransformationConfig,
        tokenAddressOut: ethers.constants.AddressZero,
      };

      await expect(transformer.setTransformationConfig(TransformerConfig)).to.be.revertedWithCustomError(
        transformer,
        "ZeroAddressNotAllowed",
      );
    });

    it("Revert on high incentive percentage", async () => {
      const TransformerConfig = {
        ...TransformationConfig,
        incentive: convertToUnit("6", 18), // more than MAX_INCENTIVE = 5e18
      };

      await expect(transformer.setTransformationConfig(TransformerConfig)).to.be.revertedWithCustomError(
        transformer,
        "IncentiveTooHigh",
      );
    });

    it("Set transform config for first time", async () => {
      let isExist = await transformer.transformConfigurations(tokenIn.address, tokenOut.address);

      expect(isExist[0]).to.equal(ethers.constants.AddressZero);
      expect(isExist[1]).to.equal(ethers.constants.AddressZero);
      expect(isExist[2]).to.equal(0);
      expect(isExist[3]).to.equal(false);

      await expect(transformer.setTransformationConfig(TransformationConfig))
        .to.emit(transformer, "TransformationConfigUpdated")
        .withArgs(tokenIn.address, tokenOut.address, 0, INCENTIVE, false, true);

      isExist = await transformer.transformConfigurations(tokenIn.address, tokenOut.address);

      expect(isExist[0]).to.equal(tokenIn.address);
      expect(isExist[1]).to.equal(tokenOut.address);
      expect(isExist[2]).to.equal(INCENTIVE);
      expect(isExist[3]).to.equal(true);
    });

    it("Update the incentive", async () => {
      const NEW_INCENTIVE = convertToUnit("2", 17);

      await transformer.setTransformationConfig(TransformationConfig);

      const TransformerConfig = {
        ...TransformationConfig,
        incentive: NEW_INCENTIVE,
      };

      await expect(transformer.setTransformationConfig(TransformerConfig))
        .to.emit(transformer, "TransformationConfigUpdated")
        .withArgs(tokenIn.address, tokenOut.address, INCENTIVE, NEW_INCENTIVE, true, true);

      const isExist = await transformer.transformConfigurations(tokenIn.address, tokenOut.address);
      expect(isExist[2]).to.equal(NEW_INCENTIVE);
    });
  });

  describe("Get amount out", () => {
    const AMOUNT_IN_UNDER = convertToUnit("5", 17);
    const AMOUNT_IN_OVER = convertToUnit("1", 18);

    beforeEach(async () => {
      await tokenIn.connect(owner).approve(transformer.address, convertToUnit("1", 18));
      await tokenOut.transfer(transformer.address, convertToUnit("1.5", 18));
    });

    const setTransformationConfig = async () => {
      await transformer.setTransformationConfig(TransformationConfig);
      await tokenOut.balanceOf.returns(TOKEN_OUT_MAX);
    };

    it("Revert on zero amountIn value", async () => {
      await expect(transformer.getAmountOut(0, tokenIn.address, tokenOut.address)).to.be.revertedWithCustomError(
        transformer,
        "InsufficientInputAmount",
      );
    });

    it("Revert on no config or disabled transform for tokens pair", async () => {
      await expect(
        transformer.getAmountOut(TOKEN_OUT_MAX, tokenIn.address, tokenOut.address),
      ).to.be.revertedWithCustomError(transformer, "TransformationConfigNotEnabled");
    });

    it("Success on transforming tokenIn to tokenOut for under tokenOut liquidity", async () => {
      await setTransformationConfig();
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
      const results = await transformer.callStatic.getAmountOut(AMOUNT_IN_UNDER, tokenIn.address, tokenOut.address);
      const conversionRatio = new BigNumber(TOKEN_IN_PRICE).dividedBy(TOKEN_OUT_PRICE);
      const conversionWithIncentive = Number(MANTISSA_ONE) + Number(INCENTIVE);
      const amountOut = new BigNumber(AMOUNT_IN_UNDER)
        .multipliedBy(conversionRatio)
        .multipliedBy(conversionWithIncentive)
        .dividedBy(MANTISSA_ONE)
        .toFixed(0);

      expect(results[0]).to.equal(AMOUNT_IN_UNDER);
      expect(results[1]).to.equal(amountOut);
    });

    it("Success on transforming tokenIn to tokenOut for over tokenOut liquidity", async () => {
      await setTransformationConfig();
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
      const results = await transformer.callStatic.getAmountOut(AMOUNT_IN_OVER, tokenIn.address, tokenOut.address);
      const conversionWithIncentive = Number(MANTISSA_ONE) + Number(INCENTIVE);
      const conversionRatio = new BigNumber(TOKEN_IN_PRICE).dividedBy(TOKEN_OUT_PRICE);
      const amountIn = new BigNumber(TOKEN_OUT_MAX)
        .multipliedBy(MANTISSA_ONE)
        .dividedBy(conversionRatio)
        .dividedBy(conversionWithIncentive)
        .toFixed(0);

      expect(results[0]).to.equal(amountIn);
      expect(results[1]).to.equal(TOKEN_OUT_MAX);
    });
  });

  describe("Get amount in", () => {
    const AMOUNT_IN_UNDER = convertToUnit("1", 18);
    const AMOUNT_IN_OVER = convertToUnit("2", 18);

    beforeEach(async () => {
      await tokenIn.connect(owner).approve(transformer.address, convertToUnit("1", 18));
      await tokenOut.transfer(transformer.address, convertToUnit("1.5", 18));
    });

    const setTransformationConfig = async () => {
      await transformer.setTransformationConfig(TransformationConfig);
      await tokenOut.balanceOf.returns(TOKEN_OUT_MAX);
    };

    it("Revert on zero amountIn value", async () => {
      await expect(transformer.getAmountIn(0, tokenIn.address, tokenOut.address)).to.be.revertedWithCustomError(
        transformer,
        "InsufficientInputAmount",
      );
    });

    it("Revert on no config or disabled transform for tokens pair", async () => {
      await expect(
        transformer.getAmountIn(AMOUNT_IN_UNDER, tokenIn.address, tokenOut.address),
      ).to.be.revertedWithCustomError(transformer, "TransformationConfigNotEnabled");
    });

    it("Success on transforming tokenIn to tokenOut for under tokenOut liquidity", async () => {
      await setTransformationConfig();
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
      const results = await transformer.callStatic.getAmountIn(AMOUNT_IN_UNDER, tokenIn.address, tokenOut.address);
      const conversionRatio = new BigNumber(TOKEN_IN_PRICE).dividedBy(TOKEN_OUT_PRICE);
      const conversionWithIncentive = Number(MANTISSA_ONE) + Number(INCENTIVE);
      const amountIn = new BigNumber(AMOUNT_IN_UNDER)
        .multipliedBy(MANTISSA_ONE)
        .dividedBy(conversionRatio)
        .dividedBy(conversionWithIncentive)
        .toFixed(0);

      expect(results[0]).to.equal(AMOUNT_IN_UNDER);
      expect(results[1]).to.equal(amountIn);
    });

    it("Success on transforming tokenIn to tokenOut for over tokenOut liquidity", async () => {
      await setTransformationConfig();
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
      const results = await transformer.callStatic.getAmountIn(AMOUNT_IN_OVER, tokenIn.address, tokenOut.address);
      const conversionWithIncentive = Number(MANTISSA_ONE) + Number(INCENTIVE);
      const conversionRatio = new BigNumber(TOKEN_IN_PRICE).dividedBy(TOKEN_OUT_PRICE);
      const amountIn = new BigNumber(TOKEN_OUT_MAX)
        .multipliedBy(MANTISSA_ONE)
        .dividedBy(conversionRatio)
        .dividedBy(conversionWithIncentive)
        .toFixed(0);

      expect(results[0]).to.equal(TOKEN_OUT_MAX);
      expect(results[1]).to.equal(amountIn);
    });
  });

  describe("Set price oracle", () => {
    let newOracle: FakeContract<ResilientOracle>;

    before(async () => {
      newOracle = await smock.fake<ResilientOracle>("ResilientOracle");
    });

    it("Revert on non-owner call", async () => {
      const [, nonOwner] = await ethers.getSigners();

      await expect(transformer.connect(nonOwner).setPriceOracle(newOracle.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Revert on invalid oracle address", async () => {
      await expect(transformer.setPriceOracle(ethers.constants.AddressZero)).to.be.revertedWithCustomError(
        transformer,
        "ZeroAddressNotAllowed",
      );
    });

    it("Success on new price oracle update", async () => {
      await expect(transformer.setPriceOracle(newOracle.address))
        .to.emit(transformer, "PriceOracleUpdated")
        .withArgs(oracle.address, newOracle.address);
    });
  });

  describe("Pause/Resume functionality", () => {
    beforeEach(async () => {
      accessControl.isAllowedToCall.reset;
      accessControl.isAllowedToCall.returns(true);
    });

    it("Revert on pauseTransformation for non owner call", async () => {
      accessControl.isAllowedToCall.reset;
      accessControl.isAllowedToCall.returns(false);

      await expect(transformer.connect(to).pauseTransformation()).to.be.revertedWithCustomError(
        transformer,
        "Unauthorized",
      );
    });

    it("Success on pauseTransformation", async () => {
      await expect(transformer.pauseTransformation()).to.emit(transformer, "TransformationPaused");
    });

    it("Revert on when transform is already paused", async () => {
      await transformer.pauseTransformation();
      await expect(transformer.pauseTransformation()).to.be.revertedWithCustomError(
        transformer,
        "TransformationTokensPaused",
      );
    });

    it("Transform methods should revert on transform pause", async () => {
      const Value_1 = convertToUnit(".25", 18);
      const VALUE_2 = convertToUnit(".5", 18);
      await transformer.pauseTransformation();

      await expect(
        transformer.transformExactTokens(Value_1, VALUE_2, tokenIn.address, tokenOut.address, await to.getAddress()),
      ).to.be.revertedWithCustomError(transformer, "TransformationTokensPaused");

      await expect(
        transformer.transformForExactTokens(Value_1, VALUE_2, tokenIn.address, tokenOut.address, await to.getAddress()),
      ).to.be.revertedWithCustomError(transformer, "TransformationTokensPaused");

      await expect(
        transformer.transformExactTokensSupportingFeeOnTransferTokens(
          Value_1,
          VALUE_2,
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(transformer, "TransformationTokensPaused");

      await expect(
        transformer.transformForExactTokensSupportingFeeOnTransferTokens(
          Value_1,
          VALUE_2,
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(transformer, "TransformationTokensPaused");
    });

    it("Revert on resumeTransformation for non owner call", async () => {
      accessControl.isAllowedToCall.reset;
      accessControl.isAllowedToCall.returns(false);

      await expect(transformer.connect(to).resumeTransformation()).to.be.revertedWithCustomError(
        transformer,
        "Unauthorized",
      );
    });

    it("Success on resumeTransformation", async () => {
      await transformer.pauseTransformation();
      await expect(transformer.resumeTransformation()).to.emit(transformer, "TransformationResumed");
    });

    it("Revert on when transform is already active", async () => {
      await expect(transformer.resumeTransformation()).to.be.revertedWithCustomError(
        transformer,
        "TransformationTokensActive",
      );
    });
  });

  describe("SweepTokens abstract transformer", () => {
    it("Transfer sweep tokens", async () => {
      expect(await tokenIn.balanceOf(transformer.address)).to.equals(0);
      await expect(tokenIn.transfer(transformer.address, 1000)).to.changeTokenBalances(
        tokenIn,
        [await owner.getAddress(), transformer.address],
        [-1000, 1000],
      );
      await expect(transformer.sweepToken(tokenIn.address, await owner.getAddress(), 1000)).to.changeTokenBalances(
        tokenIn,
        [await owner.getAddress(), transformer.address],
        [1000, -1000],
      );
    });
  });
});
