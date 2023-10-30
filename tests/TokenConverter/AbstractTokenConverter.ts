import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "bignumber.js";
import chai from "chai";
import { Signer } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import {
  IAccessControlManagerV8,
  IConverterNetwork,
  IRiskFundGetters,
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
let destination: FakeContract<IRiskFundGetters>;
let converterNetwork: FakeContract<IConverterNetwork>;
let converter: MockContract<MockConverter>;
let tokenIn: MockContract<MockToken>;
let tokenOut: MockContract<MockToken>;
let oracle: FakeContract<ResilientOracle>;
let tokenInDeflationary: MockContract<MockDeflatingToken>;
let to: Signer;
let owner: Signer;
let ConversionConfig: {
  incentive: string;
  enabled: boolean;
};

const INCENTIVE = convertToUnit("1", 17);
const TOKEN_OUT_MAX = convertToUnit("1.5", 18);
const TOKEN_IN_PRICE = convertToUnit("1", 18);
const TOKEN_OUT_PRICE = convertToUnit("0.5", 18);
const MANTISSA_ONE = convertToUnit("1", 18);

async function fixture(): Promise<void> {
  [owner, to] = await ethers.getSigners();
  const Converter = await smock.mock<MockConverter__factory>("MockConverter");

  accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  destination = await smock.fake<IRiskFundGetters>("IRiskFundGetters");
  converterNetwork = await smock.fake<IConverterNetwork>("IConverterNetwork");

  oracle = await smock.fake<ResilientOracle>("ResilientOracle");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  const MockTokenDeflationary = await smock.mock<MockDeflatingToken__factory>("MockDeflatingToken");
  tokenIn = await MockToken.deploy("TokenIn", "tokenIn", 18);
  await tokenIn.faucet(parseUnits("1000", 18));

  tokenInDeflationary = await MockTokenDeflationary.deploy(parseUnits("1000", 18));

  tokenOut = await MockToken.deploy("TokenOut", "tokenOut", 18);
  await tokenOut.faucet(parseUnits("1000", 18));

  converter = await Converter.deploy();
  await converter.AbstractTokenConverter_init(accessControl.address, oracle.address, destination.address);
  accessControl.isAllowedToCall.returns(true);

  await converter.setConverterNetwork(converterNetwork.address);

  ConversionConfig = {
    incentive: INCENTIVE,
    enabled: true,
  };
}

describe.only("MockConverter: tests", () => {
  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe("Convert tokens for exact tokens", async () => {
    beforeEach(async () => {
      await destination.convertibleBaseAsset.returns(tokenIn.address);

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
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);
      const expectedResults = await converter.callStatic.getUpdatedAmountIn(
        AMOUNT_OUT,
        tokenIn.address,
        tokenOut.address,
      );

      const tx = await converter.convertForExactTokens(
        MAX_AMOUNT_IN,
        AMOUNT_OUT,
        tokenIn.address,
        tokenOut.address,
        await to.getAddress(),
      );

      await tx.wait();

      await expect(tx).to.emit(converter, "ConvertedForExactTokens").withArgs(expectedResults[1], expectedResults[0]);
    });

    it("Revert on lower amount out than expected", async () => {
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);
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

    it("Revert when address(to) is same as tokenAddressIn or tokenAddressOut", async () => {
      await destination.convertibleBaseAsset.returns(tokenIn.address);
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);

      await expect(
        converter.convertForExactTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          tokenIn.address,
        ),
      ).to.be.revertedWithCustomError(converter, "InvalidToAddress");
    });

    it("Revert for user if onlyForPrivateConversion is enabled", async () => {
      const updatedConfig = {
        ...ConversionConfig,
        onlyForPrivateConversions: true,
      };
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, updatedConfig);

      await expect(
        converter.convertForExactTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "ConversionEnabledOnlyForPrivateConversions");
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
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);

      const expectedResults = await converter.callStatic.getUpdatedAmountOut(
        AMOUNT_IN,
        tokenIn.address,
        tokenOut.address,
      );

      const tx = await converter.convertExactTokens(
        AMOUNT_IN,
        MIN_AMOUNT_OUT,
        tokenIn.address,
        tokenOut.address,
        await to.getAddress(),
      );

      await tx.wait();

      await expect(tx).to.emit(converter, "ConvertedExactTokens").withArgs(expectedResults[0], expectedResults[1]);
    });

    it("Revert on lower amount out than expected", async () => {
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);
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

    it("Revert when address(to) is same as tokenAddressIn or tokenAddressOut", async () => {
      await destination.convertibleBaseAsset.returns(tokenIn.address);
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);

      await expect(
        converter.convertExactTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          tokenIn.address,
        ),
      ).to.be.revertedWithCustomError(converter, "InvalidToAddress");
    });

    it("Revert for user if onlyForPrivateConversion is enabled", async () => {
      const updatedConfig = {
        ...ConversionConfig,
        onlyForPrivateConversions: true,
      };
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, updatedConfig);

      await expect(
        converter.convertExactTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "ConversionEnabledOnlyForPrivateConversions");
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
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);
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

    it("Revert when address(to) is same as tokenAddressIn or tokenAddressOut", async () => {
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);

      await expect(
        converter.convertExactTokensSupportingFeeOnTransferTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          tokenIn.address,
        ),
      ).to.be.revertedWithCustomError(converter, "InvalidToAddress");
    });

    it("Success on convert exact tokens with supporting fee", async () => {
      await destination.convertibleBaseAsset.returns(tokenInDeflationary.address);
      const ConversionConfig = {
        tokenAddressIn: tokenInDeflationary.address,
        tokenAddressOut: tokenOut.address,
        incentive: INCENTIVE,
        enabled: true,
      };

      await converter.setConversionConfig(tokenInDeflationary.address, tokenOut.address, ConversionConfig);

      // Calculation for token transfer to converter after fees deduction.
      const amountDeductedInTransfer = parseUnits(".25", 18).div(100);
      const amountTransferredAfterFees = parseUnits(".25", 18).sub(amountDeductedInTransfer);

      const expectedResults = await converter.callStatic.getUpdatedAmountOut(
        amountTransferredAfterFees,
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
        .to.emit(converter, "ConvertedExactTokensSupportingFeeOnTransferTokens")
        .withArgs(amountTransferredAfterFees, expectedResults[1]);
    });

    it("Revert on deflationary token transfer", async () => {
      await destination.convertibleBaseAsset.returns(tokenInDeflationary.address);
      const ConversionConfig = {
        incentive: INCENTIVE,
        enabled: true,
      };

      await converter.setConversionConfig(tokenInDeflationary.address, tokenOut.address, ConversionConfig);

      await expect(
        converter.convertExactTokens(
          convertToUnit(".25", 18),
          convertToUnit(".5", 18),
          tokenInDeflationary.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "AmountInMismatched");
    });

    it("Revert for user if onlyForPrivateConversion is enabled", async () => {
      const updatedConfig = {
        ...ConversionConfig,
        onlyForPrivateConversions: true,
      };
      await converter.setConversionConfig(tokenInDeflationary.address, tokenOut.address, updatedConfig);

      await expect(
        converter.convertExactTokensSupportingFeeOnTransferTokens(
          convertToUnit(".25", 18),
          convertToUnit(".5", 18),
          tokenInDeflationary.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "ConversionEnabledOnlyForPrivateConversions");
    });
  });

  describe("Convert tokens for exact tokens with supporting fee", async () => {
    beforeEach(async () => {
      await destination.convertibleBaseAsset.returns(tokenIn.address);
      await tokenInDeflationary.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenIn.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenOut.transfer(converter.address, convertToUnit("1.5", 18));

      await oracle.getPrice.whenCalledWith(tokenInDeflationary.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
    });

    it("Revert on lower amount out than expected", async () => {
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);
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

    it("Revert when address(to) is same as tokenAddressIn or tokenAddressOut", async () => {
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);

      await expect(
        converter.convertForExactTokensSupportingFeeOnTransferTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          tokenIn.address,
        ),
      ).to.be.revertedWithCustomError(converter, "InvalidToAddress");
    });

    it("Revert on deflationary token transfer", async () => {
      await destination.convertibleBaseAsset.returns(tokenInDeflationary.address);

      const ConversionConfig = {
        incentive: INCENTIVE,
        enabled: true,
      };

      await converter.setConversionConfig(tokenInDeflationary.address, tokenOut.address, ConversionConfig);

      await expect(
        converter.convertForExactTokens(
          convertToUnit(".25", 18),
          convertToUnit(".5", 18),
          tokenInDeflationary.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "AmountOutMismatched");
    });

    it("Revert for user if onlyForPrivateConversion is enabled", async () => {
      const updatedConfig = {
        incentive: INCENTIVE,
        enabled: true,
        onlyForPrivateConversions: true,
      };
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, updatedConfig);

      await expect(
        converter.convertForExactTokensSupportingFeeOnTransferTokens(
          convertToUnit(".5", 18),
          convertToUnit("1.5", 18),
          tokenIn.address,
          tokenOut.address,
          await to.getAddress(),
        ),
      ).to.be.revertedWithCustomError(converter, "ConversionEnabledOnlyForPrivateConversions");
    });

    // We can not keep convertForExactTokens with supporting fee.
    // it.only("Success on convert exact tokens with supporting fee", async () => {
    //   // Calculation for token transfer to converter after fees deduction.
    //   const amountDeductedInTransfer = parseUnits(".25", 18).div(100);
    //   const amountTransferredAfterFees = parseUnits(".25", 18).sub(amountDeductedInTransfer);

    //   await destination.convertibleBaseAsset.returns(tokenInDeflationary.address);
    //   const ConversionConfig = {
    //     incentive: INCENTIVE,
    //     enabled: true,
    //   };

    //   await converter.setConversionConfig(tokenInDeflationary.address, tokenOut.address, ConversionConfig);

    //   const expectedResults = await converter.callStatic.getUpdatedAmountIn(
    //     convertToUnit(".5", 18),
    //     tokenInDeflationary.address,
    //     tokenOut.address,
    //   );

    //   const expectedResults2 = await converter.callStatic.getUpdatedAmountOut(
    //     amountTransferredAfterFees,
    //     tokenInDeflationary.address,
    //     tokenOut.address,
    //   );
    //   // Calculation for Token Transferred to converter.

    //   await expect(
    //     converter.convertForExactTokensSupportingFeeOnTransferTokens(
    //       convertToUnit(".25", 18),
    //       convertToUnit(".5", 18),
    //       tokenInDeflationary.address,
    //       tokenOut.address,
    //       await to.getAddress(),
    //     ),
    //   )
    //     .to.emit(converter, "ConvertedForExactTokensSupportingFeeOnTransferTokens")
    //     .withArgs(amountTransferredAfterFees, expectedResults2[0]);
    // });
  });

  describe("Set convert configurations", () => {
    beforeEach(async () => {
      await destination.convertibleBaseAsset.returns(tokenIn.address);
      accessControl.isAllowedToCall.returns(true);
    });

    it("Revert on not access to set convert configurations", async () => {
      accessControl.isAllowedToCall.reset;
      accessControl.isAllowedToCall.returns(false);

      await expect(
        converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig),
      ).to.be.revertedWithCustomError(converter, "Unauthorized");
    });

    it("Revert on invalid tokenIn address", async () => {
      await expect(
        converter.setConversionConfig(await ethers.constants.AddressZero, tokenOut.address, ConversionConfig),
      ).to.be.revertedWithCustomError(converter, "ZeroAddressNotAllowed");
    });

    it("Revert on invalid tokenOut address", async () => {
      await expect(
        converter.setConversionConfig(tokenIn.address, ethers.constants.AddressZero, ConversionConfig),
      ).to.be.revertedWithCustomError(converter, "ZeroAddressNotAllowed");
    });

    it("Revert on cyclic conversion", async () => {
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig),
        await expect(
          converter.setConversionConfig(tokenOut.address, tokenIn.address, ConversionConfig),
        ).to.be.revertedWithCustomError(converter, "InvalidTokenConfigAddresses");
    });

    it("Revert on high incentive percentage", async () => {
      const ConverterConfig = {
        ...ConversionConfig,
        incentive: convertToUnit("6", 18), // more than MAX_INCENTIVE = 5e18
      };

      await expect(
        converter.setConversionConfig(tokenIn.address, tokenOut.address, ConverterConfig),
      ).to.be.revertedWithCustomError(converter, "IncentiveTooHigh");
    });

    it("Set converter config for first time", async () => {
      let isExist = await converter.conversionConfigurations(tokenIn.address, tokenOut.address);

      expect(isExist[0]).to.equal(0);
      expect(isExist[1]).to.equal(false);

      await expect(converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig))
        .to.emit(converter, "ConversionConfigUpdated")
        .withArgs(tokenIn.address, tokenOut.address, 0, INCENTIVE, false, true, false, false);

      isExist = await converter.conversionConfigurations(tokenIn.address, tokenOut.address);

      expect(isExist[0]).to.equal(INCENTIVE);
      expect(isExist[1]).to.equal(true);
    });

    it("Update the incentive", async () => {
      const NEW_INCENTIVE = convertToUnit("2", 17);

      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);

      const ConverterConfig = {
        ...ConversionConfig,
        incentive: NEW_INCENTIVE,
      };

      await expect(converter.setConversionConfig(tokenIn.address, tokenOut.address, ConverterConfig))
        .to.emit(converter, "ConversionConfigUpdated")
        .withArgs(tokenIn.address, tokenOut.address, INCENTIVE, NEW_INCENTIVE, true, true, false, false);

      const isExist = await converter.conversionConfigurations(tokenIn.address, tokenOut.address);
      expect(isExist[0]).to.equal(NEW_INCENTIVE);
    });

    it("Update the onlyForPrivateConversions flag", async () => {
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);

      let value = await converter.conversionConfigurations(tokenIn.address, tokenOut.address);
      expect(value[2]).to.equal(false);

      const ConverterConfig = {
        ...ConversionConfig,
        onlyForPrivateConversions: true,
      };

      await expect(converter.setConversionConfig(tokenIn.address, tokenOut.address, ConverterConfig))
        .to.emit(converter, "ConversionConfigUpdated")
        .withArgs(tokenIn.address, tokenOut.address, INCENTIVE, INCENTIVE, true, true, false, true);

      value = await converter.conversionConfigurations(tokenIn.address, tokenOut.address);
      expect(value[2]).to.equal(true);
    });
  });

  describe("Get amount out", () => {
    const AMOUNT_IN_UNDER = convertToUnit("5", 17);

    beforeEach(async () => {
      await tokenIn.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenOut.transfer(converter.address, convertToUnit("1.5", 18));
    });

    const setConversionConfig = async () => {
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);
      await tokenOut.balanceOf.returns(TOKEN_OUT_MAX);
    };

    it("Revert on zero amountIn value", async () => {
      await expect(converter.getUpdatedAmountOut(0, tokenIn.address, tokenOut.address)).to.be.revertedWithCustomError(
        converter,
        "InsufficientInputAmount",
      );
    });

    it("Revert on no config or disabled convert for tokens pair", async () => {
      await expect(
        converter.getUpdatedAmountOut(TOKEN_OUT_MAX, tokenIn.address, tokenOut.address),
      ).to.be.revertedWithCustomError(converter, "ConversionConfigNotEnabled");
    });

    it("Success on converting tokenIn to tokenOut for under tokenOut liquidity", async () => {
      await setConversionConfig();
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
      const results = await converter.callStatic.getUpdatedAmountOut(
        AMOUNT_IN_UNDER,
        tokenIn.address,
        tokenOut.address,
      );
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

    it("Success on converting tokenIn to tokenOut for under tokenOut liquidity for converters", async () => {
      await setConversionConfig();
      await converterNetwork.isTokenConverter.returns(true);
      const results = await converter.callStatic.getUpdatedAmountOut(
        AMOUNT_IN_UNDER,
        tokenIn.address,
        tokenOut.address,
      );
      const conversionRatio = new BigNumber(TOKEN_IN_PRICE).dividedBy(TOKEN_OUT_PRICE);
      const amountOut = new BigNumber(AMOUNT_IN_UNDER).multipliedBy(conversionRatio).toFixed(0);

      expect(results[0]).to.equal(AMOUNT_IN_UNDER);
      expect(results[1]).to.equal(amountOut);
    });

    it("Revert on onlyForPrivateConversions enabled", async () => {
      const updatedConfig = {
        ...ConversionConfig,
        onlyForPrivateConversions: true,
      };
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, updatedConfig);

      await expect(
        converter.getAmountOut(TOKEN_OUT_MAX, tokenIn.address, tokenOut.address),
      ).to.be.revertedWithCustomError(converter, "ConversionEnabledOnlyForPrivateConversions");
    });
  });

  describe("Get amount in", () => {
    const AMOUNT_IN_UNDER = convertToUnit("1", 18);

    beforeEach(async () => {
      await tokenIn.connect(owner).approve(converter.address, convertToUnit("1", 18));
      await tokenOut.transfer(converter.address, convertToUnit("3", 18));
      await converterNetwork.isTokenConverter.returns(false);
    });

    const setConversionConfig = async () => {
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);
      await tokenOut.balanceOf.returns(TOKEN_OUT_MAX);
    };

    it("Revert on zero amountOut value", async () => {
      await expect(converter.getUpdatedAmountIn(0, tokenIn.address, tokenOut.address)).to.be.revertedWithCustomError(
        converter,
        "InsufficientOutputAmount",
      );
    });

    it("Revert on no config or disabled convert for tokens pair", async () => {
      await expect(
        converter.getUpdatedAmountIn(AMOUNT_IN_UNDER, tokenIn.address, tokenOut.address),
      ).to.be.revertedWithCustomError(converter, "ConversionConfigNotEnabled");
    });

    it("Success on conversing tokenIn to tokenOut for under tokenOut liquidity", async () => {
      await setConversionConfig();
      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);
      const results = await converter.callStatic.getUpdatedAmountIn(AMOUNT_IN_UNDER, tokenIn.address, tokenOut.address);
      const conversionRatio = new BigNumber(TOKEN_IN_PRICE).dividedBy(TOKEN_OUT_PRICE);
      const conversionWithIncentive = Number(MANTISSA_ONE) + Number(INCENTIVE);
      const amountIn = new BigNumber(AMOUNT_IN_UNDER)
        .multipliedBy(MANTISSA_ONE)
        .dividedBy(conversionRatio)
        .dividedBy(conversionWithIncentive)
        .toFixed(0);

      expect(results[0]).to.closeTo(AMOUNT_IN_UNDER, 1);
      expect(results[1]).to.closeTo(amountIn, 1);
    });

    it("Success on conversing tokenIn to tokenOut for under tokenOut liquidity for converters", async () => {
      await setConversionConfig();
      await converterNetwork.isTokenConverter.returns(true);

      const results = await converter.callStatic.getUpdatedAmountIn(AMOUNT_IN_UNDER, tokenIn.address, tokenOut.address);
      const conversionRatio = new BigNumber(TOKEN_IN_PRICE).dividedBy(TOKEN_OUT_PRICE);
      const amountIn = new BigNumber(AMOUNT_IN_UNDER).dividedBy(conversionRatio).toFixed(0);

      expect(results[0]).to.closeTo(AMOUNT_IN_UNDER, 1);
      expect(results[1]).to.closeTo(amountIn, 1);
    });

    it("Revert on onlyForPrivateConversions enabled", async () => {
      const updatedConfig = {
        ...ConversionConfig,
        onlyForPrivateConversions: true,
      };
      await converter.setConversionConfig(tokenIn.address, tokenOut.address, updatedConfig);

      await expect(
        converter.getAmountIn(TOKEN_OUT_MAX, tokenIn.address, tokenOut.address),
      ).to.be.revertedWithCustomError(converter, "ConversionEnabledOnlyForPrivateConversions");
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

  describe("Set converter network", () => {
    let newNetwork: FakeContract<IConverterNetwork>;

    before(async () => {
      newNetwork = await smock.fake<IConverterNetwork>("IConverterNetwork");
    });

    it("Revert on non-owner call", async () => {
      const [, nonOwner] = await ethers.getSigners();

      await expect(converter.connect(nonOwner).setConverterNetwork(newNetwork.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Revert on invalid oracle address", async () => {
      await expect(converter.setConverterNetwork(ethers.constants.AddressZero)).to.be.revertedWithCustomError(
        converter,
        "ZeroAddressNotAllowed",
      );
    });

    it("Success on new price oracle update", async () => {
      await expect(converter.setConverterNetwork(newNetwork.address))
        .to.emit(converter, "ConverterNetworkAddressUpdated")
        .withArgs(converterNetwork.address, newNetwork.address);
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
