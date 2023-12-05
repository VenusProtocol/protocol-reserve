import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "bignumber.js";
import chai from "chai";
import { Signer } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import {
  IAccessControlManagerV8,
  IComptroller,
  IConverterNetwork,
  IPoolRegistry,
  IVToken,
  MockDeflatingToken,
  MockDeflatingToken__factory,
  MockRiskFundConverter,
  MockRiskFundConverter__factory,
  MockToken,
  MockToken__factory,
  ResilientOracle,
  RiskFundV2,
} from "../../typechain";
import { convertToUnit } from "../utils";

const { expect } = chai;
chai.use(smock.matchers);

let accessControl: FakeContract<IAccessControlManagerV8>;
let converter: MockContract<MockRiskFundConverter>;
let tokenIn: MockContract<MockToken>;
let tokenOut: MockContract<MockToken>;
let oracle: FakeContract<ResilientOracle>;
let poolRegistry: FakeContract<IPoolRegistry>;
let newPoolRegistry: FakeContract<IPoolRegistry>;
let riskFund: FakeContract<RiskFundV2>;
let converterNetwork: FakeContract<IConverterNetwork>;
let tokenInDeflationary: MockContract<MockDeflatingToken>;
let unKnown: Signer;
let corePool: FakeContract<IComptroller>;
let poolA: FakeContract<IComptroller>;
let poolB: FakeContract<IComptroller>;
let poolC: FakeContract<IComptroller>;
let vToken: FakeContract<IVToken>;
let vBNB: FakeContract<IVToken>;
let WBNB: FakeContract<MockToken>;

async function fixture(): Promise<void> {
  [, unKnown] = await ethers.getSigners();

  poolRegistry = await smock.fake<IPoolRegistry>("IPoolRegistry");
  const converterFactory = await smock.mock<MockRiskFundConverter__factory>("MockRiskFundConverter");

  riskFund = await smock.fake<RiskFundV2>("RiskFundV2");
  corePool = await smock.fake<IComptroller>("IComptroller");
  poolA = await smock.fake<IComptroller>("IComptroller");
  poolB = await smock.fake<IComptroller>("IComptroller");
  poolC = await smock.fake<IComptroller>("IComptroller");
  vToken = await smock.fake<IVToken>("IVToken");
  vBNB = await smock.fake<IVToken>("IVToken");
  WBNB = await smock.fake<MockToken>("MockToken");

  accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  oracle = await smock.fake<ResilientOracle>("ResilientOracle");
  converterNetwork = await smock.fake<IConverterNetwork>("IConverterNetwork");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  const MockTokenDeflationary = await smock.mock<MockDeflatingToken__factory>("MockDeflatingToken");
  tokenIn = await MockToken.deploy("TokenIn", "tokenIn", 18);
  await tokenIn.faucet(parseUnits("1000", 18));

  tokenInDeflationary = await MockTokenDeflationary.deploy(parseUnits("1000", 18));

  tokenOut = await MockToken.deploy("TokenOut", "tokenOut", 18);
  await tokenOut.faucet(parseUnits("1000", 18));

  converter = await upgrades.deployProxy(
    converterFactory,
    [
      accessControl.address,
      oracle.address,
      riskFund.address,
      poolRegistry.address,
      [poolA.address],
      [[tokenIn.address]],
      [[true]],
    ],
    {
      Contract: converterFactory,
      initializer: "initialize",
      unsafeAllow: "constructor",
      constructorArgs: [corePool.address, vBNB.address, WBNB.address],
    },
  );

  await converter.setConverterNetwork(converterNetwork.address);
}

