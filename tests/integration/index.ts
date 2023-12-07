import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { Address } from "hardhat-deploy/dist/types";

import {
  ConverterNetwork,
  ConverterNetwork__factory,
  IAccessControlManagerV8,
  IComptroller,
  IPoolRegistry,
  IVToken,
  MockRiskFundConverter,
  MockRiskFundConverter__factory,
  MockToken,
  MockToken__factory,
  ResilientOracle,
  RiskFundV2,
  SingleTokenConverter,
  SingleTokenConverter__factory,
} from "../../typechain";
import { convertToUnit } from "../utils";

const { expect } = chai;
chai.use(smock.matchers);

let accessControl: FakeContract<IAccessControlManagerV8>;
let oracle: FakeContract<ResilientOracle>;
let usdcConverter: MockContract<SingleTokenConverter>;
let usdcConverter2: MockContract<SingleTokenConverter>;
let usdcConverter3: MockContract<SingleTokenConverter>;
let usdcConverter4: MockContract<SingleTokenConverter>;
let usdtConverter: MockContract<SingleTokenConverter>;
let usdtConverter2: MockContract<SingleTokenConverter>;
let riskFundConverter: MockContract<MockRiskFundConverter>;
let converterNetwork: MockContract<ConverterNetwork>;
let usdc: MockContract<MockToken>;
let usdt: MockContract<MockToken>;
let riskFund: FakeContract<RiskFundV2>;
let poolRegistry: FakeContract<IPoolRegistry>;
let corePool: FakeContract<IComptroller>;
let poolA: FakeContract<IComptroller>;
let vBNB: FakeContract<IVToken>;
let WBNB: FakeContract<MockToken>;

let destinationAddress: Address;
let ConversionConfig: {
  incentive: string;
  conversionAccess: number;
};

const INCENTIVE = convertToUnit("1", 17);
const TOKEN_IN_PRICE = convertToUnit("0.5", 18); // usdc price
const TOKEN_OUT_PRICE = convertToUnit("1", 18); // usdt price

async function deployConverter(token: string) {
  const converterFactory = await smock.mock<SingleTokenConverter__factory>("SingleTokenConverter");

  const converter = await upgrades.deployProxy(converterFactory, [
    accessControl.address,
    oracle.address,
    destinationAddress,
    token,
  ]);

  return converter;
}

