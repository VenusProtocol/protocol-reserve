import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { impersonateAccount, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { Signer } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { Address } from "hardhat-deploy/dist/types";

import {
  ConverterNetwork,
  ConverterNetwork__factory,
  IAccessControlManagerV8,
  MockToken,
  MockToken__factory,
  ResilientOracle,
  SingleTokenConverter,
  SingleTokenConverter__factory,
} from "../../typechain";
import { convertToUnit } from "../utils";

const { expect } = chai;
chai.use(smock.matchers);

let accessControl: FakeContract<IAccessControlManagerV8>;
let oracle: FakeContract<ResilientOracle>;
let usdcConverter: MockContract<SingleTokenConverter>;
let usdtConverter: MockContract<SingleTokenConverter>;
let btcConverter: MockContract<SingleTokenConverter>;
let ethConverter: MockContract<SingleTokenConverter>;
let converterNetwork: MockContract<ConverterNetwork>;
let usdc: MockContract<MockToken>;
let usdt: MockContract<MockToken>;
let btc: MockContract<MockToken>;
let eth: MockContract<MockToken>;
let userSigner: Signer;
let destinationAddress: Address;
let userAddress: Address;
let ConversionConfig: {
  incentive: string;
  conversionAccess: number;
};

const INCENTIVE = convertToUnit("1", 17);
const MIN_AMOUNT_TO_CONVERT = convertToUnit("1", 18);

async function deployConverter(token: string) {
  const converterFactory = await smock.mock<SingleTokenConverter__factory>("SingleTokenConverter");
  const converter = await upgrades.deployProxy(converterFactory, [
    accessControl.address,
    oracle.address,
    destinationAddress,
    token,
    MIN_AMOUNT_TO_CONVERT,
  ]);
  return converter;
}

async function fixture(): Promise<void> {
  let detinationSigner;
  [, userSigner, detinationSigner] = await ethers.getSigners();
  destinationAddress = detinationSigner.address;
  userAddress = await userSigner.getAddress();

  accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  oracle = await smock.fake<ResilientOracle>("ResilientOracle");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  usdc = await MockToken.deploy("USDC", "usdc", 18);
  usdt = await MockToken.deploy("USDC", "usdc", 18);
  btc = await MockToken.deploy("USDC", "usdc", 18);
  eth = await MockToken.deploy("USDC", "usdc", 18);

  usdcConverter = await deployConverter(usdc.address);
  usdtConverter = await deployConverter(usdt.address);
  btcConverter = await deployConverter(btc.address);
  ethConverter = await deployConverter(eth.address);

  const converterNetworkFactory = await smock.mock<ConverterNetwork__factory>("ConverterNetwork");
  converterNetwork = await upgrades.deployProxy(converterNetworkFactory, [accessControl.address, 20]);

  await usdcConverter.setConverterNetwork(converterNetwork.address);
  await usdtConverter.setConverterNetwork(converterNetwork.address);
  await btcConverter.setConverterNetwork(converterNetwork.address);
  await ethConverter.setConverterNetwork(converterNetwork.address);

  await accessControl.isAllowedToCall.returns(true);
  await converterNetwork.addTokenConverter(usdcConverter.address);
  await converterNetwork.addTokenConverter(usdtConverter.address);
  await converterNetwork.addTokenConverter(btcConverter.address);
}

describe("ConverterNetwork: tests", () => {
  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe("addTokenConverter()", () => {
    it("should revert when executed by non owner", async () => {
      await accessControl.isAllowedToCall.returns(false);

      const tx = converterNetwork.addTokenConverter(ethConverter.address);

      await expect(tx).to.be.revertedWithCustomError(converterNetwork, "Unauthorized");
    });

    it("should revert when zero address is passed", async () => {
      await accessControl.isAllowedToCall.returns(true);

      const tx = converterNetwork.addTokenConverter(ethers.constants.AddressZero);

      await expect(tx).to.be.revertedWithCustomError(converterNetwork, "InvalidTokenConverterAddress");
    });

    it("should revert when trying to add converter which already exists", async () => {
      const tx = converterNetwork.addTokenConverter(btcConverter.address);

      await expect(tx).to.be.revertedWithCustomError(converterNetwork, "ConverterAlreadyExists");
    });

    it("should execute successfully", async () => {
      const tx = await converterNetwork.addTokenConverter(ethConverter.address);
      await expect(tx).to.emit(converterNetwork, "ConverterAdded").withArgs(ethConverter.address);
    });
  });

  describe("removeTokenConverter()", () => {
    it("should revert when executed by non owner", async () => {
      await accessControl.isAllowedToCall.returns(false);

      const tx = converterNetwork.removeTokenConverter(ethConverter.address);

      await expect(tx).to.be.revertedWithCustomError(converterNetwork, "Unauthorized");
    });

    it("should revert when trying to add converter which does not exist", async () => {
      await accessControl.isAllowedToCall.returns(true);
      const tx = converterNetwork.removeTokenConverter(userAddress);

      await expect(tx).to.be.revertedWithCustomError(converterNetwork, "ConverterDoesNotExist");
    });

    it("should execute successfully", async () => {
      const tx = await converterNetwork.removeTokenConverter(btcConverter.address);
      await expect(tx).to.emit(converterNetwork, "ConverterRemoved").withArgs(btcConverter.address);
    });
  });

  describe("getAllConverters", () => {
    it("should return array containing all converters", async () => {
      const converters = await converterNetwork.getAllConverters();
      expect(converters.length).to.equal(3);
      expect(converters).to.includes(btcConverter.address, usdcConverter.address);
      expect(converters).to.include(usdtConverter.address);
    });
  });

  describe("isTokenConverter()", () => {
    it("should return correct values", async () => {
      let isConverter = await converterNetwork.isTokenConverter(usdtConverter.address);
      expect(isConverter).to.be.true;

      isConverter = await converterNetwork.isTokenConverter(btcConverter.address);
      expect(isConverter).to.be.true;

      isConverter = await converterNetwork.isTokenConverter(ethConverter.address);
      expect(isConverter).to.be.false;
    });
  });

  describe("findTokenConverter()", () => {
    let usdtConverterSigner: Signer;
    let usdtConverter2: MockContract<SingleTokenConverter>;
    let usdtConverter3: MockContract<SingleTokenConverter>;
    let usdtConverter4: MockContract<SingleTokenConverter>;
    let usdcConverter2: MockContract<SingleTokenConverter>;
    let usdcConverter3: MockContract<SingleTokenConverter>;

    beforeEach(async () => {
      ConversionConfig = {
        incentive: INCENTIVE,
        conversionAccess: 1,
      };
      await accessControl.isAllowedToCall.returns(true);

      usdtConverter2 = await deployConverter(usdt.address);
      usdtConverter3 = await deployConverter(usdt.address);
      usdtConverter4 = await deployConverter(usdt.address);
      usdcConverter2 = await deployConverter(usdc.address);
      usdcConverter3 = await deployConverter(usdc.address);

      await usdtConverter.setConverterNetwork(converterNetwork.address);
      await usdtConverter2.setConverterNetwork(converterNetwork.address);
      await usdtConverter3.setConverterNetwork(converterNetwork.address);
      await usdtConverter4.setConverterNetwork(converterNetwork.address);
      await usdcConverter.setConverterNetwork(converterNetwork.address);
      await usdcConverter2.setConverterNetwork(converterNetwork.address);
      await usdcConverter3.setConverterNetwork(converterNetwork.address);
      await btcConverter.setConverterNetwork(converterNetwork.address);

      await usdtConverter.setConversionConfig(usdt.address, usdc.address, ConversionConfig);
      await usdtConverter2.setConversionConfig(usdt.address, usdc.address, ConversionConfig);
      await usdtConverter3.setConversionConfig(usdt.address, usdc.address, ConversionConfig);
      await usdtConverter4.setConversionConfig(usdt.address, usdc.address, ConversionConfig);
      await usdcConverter.setConversionConfig(usdc.address, usdt.address, ConversionConfig);
      await usdcConverter2.setConversionConfig(usdc.address, usdt.address, ConversionConfig);
      await usdcConverter3.setConversionConfig(usdc.address, usdt.address, ConversionConfig);
      await btcConverter.setConversionConfig(btc.address, eth.address, ConversionConfig);
    });

    it("should return array containing converters when multiple same base asset converters exist", async () => {
      let converters;
      [converters] = await converterNetwork.callStatic.findTokenConvertersForConverters(usdc.address, usdt.address);
      expect(converters).have.length(1);
      expect(converters).to.include(usdcConverter.address);

      [converters] = await converterNetwork.callStatic.findTokenConvertersForConverters(usdt.address, usdc.address);
      expect(converters).have.length(1);
      expect(converters).to.include(usdtConverter.address);
    });

    it("should return correct values with multiple when multiple same base asset converters exist", async () => {
      await usdcConverter2.setConverterNetwork(converterNetwork.address);
      await usdcConverter3.setConverterNetwork(converterNetwork.address);
      await usdtConverter2.setConverterNetwork(converterNetwork.address);
      await usdtConverter3.setConverterNetwork(converterNetwork.address);
      await usdtConverter4.setConverterNetwork(converterNetwork.address);

      await converterNetwork.addTokenConverter(usdcConverter2.address);
      await converterNetwork.addTokenConverter(usdcConverter3.address);
      await converterNetwork.addTokenConverter(usdtConverter2.address);
      await converterNetwork.addTokenConverter(usdtConverter3.address);
      await converterNetwork.addTokenConverter(usdtConverter4.address);

      let converters, convertersBalance;

      [converters, convertersBalance] = await converterNetwork.callStatic.findTokenConvertersForConverters(
        usdt.address,
        usdc.address,
      );
      expect(converters).to.have.length(4);
      expect(converters).to.be.deep.equal([
        usdtConverter.address,
        usdtConverter2.address,
        usdtConverter3.address,
        usdtConverter4.address,
      ]);
      expect(convertersBalance).to.be.deep.equal([0, 0, 0, 0]);

      [converters, convertersBalance] = await converterNetwork.callStatic.findTokenConvertersForConverters(
        usdc.address,
        usdt.address,
      );
      expect(converters).to.have.length(3);
      expect(converters).to.be.deep.equal([usdcConverter.address, usdcConverter2.address, usdcConverter3.address]);

      // sending some tokens with different amounts to converters
      await usdc.faucet(parseUnits("1000", 18));
      await usdc.transfer(usdtConverter.address, parseUnits("150", 18));
      await usdc.transfer(usdtConverter2.address, parseUnits("100", 18));
      await usdc.transfer(usdtConverter3.address, parseUnits("50", 18));
      await usdc.transfer(usdtConverter4.address, parseUnits("360", 18));

      // now ConverterNetwork should return array with descending token balances
      [converters, convertersBalance] = await converterNetwork.callStatic.findTokenConvertersForConverters(
        usdt.address,
        usdc.address,
      );
      expect(converters).to.have.length(4);
      expect(converters).to.be.deep.equal([
        usdtConverter4.address,
        usdtConverter.address,
        usdtConverter2.address,
        usdtConverter3.address,
      ]);
      expect(convertersBalance).to.be.deep.equal([
        parseUnits("360", 18),
        parseUnits("150", 18),
        parseUnits("100", 18),
        parseUnits("50", 18),
      ]);
    });

    it("should not return address of caller when called by another token converter", async () => {
      await impersonateAccount(usdtConverter.address);
      usdtConverterSigner = await ethers.getSigner(usdtConverter.address);

      await usdtConverter2.setConverterNetwork(converterNetwork.address);
      await usdtConverter3.setConverterNetwork(converterNetwork.address);
      await usdtConverter4.setConverterNetwork(converterNetwork.address);

      await converterNetwork.addTokenConverter(usdtConverter2.address);
      await converterNetwork.addTokenConverter(usdtConverter3.address);
      await converterNetwork.addTokenConverter(usdtConverter4.address);

      const [converters] = await converterNetwork
        .connect(usdtConverterSigner)
        .callStatic.findTokenConvertersForConverters(usdt.address, usdc.address);
      expect(converters).to.not.include(usdtConverter.address);
    });
  });
});
