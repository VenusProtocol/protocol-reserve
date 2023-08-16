import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "bignumber.js";
import chai from "chai";
import { Signer } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import {
  IAccessControlManagerV8,
  MockConverter,
  MockConverter__factory,
  MockDeflatingToken,
  MockDeflatingToken__factory,
  MockToken,
  MockToken__factory,
  ResilientOracle,
} from "../../typechain";
import { convertToUnit } from "../utils";

const { expect } = chai;
chai.use(smock.matchers);

let accessControl: FakeContract<IAccessControlManagerV8>;
let converter: MockContract<MockConverter>;
let tokenIn: MockContract<MockToken>;
let tokenOut: MockContract<MockToken>;
let oracle: FakeContract<ResilientOracle>;
let tokenInDeflationary: MockContract<MockDeflatingToken>;
let to: Signer;
let destination: Signer;
let owner: Signer;
let ConversionConfig: {
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
  const Converter = await smock.mock<MockConverter__factory>("MockConverter");

  accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  oracle = await smock.fake<ResilientOracle>("ResilientOracle");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  const MockTokenDeflationary = await smock.mock<MockDeflatingToken__factory>("MockDeflatingToken");
  tokenIn = await MockToken.deploy("TokenIn", "tokenIn", 18);
  await tokenIn.faucet(parseUnits("1000", 18));

  tokenInDeflationary = await MockTokenDeflationary.deploy(parseUnits("1000", 18));

  tokenOut = await MockToken.deploy("TokenOut", "tokenOut", 18);
  await tokenOut.faucet(parseUnits("1000", 18));

  converter = await Converter.deploy();
  await converter.AbstractTokenConverter_init(accessControl.address, oracle.address, await destination.getAddress());
  accessControl.isAllowedToCall.returns(true);

  ConversionConfig = {
    tokenAddressIn: tokenIn.address,
    tokenAddressOut: tokenOut.address,
    incentive: INCENTIVE,
    enabled: true,
  };
}