async function fixture(): Promise<void> {
  const [, , detinationSigner] = await ethers.getSigners();
  destinationAddress = detinationSigner.address;

  poolRegistry = await smock.fake<IPoolRegistry>("IPoolRegistry");
  const converterFactory = await smock.mock<MockRiskFundConverter__factory>("MockRiskFundConverter");

  riskFund = await smock.fake<RiskFundV2>("RiskFundV2");
  corePool = await smock.fake<IComptroller>("IComptroller");
  poolA = await smock.fake<IComptroller>("IComptroller");
  vBNB = await smock.fake<IVToken>("IVToken");
  WBNB = await smock.fake<MockToken>("MockToken");

  accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  oracle = await smock.fake<ResilientOracle>("ResilientOracle");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  usdc = await MockToken.deploy("USDC", "usdc", 18);
  usdt = await MockToken.deploy("USDC", "usdc", 18);

  usdcConverter = await deployConverter(usdc.address);
  usdcConverter2 = await deployConverter(usdc.address);
  usdcConverter3 = await deployConverter(usdc.address);
  usdcConverter4 = await deployConverter(usdc.address);
  usdtConverter = await deployConverter(usdt.address);
  usdtConverter2 = await deployConverter(usdt.address);

  riskFundConverter = await upgrades.deployProxy(
    converterFactory,
    [
      accessControl.address,
      oracle.address,
      riskFund.address,
      poolRegistry.address,
      [poolA.address],
      [[usdt.address]],
      [[true]],
    ],
    {
      Contract: converterFactory,
      initializer: "initialize",
      unsafeAllow: "constructor",
      constructorArgs: [corePool.address, vBNB.address, WBNB.address],
    },
  );
  await poolRegistry.getVTokenForAsset.returns(poolA.address);

  await accessControl.isAllowedToCall.returns(true);

  await riskFund.riskFundConverter.returns(riskFundConverter.address);
  await riskFund.convertibleBaseAsset.returns(usdt.address);

  const converterNetworkFactory = await smock.mock<ConverterNetwork__factory>("ConverterNetwork");
  converterNetwork = await upgrades.deployProxy(converterNetworkFactory, [accessControl.address, 20]);

  await usdcConverter.setConverterNetwork(converterNetwork.address);
  await usdcConverter2.setConverterNetwork(converterNetwork.address);
  await usdcConverter3.setConverterNetwork(converterNetwork.address);
  await usdcConverter4.setConverterNetwork(converterNetwork.address);
  await riskFundConverter.setConverterNetwork(converterNetwork.address);
  await usdtConverter.setConverterNetwork(converterNetwork.address);
  await usdtConverter2.setConverterNetwork(converterNetwork.address);

  await converterNetwork.addTokenConverter(usdcConverter.address);
  await converterNetwork.addTokenConverter(usdcConverter2.address);
  await converterNetwork.addTokenConverter(usdcConverter3.address);
  await converterNetwork.addTokenConverter(usdcConverter4.address);
  await converterNetwork.addTokenConverter(usdtConverter.address);
  await converterNetwork.addTokenConverter(usdtConverter2.address);
  await converterNetwork.addTokenConverter(riskFundConverter.address);

  ConversionConfig = {
    incentive: INCENTIVE,
    conversionAccess: 1,
  };

  await usdcConverter.setConversionConfig(usdc.address, usdt.address, ConversionConfig);
  await usdcConverter2.setConversionConfig(usdc.address, usdt.address, ConversionConfig);
  await usdcConverter3.setConversionConfig(usdc.address, usdt.address, ConversionConfig);
  await usdcConverter4.setConversionConfig(usdc.address, usdt.address, ConversionConfig);

  await riskFundConverter.setConversionConfig(usdt.address, usdc.address, ConversionConfig);
  await usdtConverter.setConversionConfig(usdt.address, usdc.address, ConversionConfig);
  await usdtConverter2.setConversionConfig(usdt.address, usdc.address, ConversionConfig);

  await oracle.getPrice.whenCalledWith(usdc.address).returns(TOKEN_IN_PRICE);
  await oracle.getPrice.whenCalledWith(usdt.address).returns(TOKEN_OUT_PRICE);
}

