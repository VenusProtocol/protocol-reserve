import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "bignumber.js";
import chai from "chai";
import { Signer } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import {
  IAccessControlManagerV8,
  IPoolRegistry,
  MockDeflatingToken,
  MockDeflatingToken__factory,
  MockRiskFundConverter,
  MockRiskFundConverter__factory,
  MockToken,
  MockToken__factory,
  ResilientOracleInterface,
  RiskFundV2,
} from "../../typechain";
import { convertToUnit } from "../utils";

const { expect } = chai;
chai.use(smock.matchers);

let accessControl: FakeContract<IAccessControlManagerV8>;
let converter: MockContract<MockRiskFundConverter>;
let tokenIn: MockContract<MockToken>;
let tokenOut: MockContract<MockToken>;
let oracle: FakeContract<ResilientOracleInterface>;
let poolRegistry: FakeContract<IPoolRegistry>;
let riskFund: FakeContract<RiskFundV2>;
let tokenInDeflationary: MockContract<MockDeflatingToken>;
let unKnown: Signer;
let corePool: Signer;

async function fixture(): Promise<void> {
  [, unKnown, corePool] = await ethers.getSigners();
  poolRegistry = await smock.fake<IPoolRegistry>("IPoolRegistry");
  const converterFactory = await smock.mock<MockRiskFundConverter__factory>("MockRiskFundConverter");

  riskFund = await smock.fake<RiskFundV2>("RiskFundV2");

  accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  oracle = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  const MockTokenDeflationary = await smock.mock<MockDeflatingToken__factory>("MockDeflatingToken");
  tokenIn = await MockToken.deploy("TokenIn", "tokenIn", 18);
  await tokenIn.faucet(parseUnits("1000", 18));

  tokenInDeflationary = await MockTokenDeflationary.deploy(parseUnits("1000", 18));

  tokenOut = await MockToken.deploy("TokenOut", "tokenOut", 18);
  await tokenOut.faucet(parseUnits("1000", 18));

  converter = await converterFactory.deploy(await corePool.getAddress());
  await converter.initialize(accessControl.address, oracle.address, riskFund.address);
}

describe("Risk fund Converter: tests", () => {
  before(async function () {
    await loadFixture(fixture);
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
    const tx = converter.setPoolRegistry(poolRegistry.address);
    await expect(tx)
      .to.emit(converter, "PoolRegistryUpdated")
      .withArgs(ethers.constants.AddressZero, poolRegistry.address);
  });

  it("Check balanceOf converter for different tokens", async () => {
    const TOKEN_IN_AMOUNT = convertToUnit(10, 18);
    const TOKEN_OUT_AMOUNT = convertToUnit(20, 18);
    const DEFLATIONARY_AMOUNT = convertToUnit(30, 18);
    await converter.setVariable("assetsReserves", {
      [tokenIn.address]: TOKEN_IN_AMOUNT,
      [tokenOut.address]: TOKEN_OUT_AMOUNT,
      [tokenInDeflationary.address]: "29700000000000000000",
    });

    expect(await converter.balanceOf(tokenIn.address)).to.equals(TOKEN_IN_AMOUNT);
    expect(await converter.balanceOf(tokenOut.address)).to.equals(TOKEN_OUT_AMOUNT);
    expect(await converter.balanceOf(tokenInDeflationary.address)).to.equals("29700000000000000000");
  });

  it("Post tokens convert", async () => {
    const POOL_A_AMOUNT = convertToUnit(10, 18);
    const POOL_B_AMOUNT = convertToUnit(20, 18);
    const POOL_C_AMOUNT = convertToUnit(30, 18);
    const CORE_POOL_AMOUNT = convertToUnit(40, 18);
    const TOTAL_ASSESTS_RESERVES = convertToUnit(100, 18);
    const AMOUNT_IN = convertToUnit(20, 18);
    const AMOUNT_OUT = convertToUnit(18, 18);
    const [, , , poolA, poolB, poolC] = await ethers.getSigners();

    await tokenIn.transfer(poolA.address, POOL_A_AMOUNT);
    await tokenIn.transfer(poolB.address, POOL_B_AMOUNT);
    await tokenIn.transfer(poolC.address, POOL_C_AMOUNT);
    await tokenIn.transfer(await corePool.getAddress(), CORE_POOL_AMOUNT);

    await converter.setVariable("poolsAssetsReserves", {
      [poolA.address]: {
        [tokenIn.address]: POOL_A_AMOUNT,
      },
      [poolB.address]: {
        [tokenIn.address]: POOL_B_AMOUNT,
      },
      [poolC.address]: {
        [tokenIn.address]: POOL_C_AMOUNT,
      },
      [await corePool.getAddress()]: {
        [tokenIn.address]: CORE_POOL_AMOUNT,
      },
    });
    poolRegistry.getPoolsSupportedByAsset.returns([
      await poolA.getAddress(),
      await poolB.getAddress(),
      await poolC.getAddress(),
    ]);
    await converter.setAssetsReserves(tokenIn.address, TOTAL_ASSESTS_RESERVES);
    await converter.postConversionHookMock(tokenIn.address, tokenOut.address, AMOUNT_IN, AMOUNT_OUT);

    const poolAShare = new BigNumber(POOL_A_AMOUNT).dividedBy(TOTAL_ASSESTS_RESERVES).multipliedBy(AMOUNT_IN);
    const poolBShare = new BigNumber(POOL_B_AMOUNT).dividedBy(TOTAL_ASSESTS_RESERVES).multipliedBy(AMOUNT_IN);
    const poolCShare = new BigNumber(POOL_C_AMOUNT).dividedBy(TOTAL_ASSESTS_RESERVES).multipliedBy(AMOUNT_IN);
    const corePoolShare = new BigNumber(CORE_POOL_AMOUNT).dividedBy(TOTAL_ASSESTS_RESERVES).multipliedBy(AMOUNT_IN);

    expect(await converter.callStatic.getAssetsReserves(tokenIn.address)).to.equals(
      String(Number(TOTAL_ASSESTS_RESERVES) - Number(AMOUNT_IN)),
    );
    expect(await converter.callStatic.getPoolsAssetsReserves(poolA.address, tokenIn.address)).to.closeTo(
      String(Number(POOL_A_AMOUNT) - Number(poolAShare)),
      1000,
    );
    expect(await converter.callStatic.getPoolsAssetsReserves(poolB.address, tokenIn.address)).to.closeTo(
      String(Number(POOL_B_AMOUNT) - Number(poolBShare)),
      1500,
    );
    expect(await converter.callStatic.getPoolsAssetsReserves(poolC.address, tokenIn.address)).to.closeTo(
      String(Number(POOL_C_AMOUNT) - Number(poolCShare)),
      1000,
    );
    expect(await converter.callStatic.getPoolsAssetsReserves(await corePool.getAddress(), tokenIn.address)).to.closeTo(
      String(Number(CORE_POOL_AMOUNT) - Number(corePoolShare)),
      1000,
    );
  });
});