describe("MockConverter: tests", () => {
  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe("Convert tokens for exact tokens", async () => {
    beforeEach(async () => {
      await tokenInDeflationary.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenIn.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenOut.transfer(converter.address, convertToUnit("1.5", 18));

      await oracle.getPrice.whenCalledWith(tokenInDeflationary.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
    });

    it("Success on convert exact tokens", async () => {
      const MAX_AMOUNT_IN = convertToUnit(".25", 18);
      const AMOUNT_OUT = convertToUnit(".5", 18);
      await converter.setConversionConfig(ConversionConfig);
      const expectedResults = await converter.callStatic.getAmountIn(AMOUNT_OUT, tokenIn.address, tokenOut.address);

      const tx = await converter.convertForExactTokens(
        MAX_AMOUNT_IN,
        AMOUNT_OUT,
        tokenIn.address,
        tokenOut.address,
        await to.getAddress(),
      );

      await tx.wait();

      await expect(tx).to.emit(converter, "ConvertForExactTokens").withArgs(expectedResults[1], expectedResults[0]);
    });

    it("Revert on lower amount out than expected", async () => {
      await converter.setConversionConfig(ConversionConfig);
      await expect(
        converter.convertForExactTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "AmountInHigherThanMax");
    });

    it("Revert on deflationary token transfer", async () => {
      const ConversionConfig = {
        tokenAddressIn: tokenInDeflationary.address,
        tokenAddressOut: tokenOut.address,
        incentive: INCENTIVE,
        enabled: true,
      };

      await converter.setConversionConfig(ConversionConfig);

      await expect(
        converter.convertForExactTokens(
          convertToUnit(".25", 18),
          convertToUnit(".5", 18),
          tokenInDeflationary.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "AmountInOrAmountOutMismatched");
    });
  });

  describe("Convert exact tokens for tokens", async () => {
    beforeEach(async () => {
      await tokenInDeflationary.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenIn.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenOut.transfer(converter.address, convertToUnit("1.5", 18));

      await oracle.getPrice.whenCalledWith(tokenInDeflationary.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
    });

    it("Success on convert exact tokens", async () => {
      const AMOUNT_IN = convertToUnit(".25", 18);
      const MIN_AMOUNT_OUT = convertToUnit(".5", 18);
      await converter.setConversionConfig(ConversionConfig);

      const expectedResults = await converter.callStatic.getAmountOut(AMOUNT_IN, tokenIn.address, tokenOut.address);

      const tx = await converter.convertExactTokens(
        AMOUNT_IN,
        MIN_AMOUNT_OUT,
        tokenIn.address,
        tokenOut.address,
        await to.getAddress(),
      );

      await tx.wait();

      await expect(tx).to.emit(converter, "ConvertExactTokens").withArgs(expectedResults[0], expectedResults[1]);
    });

    it("Revert on lower amount out than expected", async () => {
      await converter.setConversionConfig(ConversionConfig);
      await expect(
        converter.convertExactTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "AmountOutLowerThanMinRequired");
    });

    it("Revert on deflationary token transfer", async () => {
      const ConversionConfig = {
        tokenAddressIn: tokenInDeflationary.address,
        tokenAddressOut: tokenOut.address,
        incentive: INCENTIVE,
        enabled: true,
      };

      await converter.setConversionConfig(ConversionConfig);

      await expect(
        converter.convertExactTokens(
          convertToUnit(".25", 18),
          convertToUnit(".5", 18),
          tokenInDeflationary.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "AmountInOrAmountOutMismatched");
    });
  });

  describe("Convert exact tokens for tokens with supporting fee", async () => {
    beforeEach(async () => {
      await tokenInDeflationary.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenIn.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenOut.transfer(converter.address, convertToUnit("1.5", 18));

      await oracle.getPrice.whenCalledWith(tokenInDeflationary.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
    });

    it("Revert on lower amount out than expected", async () => {
      await converter.setConversionConfig(ConversionConfig);
      await expect(
        converter.convertExactTokensSupportingFeeOnTransferTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "AmountOutLowerThanMinRequired");
    });

    it("Success on convert exact tokens with supporting fee", async () => {
      const ConversionConfig = {
        tokenAddressIn: tokenInDeflationary.address,
        tokenAddressOut: tokenOut.address,
        incentive: INCENTIVE,
        enabled: true,
      };

      await converter.setConversionConfig(ConversionConfig);

      // Calculation for token transfer to converter after fees deduction.
      const amountDeductedInTransfer = parseUnits(".25", 18).div(100);
      const amountTransferredAfterFees = parseUnits(".25", 18).sub(amountDeductedInTransfer);

      const expectedResults = await converter.callStatic.getAmountOut(
        convertToUnit(".25", 18),
        tokenInDeflationary.address,
        tokenOut.address,
      );

      await expect(
        converter.convertExactTokensSupportingFeeOnTransferTokens(
          convertToUnit(".25", 18),
          convertToUnit(".5", 18),
          tokenInDeflationary.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      )
        .to.emit(converter, "ConvertExactTokensSupportingFeeOnTransferTokens")
        .withArgs(amountTransferredAfterFees, expectedResults[1]);
    });
  });

  describe("Convert tokens for exact tokens with supporting fee", async () => {
    beforeEach(async () => {
      await tokenInDeflationary.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenIn.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenOut.transfer(converter.address, convertToUnit("1.5", 18));

      await oracle.getPrice.whenCalledWith(tokenInDeflationary.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
    });

    it("Revert on lower amount out than expected", async () => {
      await converter.setConversionConfig(ConversionConfig);
      await expect(
        converter.convertForExactTokensSupportingFeeOnTransferTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "AmountInHigherThanMax");
    });

    it("Success on convert exact tokens with supporting fee", async () => {
      const ConversionConfig = {
        tokenAddressIn: tokenInDeflationary.address,
        tokenAddressOut: tokenOut.address,
        incentive: INCENTIVE,
        enabled: true,
      };

      await converter.setConversionConfig(ConversionConfig);

      const expectedResults = await converter.callStatic.getAmountIn(
        convertToUnit(".5", 18),
        tokenInDeflationary.address,
        tokenOut.address,
      );
      // Calculation for Token Transferred to converter.
      const amountTransferredAfterFees = expectedResults[1].sub(expectedResults[1].div(100));

      await expect(
        converter.convertForExactTokensSupportingFeeOnTransferTokens(
          convertToUnit(".25", 18),
          convertToUnit(".5", 18),
          tokenInDeflationary.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      )
        .to.emit(converter, "ConvertForExactTokensSupportingFeeOnTransferTokens")
        .withArgs(amountTransferredAfterFees, expectedResults[0]);
    });
  });

  describe("Set convert configurations", () => {
    beforeEach(async () => {
      accessControl.isAllowedToCall.returns(true);
    });

    it("Revert on not access to set convert configurations", async () => {
      accessControl.isAllowedToCall.reset;
      accessControl.isAllowedToCall.returns(false);

      await expect(converter.setConversionConfig(ConversionConfig)).to.be.revertedWithCustomError(
        converter,
        "Unauthorized",
      );
    });

    it("Revert on invalid tokenIn address", async () => {
      const ConverterConfig = {
        ...ConversionConfig,
        tokenAddressIn: ethers.constants.AddressZero,
      };

      await expect(converter.setConversionConfig(ConverterConfig)).to.be.revertedWithCustomError(
        converter,
        "ZeroAddressNotAllowed",
      );
    });

    it("Revert on invalid tokenOut address", async () => {
      const ConverterConfig = {
        ...ConversionConfig,
        tokenAddressOut: ethers.constants.AddressZero,
      };

      await expect(converter.setConversionConfig(ConverterConfig)).to.be.revertedWithCustomError(
        converter,
        "ZeroAddressNotAllowed",
      );
    });

    it("Revert on high incentive percentage", async () => {
      const ConverterConfig = {
        ...ConversionConfig,
        incentive: convertToUnit("6", 18), // more than MAX_INCENTIVE = 5e18
      };

      await expect(converter.setConversionConfig(ConverterConfig)).to.be.revertedWithCustomError(
        converter,
        "IncentiveTooHigh",
      );
    });

    it("Set converter config for first time", async () => {
      let isExist = await converter.convertConfigurations(tokenIn.address, tokenOut.address);

      expect(isExist[0]).to.equal(ethers.constants.AddressZero);
      expect(isExist[1]).to.equal(ethers.constants.AddressZero);
      expect(isExist[2]).to.equal(0);
      expect(isExist[3]).to.equal(false);

      await expect(converter.setConversionConfig(ConversionConfig))
        .to.emit(converter, "ConversionConfigUpdated")
        .withArgs(tokenIn.address, tokenOut.address, 0, INCENTIVE, false, true);

      isExist = await converter.convertConfigurations(tokenIn.address, tokenOut.address);

      expect(isExist[0]).to.equal(tokenIn.address);
      expect(isExist[1]).to.equal(tokenOut.address);
      expect(isExist[2]).to.equal(INCENTIVE);
      expect(isExist[3]).to.equal(true);
    });

    it("Update the incentive", async () => {
      const NEW_INCENTIVE = convertToUnit("2", 17);

      await converter.setConversionConfig(ConversionConfig);

      const ConverterConfig = {
        ...ConversionConfig,
        incentive: NEW_INCENTIVE,
      };

      await expect(converter.setConversionConfig(ConverterConfig))
        .to.emit(converter, "ConversionConfigUpdated")
        .withArgs(tokenIn.address, tokenOut.address, INCENTIVE, NEW_INCENTIVE, true, true);

      const isExist = await converter.convertConfigurations(tokenIn.address, tokenOut.address);
      expect(isExist[2]).to.equal(NEW_INCENTIVE);
    });
  });

  describe("Get amount out", () => {
    const AMOUNT_IN_UNDER = convertToUnit("5", 17);
    const AMOUNT_IN_OVER = convertToUnit("1", 18);

    beforeEach(async () => {
      await tokenIn.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenOut.transfer(converter.address, convertToUnit("1.5", 18));
    });

    const setConversionConfig = async () => {
      await converter.setConversionConfig(ConversionConfig);
      await tokenOut.balanceOf.returns(TOKEN_OUT_MAX);
    };

    it("Revert on zero amountIn value", async () => {
      await expect(converter.getAmountOut(0, tokenIn.address, tokenOut.address)).to.be.revertedWithCustomError(
        converter,
        "InsufficientInputAmount",
      );
    });

    it("Revert on no config or disabled convert for tokens pair", async () => {
      await expect(
        converter.getAmountOut(TOKEN_OUT_MAX, tokenIn.address, tokenOut.address),
      ).to.be.revertedWithCustomError(converter, "ConversionConfigNotEnabled");
    });

    it("Success on converting tokenIn to tokenOut for under tokenOut liquidity", async () => {
      await setConversionConfig();
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
      const results = await converter.callStatic.getAmountOut(AMOUNT_IN_UNDER, tokenIn.address, tokenOut.address);
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

    it("Success on converting tokenIn to tokenOut for over tokenOut liquidity", async () => {
      await setConversionConfig();
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
      const results = await converter.callStatic.getAmountOut(AMOUNT_IN_OVER, tokenIn.address, tokenOut.address);
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
      await tokenIn.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenOut.transfer(converter.address, convertToUnit("1.5", 18));
    });

    const setConversionConfig = async () => {
      await converter.setConversionConfig(ConversionConfig);
      await tokenOut.balanceOf.returns(TOKEN_OUT_MAX);
    };

    it("Revert on zero amountIn value", async () => {
      await expect(converter.getAmountIn(0, tokenIn.address, tokenOut.address)).to.be.revertedWithCustomError(
        converter,
        "InsufficientInputAmount",
      );
    });

    it("Revert on no config or disabled convert for tokens pair", async () => {
      await expect(
        converter.getAmountIn(AMOUNT_IN_UNDER, tokenIn.address, tokenOut.address),
      ).to.be.revertedWithCustomError(converter, "ConversionConfigNotEnabled");
    });

    it("Success on conversing tokenIn to tokenOut for under tokenOut liquidity", async () => {
      await setConversionConfig();
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
      const results = await converter.callStatic.getAmountIn(AMOUNT_IN_UNDER, tokenIn.address, tokenOut.address);
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

    it("Success on conversing tokenIn to tokenOut for over tokenOut liquidity", async () => {
      await setConversionConfig();
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
      const results = await converter.callStatic.getAmountIn(AMOUNT_IN_OVER, tokenIn.address, tokenOut.address);
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

      await expect(converter.connect(nonOwner).setPriceOracle(newOracle.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Revert on invalid oracle address", async () => {
      await expect(converter.setPriceOracle(ethers.constants.AddressZero)).to.be.revertedWithCustomError(
        converter,
        "ZeroAddressNotAllowed",
      );
    });

    it("Success on new price oracle update", async () => {
      await expect(converter.setPriceOracle(newOracle.address))
        .to.emit(converter, "PriceOracleUpdated")
        .withArgs(oracle.address, newOracle.address);
    });
  });

  describe("Pause/Resume functionality", () => {
    beforeEach(async () => {
      accessControl.isAllowedToCall.reset;
      accessControl.isAllowedToCall.returns(true);
    });

    it("Revert on pauseConversion for non owner call", async () => {
      accessControl.isAllowedToCall.reset;
      accessControl.isAllowedToCall.returns(false);

      await expect(converter.connect(to).pauseConversion()).to.be.revertedWithCustomError(converter, "Unauthorized");
    });

    it("Success on pauseConversion", async () => {
      await expect(converter.pauseConversion()).to.emit(converter, "ConversionPaused");
    });

    it("Revert on when convert is already paused", async () => {
      await converter.pauseConversion();
      await expect(converter.pauseConversion()).to.be.revertedWithCustomError(converter, "ConversionTokensPaused");
    });

    it("Convert methods should revert on convert pause", async () => {
      const Value_1 = convertToUnit(".25", 18);
      const VALUE_2 = convertToUnit(".5", 18);
      await converter.pauseConversion();

      await expect(
        converter.convertExactTokens(Value_1, VALUE_2, tokenIn.address, tokenOut.address, await to.getAddress()),
      ).to.be.revertedWithCustomError(converter, "ConversionTokensPaused");

      await expect(
        converter.convertForExactTokens(Value_1, VALUE_2, tokenIn.address, tokenOut.address, await to.getAddress()),
      ).to.be.revertedWithCustomError(converter, "ConversionTokensPaused");

      await expect(
        converter.convertExactTokensSupportingFeeOnTransferTokens(
          Value_1,
          VALUE_2,
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "ConversionTokensPaused");

      await expect(
        converter.convertForExactTokensSupportingFeeOnTransferTokens(
          Value_1,
          VALUE_2,
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "ConversionTokensPaused");
    });

    it("Revert on resumeConversion for non owner call", async () => {
      accessControl.isAllowedToCall.reset;
      accessControl.isAllowedToCall.returns(false);

      await expect(converter.connect(to).resumeConversion()).to.be.revertedWithCustomError(converter, "Unauthorized");
    });

    it("Success on resumeConversion", async () => {
      await converter.pauseConversion();
      await expect(converter.resumeConversion()).to.emit(converter, "ConversionResumed");
    });

    it("Revert on when convert is already active", async () => {
      await expect(converter.resumeConversion()).to.be.revertedWithCustomError(converter, "ConversionTokensActive");
    });
  });

  describe("SweepTokens abstract converter", () => {
    it("Transfer sweep tokens", async () => {
      expect(await tokenIn.balanceOf(converter.address)).to.equals(0);
      await expect(tokenIn.transfer(converter.address, 1000)).to.changeTokenBalances(
        tokenIn,
        [await owner.getAddress(), converter.address],
        [-1000, 1000],
      );
      await expect(converter.sweepToken(tokenIn.address, await owner.getAddress(), 1000)).to.changeTokenBalances(
        tokenIn,
        [await owner.getAddress(), converter.address],
        [1000, -1000],
      );
    });
  });
});