describe("ConverterNetwork: tests", () => {
  beforeEach(async () => {
    await loadFixture(fixture);
  });

  it("private conversions should not execute when base asset is transferred by PSR to converter", async () => {
    await usdt.faucet(parseUnits("100", 18));

    await usdt.transfer(riskFundConverter.address, parseUnits("100", 18));
    await riskFundConverter.updateAssetsState(poolA.address, usdt.address);

    expect(await usdt.balanceOf(riskFund.address)).to.equal(parseUnits("100", 18));
  });

  it("private conversions should execute but will not be able to convert any token when all converters have zero token balance", async () => {
    await usdc.faucet(parseUnits("100", 18));

    await usdc.transfer(riskFundConverter.address, parseUnits("100", 18));
    await riskFundConverter.updateAssetsState(poolA.address, usdc.address);

    expect(await usdc.balanceOf(riskFundConverter.address)).to.equal(parseUnits("100", 18));
    expect(await riskFundConverter.getAssetsReserves(usdc.address)).to.equal(parseUnits("100", 18));
    expect(await riskFundConverter.getPoolAssetReserve(poolA.address, usdc.address)).to.equal(parseUnits("100", 18));
  });

  it("private conversion should be completed when different converters exist with same base asset and sufficient token balance to convert all received tokens", async () => {
    await usdt.faucet(parseUnits("10000", 18));

    await usdt.transfer(usdcConverter.address, parseUnits("300", 18));
    await usdt.transfer(usdcConverter2.address, parseUnits("1000", 18));
    await usdt.transfer(usdcConverter3.address, parseUnits("2000", 18));
    await usdt.transfer(usdcConverter4.address, parseUnits("1500", 18));

    await usdcConverter.updateAssetsState(poolA.address, usdc.address);
    await usdcConverter2.updateAssetsState(poolA.address, usdc.address);
    await usdcConverter3.updateAssetsState(poolA.address, usdc.address);
    await usdcConverter4.updateAssetsState(poolA.address, usdc.address);

    await usdc.faucet(parseUnits("3000", 18));
    await usdc.transfer(riskFundConverter.address, parseUnits("3000", 18));
    await riskFundConverter.updateAssetsState(poolA.address, usdc.address);

    // As other converters only have a total of 1300 tokens which means 2600 tokens should be converted from riskFundConverter
    // as 1 usdt = 2 usdc
    expect(await usdc.balanceOf(riskFundConverter.address)).to.equal(0);
    expect(await riskFundConverter.getPoolAssetReserve(poolA.address, usdc.address)).to.equal(0);
    expect(await riskFundConverter.getAssetsReserves(usdc.address)).to.equal(0);
  });

  it("private conversion should be completed when different converters exists with same base asset but non-sufficient token balance to partially convert received tokens", async () => {
    await usdt.faucet(parseUnits("10000", 18));
    await usdt.transfer(usdcConverter.address, parseUnits("300", 18));
    await usdt.transfer(usdcConverter2.address, parseUnits("1000", 18));

    await usdcConverter.updateAssetsState(poolA.address, usdc.address);
    await usdcConverter2.updateAssetsState(poolA.address, usdc.address);

    // verifying private conversion for riskFundConverter(base asset usdt)
    await usdc.faucet(parseUnits("3000", 18));
    await usdc.transfer(riskFundConverter.address, parseUnits("3000", 18));
    await riskFundConverter.updateAssetsState(poolA.address, usdc.address);

    // As other converters only have a total of 1300 tokens which means 2600 tokens should be converted from riskFundConverter
    // as 1 usdt = 2 usdc
    expect(await usdc.balanceOf(riskFundConverter.address)).to.equal(parseUnits("400", 18));
    expect(await riskFundConverter.getPoolAssetReserve(poolA.address, usdc.address)).to.equal(parseUnits("400", 18));
    expect(await riskFundConverter.getAssetsReserves(usdc.address)).to.equal(parseUnits("400", 18));

    // creating same scenario with SingleTokenConverter, picking up usdcConverter now
    // please keep in mind that riskFundConverter already has `400` usdc tokens due to previous private conversion
    await usdc.faucet(parseUnits("1000", 18));
    await usdc.transfer(riskFundConverter.address, parseUnits("300", 18));
    await usdc.transfer(usdtConverter.address, parseUnits("400", 18));
    await usdc.transfer(usdtConverter2.address, parseUnits("300", 18));

    await riskFundConverter.updateAssetsState(poolA.address, usdc.address);
    await usdtConverter.updateAssetsState(poolA.address, usdc.address);
    await usdtConverter2.updateAssetsState(poolA.address, usdc.address);

    const [, balances] = await converterNetwork.callStatic.findTokenConvertersForConverters(usdt.address, usdc.address);

    let totalBalanceOfAllConvertersForUsdc = BigNumber.from(0);

    for (let i = 0; i < balances.length; i++) {
      totalBalanceOfAllConvertersForUsdc = totalBalanceOfAllConvertersForUsdc.add(balances[i]);
    }

    // amount that should be converted by private conversion should equal totalBalanceOfAllConvertersForUsdc * 2
    await usdt.faucet(parseUnits("5000", 18));
    await usdt.transfer(usdcConverter.address, parseUnits("5000", 18));

    // verifying private conversion for usdcConverter(base asset usdc)
    await usdcConverter.updateAssetsState(poolA.address, usdt.address);

    expect(await usdt.balanceOf(usdcConverter.address)).to.equal(
      parseUnits("5000", 18).sub(totalBalanceOfAllConvertersForUsdc.div(2)),
    );
  });
});
