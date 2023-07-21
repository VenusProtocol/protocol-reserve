import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";

import {
  IAccessControlManagerV8,
  MockDeflatingToken,
  MockDeflatingToken__factory,
  MockRiskFundTransformer,
  MockRiskFundTransformer__factory,
  MockToken,
  MockToken__factory,
  ResilientOracleInterface,
  XVSVaultTreasury,
} from "../../typechain";
import { convertToUnit } from "../utils";

const { expect } = chai;
chai.use(smock.matchers);

let accessControl: FakeContract<IAccessControlManagerV8>;
let transformer: MockContract<MockRiskFundTransformer>;
let tokenIn: MockContract<MockToken>;
let tokenOut: MockContract<MockToken>;
let oracle: FakeContract<ResilientOracleInterface>;
let xvsVaultTreasury: FakeContract<XVSVaultTreasury>;
let tokenInDeflationary: MockContract<MockDeflatingToken>;

async function fixture(): Promise<void> {
  const transformerFactory = await smock.mock<MockRiskFundTransformer__factory>("MockRiskFundTransformer");

  xvsVaultTreasury = await smock.fake<XVSVaultTreasury>("XVSVaultTreasury");

  accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  oracle = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  const MockTokenDeflationary = await smock.mock<MockDeflatingToken__factory>("MockDeflatingToken");
  tokenIn = await MockToken.deploy("TokenIn", "tokenIn", 18);
  await tokenIn.faucet(parseUnits("1000", 18));

  tokenInDeflationary = await MockTokenDeflationary.deploy(parseUnits("1000", 18));

  tokenOut = await MockToken.deploy("TokenOut", "tokenOut", 18);
  await tokenOut.faucet(parseUnits("1000", 18));

  transformer = await transformerFactory.deploy();
  await transformer.initialize(accessControl.address, oracle.address, xvsVaultTreasury.address);
}

describe("XVS vault Transformer: tests", () => {
  before(async function () {
    await loadFixture(fixture);
  });

  it("Check balanceOf transformer for different tokens", async () => {
    const TOKEN_IN_AMOUNT = convertToUnit(10, 18);
    const TOKEN_OUT_AMOUNT = convertToUnit(20, 18);
    const DEFLATIONARY_AMOUNT = convertToUnit(30, 18);
    await tokenIn.transfer(transformer.address, TOKEN_IN_AMOUNT);
    await tokenOut.transfer(transformer.address, TOKEN_OUT_AMOUNT);
    await tokenInDeflationary.transfer(transformer.address, DEFLATIONARY_AMOUNT);

    expect(await transformer.balanceOf(tokenIn.address)).to.equals(TOKEN_IN_AMOUNT);
    expect(await transformer.balanceOf(tokenOut.address)).to.equals(TOKEN_OUT_AMOUNT);
    expect(await transformer.balanceOf(tokenInDeflationary.address)).to.equals("29700000000000000000");
  });
});