describe("Risk fund Converter: tests", () => {
  before(async function () {
    await loadFixture(fixture);
  });

  it("Post tokens convert", async () => {
    const POOL_A_AMOUNT = convertToUnit(10, 18);
    const POOL_B_AMOUNT = convertToUnit(20, 18);
    const POOL_C_AMOUNT = convertToUnit(30, 18);
    const CORE_POOL_AMOUNT = convertToUnit(40, 18);
    const TOTAL_ASSESTS_RESERVES = convertToUnit(100, 18);
    const AMOUNT_IN = convertToUnit(20, 18);
    const AMOUNT_OUT = convertToUnit(18, 18);

    await tokenOut.transfer(poolA.address, POOL_A_AMOUNT);
    await tokenOut.transfer(poolB.address, POOL_B_AMOUNT);
    await tokenOut.transfer(poolC.address, POOL_C_AMOUNT);
    await tokenOut.transfer(corePool.address, CORE_POOL_AMOUNT);
    vToken.underlying.returns(tokenOut.address);
    corePool.getAllMarkets.returns([vToken.address]);

    await converter.setPoolsAssetsReserves(poolA.address, tokenOut.address, POOL_A_AMOUNT);
    await converter.setPoolsAssetsReserves(poolB.address, tokenOut.address, POOL_B_AMOUNT);
    await converter.setPoolsAssetsReserves(poolC.address, tokenOut.address, POOL_C_AMOUNT);
    await converter.setPoolsAssetsReserves(corePool.address, tokenOut.address, CORE_POOL_AMOUNT);

    poolRegistry.getPoolsSupportedByAsset.returns([poolA.address, poolB.address, poolC.address]);
    await converter.setAssetsReserves(tokenOut.address, TOTAL_ASSESTS_RESERVES);
    await converter.preTransferHookMock(tokenOut.address, AMOUNT_OUT);
    await converter.postConversionHookMock(tokenIn.address, tokenOut.address, AMOUNT_IN, AMOUNT_OUT);

    const poolAShare = new BigNumber(POOL_A_AMOUNT).dividedBy(TOTAL_ASSESTS_RESERVES).multipliedBy(AMOUNT_OUT);
    const poolBShare = new BigNumber(POOL_B_AMOUNT).dividedBy(TOTAL_ASSESTS_RESERVES).multipliedBy(AMOUNT_OUT);
    const poolCShare = new BigNumber(POOL_C_AMOUNT).dividedBy(TOTAL_ASSESTS_RESERVES).multipliedBy(AMOUNT_OUT);
    const corePoolShare = new BigNumber(CORE_POOL_AMOUNT).dividedBy(TOTAL_ASSESTS_RESERVES).multipliedBy(AMOUNT_OUT);

    expect(await converter.callStatic.getAssetsReserves(tokenOut.address)).to.equals(
      String(Number(TOTAL_ASSESTS_RESERVES) - Number(AMOUNT_OUT)),
    );
    expect(await converter.callStatic.getPoolsAssetsReserves(poolA.address, tokenOut.address)).to.closeTo(
      String(Number(POOL_A_AMOUNT) - Number(poolAShare)),
      1000,
    );
    expect(await converter.callStatic.getPoolsAssetsReserves(poolB.address, tokenOut.address)).to.closeTo(
      String(Number(POOL_B_AMOUNT) - Number(poolBShare)),
      1500,
    );
    expect(await converter.callStatic.getPoolsAssetsReserves(poolC.address, tokenOut.address)).to.closeTo(
      String(Number(POOL_C_AMOUNT) - Number(poolCShare)),
      1000,
    );
    expect(await converter.callStatic.getPoolsAssetsReserves(corePool.address, tokenOut.address)).to.closeTo(
      String(Number(CORE_POOL_AMOUNT) - Number(corePoolShare)),
      1000,
    );
  });

  it("Reverts on invalid PoolRegistry address", async function () {
    await expect(converter.setPoolRegistry(ethers.constants.AddressZero)).to.be.revertedWithCustomError(
      converter,
      "ZeroAddressNotAllowed",
    );
  });

  it("Fails if called by a non-owner", async function () {
    await expect(converter.connect(unKnown).setPoolRegistry(poolRegistry.address)).to.be.revertedWith(
      "Ownable: caller is not the owner",
    );
  });

  it("Emits PoolRegistryUpdated on success", async function () {
    newPoolRegistry = await smock.fake<IPoolRegistry>("IPoolRegistry");
    const tx = converter.setPoolRegistry(newPoolRegistry.address);
    await expect(tx).to.emit(converter, "PoolRegistryUpdated").withArgs(poolRegistry.address, newPoolRegistry.address);
  });

  it("Check balanceOf converter for different tokens", async () => {
    const TOKEN_IN_AMOUNT = convertToUnit(10, 18);
    const TOKEN_OUT_AMOUNT = convertToUnit(20, 18);
    const DEFLATIONARY_AMOUNT = convertToUnit(30, 18);

    await converter.setAssetsReserves(tokenIn.address, TOKEN_IN_AMOUNT);
    await converter.setAssetsReserves(tokenOut.address, TOKEN_OUT_AMOUNT);
    await converter.setAssetsReserves(tokenInDeflationary.address, parseUnits("297", 17));

    expect(await converter.balanceOf(tokenIn.address)).to.equals(TOKEN_IN_AMOUNT);
    expect(await converter.balanceOf(tokenOut.address)).to.equals(TOKEN_OUT_AMOUNT);
    expect(await converter.balanceOf(tokenInDeflationary.address)).to.equals("29700000000000000000");
  });

  it("Reverts on sweepToken() when amount entered is higher than balance", async () => {
    await expect(
      converter.sweepToken(tokenIn.address, await unKnown.getAddress(), parseUnits("1000", 18)),
    ).to.be.revertedWithCustomError(converter, "InsufficientBalance");
  });

  it("Revert for non existing asset for the pool", async () => {
    const [, fakeComptroller, fakeAsset] = await ethers.getSigners();

    await expect(converter.getPoolAssetReserve(corePool.address, fakeAsset.address)).to.be.revertedWithCustomError(
      converter,
      "MarketNotExistInPool",
    );

    await expect(converter.getPoolAssetReserve(fakeComptroller.address, tokenIn.address)).to.be.revertedWithCustomError(
      converter,
      "MarketNotExistInPool",
    );

    await expect(converter.updateAssetsState(fakeComptroller.address, tokenIn.address)).to.be.revertedWithCustomError(
      converter,
      "MarketNotExistInPool",
    );

    await expect(converter.updateAssetsState(corePool.address, fakeAsset.address)).to.be.revertedWithCustomError(
      converter,
      "MarketNotExistInPool",
    );
  });

  describe("Pools direct transfer", () => {
    it("Revert on invalid access control", async () => {
      await accessControl.isAllowedToCall.returns(false);

      await expect(
        converter.setPoolsAssetsDirectTransfer([poolA.address], [[tokenIn.address]], [[true]]),
      ).to.be.revertedWithCustomError(converter, "Unauthorized");
    });

    it("Success on the setPoolsAssetsDirectTransfer", async () => {
      await accessControl.isAllowedToCall.returns(true);

      await expect(converter.setPoolsAssetsDirectTransfer([poolA.address], [[tokenIn.address]], [[true]]))
        .to.emit(converter, "PoolAssetsDirectTransferUpdated")
        .withArgs(poolA.address, tokenIn.address, true);

      expect(await converter.poolsAssetsDirectTransfer(poolA.address, tokenIn.address)).to.equal(true);
    });

    it("Transfer funds to riskFund directly", async () => {
      poolA.isComptroller.returns(true);

      await converter.setAssetsReserves(tokenIn.address, 0);
      const POOL_A_AMOUNT = convertToUnit(10, 18);
      newPoolRegistry.getVTokenForAsset.returns(poolA.address);

      expect(await tokenIn.balanceOf(riskFund.address)).to.equal(0);
      expect(await tokenIn.balanceOf(converter.address)).to.equal(0);
      await tokenIn.transfer(converter.address, POOL_A_AMOUNT);
      await converter.setPoolsAssetsDirectTransfer([poolA.address], [[tokenIn.address]], [[true]]);
      await converter.updateAssetsState(poolA.address, tokenIn.address);

      expect(await tokenIn.balanceOf(converter.address)).to.equal(0);
      expect(await tokenIn.balanceOf(riskFund.address)).to.equal(POOL_A_AMOUNT);
      expect(await converter.getAssetsReserves(tokenIn.address)).to.equal(0);
    });

    it("Revert on invalid parameters", async () => {
      await accessControl.isAllowedToCall.returns(true);

      await expect(
        converter.setPoolsAssetsDirectTransfer(
          [poolA.address, poolB.address],
          [[tokenIn.address], [tokenIn.address]],
          [[true]],
        ),
      ).to.be.revertedWithCustomError(converter, "InvalidArguments");

      await expect(
        converter.setPoolsAssetsDirectTransfer([poolA.address], [[tokenIn.address], [tokenIn.address]], [[true]]),
      ).to.be.revertedWithCustomError(converter, "InvalidArguments");

      await expect(
        converter.setPoolsAssetsDirectTransfer([poolA.address], [[tokenIn.address, tokenIn.address]], [[true]]),
      ).to.be.revertedWithCustomError(converter, "InvalidArguments");

      await expect(
        converter.setPoolsAssetsDirectTransfer([poolA.address], [[tokenIn.address]], [[true, true]]),
      ).to.be.revertedWithCustomError(converter, "InvalidArguments");
    });
  });

  describe("Converting function", () => {
    const amount = convertToUnit("200", 18);
    const amountTransferred = convertToUnit("50", 18);
    const TOKEN_IN_PRICE = convertToUnit("1", 18);
    const TOKEN_OUT_PRICE = convertToUnit("0.5", 18);
    const INCENTIVE = convertToUnit("1", 17);

    beforeEach(async () => {
      newPoolRegistry.getPoolsSupportedByAsset.returns([poolC.address]);

      await converter.setPoolsAssetsReserves(poolC.address, tokenIn.address, 0);
      await converter.setPoolsAssetsReserves(poolC.address, tokenOut.address, 0);
      await converter.setPoolsAssetsReserves(corePool.address, tokenIn.address, 0);
      await converter.setPoolsAssetsReserves(corePool.address, tokenOut.address, 0);
      await converter.setAssetsReserves(tokenIn.address, 0);
      await converter.setAssetsReserves(tokenOut.address, 0);

      await tokenIn.faucet(amount);
      await tokenOut.faucet(amount);
      await tokenIn.transfer(converter.address, amount);
      await tokenOut.transfer(converter.address, amount);

      await converter.updateAssetsState(poolC.address, tokenIn.address);
      await converter.updateAssetsState(poolC.address, tokenOut.address);
    });

    it("Should update states correctly on conversion of tokens", async () => {
      const [admin] = await ethers.getSigners();

      expect(await converter.getAssetsReserves(tokenIn.address)).to.equal(amount);
      expect(await converter.getAssetsReserves(tokenOut.address)).to.equal(amount);
      await expect(await converter.getPoolAssetReserve(poolC.address, tokenOut.address)).to.equal(amount);
      await expect(await converter.getPoolAssetReserve(poolC.address, tokenIn.address)).to.equal(amount);

      await riskFund.convertibleBaseAsset.returns(tokenIn.address);

      const ConversionConfig = {
        incentive: INCENTIVE,
        conversionAccess: 1,
      };
      await converter.connect(admin).setConversionConfig(tokenIn.address, tokenOut.address, ConversionConfig);

      await oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
      await oracle.getPrice.whenCalledWith(tokenOut.address).returns(TOKEN_OUT_PRICE);

      const expectedResults = await converter.callStatic.getUpdatedAmountOut(
        amountTransferred,
        tokenIn.address,
        tokenOut.address,
      );

      await tokenIn.approve(converter.address, amountTransferred);
      await converter.convertExactTokens(
        amountTransferred,
        convertToUnit(".5", 18),
        tokenIn.address,
        tokenOut.address,
        await unKnown.getAddress(),
      );
      await expect(await converter.getAssetsReserves(tokenOut.address)).to.equal(
        BigNumber(amount).minus(Number(expectedResults[1])),
      );
      await expect(await converter.getAssetsReserves(tokenIn.address)).to.equal(amount);
      await expect(await converter.getPoolAssetReserve(poolC.address, tokenOut.address)).to.equal(
        BigNumber(amount).minus(Number(expectedResults[1])),
      );
      await expect(await converter.getPoolAssetReserve(poolC.address, tokenIn.address)).to.equal(amount);
    });
  });
});
