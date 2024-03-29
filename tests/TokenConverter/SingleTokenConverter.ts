import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import {
  IAccessControlManagerV8,
  IConverterNetwork,
  MockDeflatingToken,
  MockDeflatingToken__factory,
  MockToken,
  MockToken__factory,
  ResilientOracleInterface,
  SingleTokenConverter,
  SingleTokenConverter__factory,
  XVSVaultTreasury,
} from "../../typechain";
import { convertToUnit } from "../utils";

const { expect } = chai;
chai.use(smock.matchers);

let accessControl: FakeContract<IAccessControlManagerV8>;
let converter: MockContract<SingleTokenConverter>;
let tokenIn: MockContract<MockToken>;
let tokenOut: MockContract<MockToken>;
let xvs: MockContract<MockToken>;
let oracle: FakeContract<ResilientOracleInterface>;
let converterNetwork: FakeContract<IConverterNetwork>;
let xvsVaultTreasury: FakeContract<XVSVaultTreasury>;
let tokenInDeflationary: MockContract<MockDeflatingToken>;

const MIN_AMOUNT_TO_CONVERT = convertToUnit("1", 18);

async function fixture(): Promise<void> {
  const converterFactory = await smock.mock<SingleTokenConverter__factory>("SingleTokenConverter");

  xvsVaultTreasury = await smock.fake<XVSVaultTreasury>("XVSVaultTreasury");

  accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  oracle = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
  converterNetwork = await smock.fake<IConverterNetwork>("IConverterNetwork");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  const MockTokenDeflationary = await smock.mock<MockDeflatingToken__factory>("MockDeflatingToken");
  tokenIn = await MockToken.deploy("TokenIn", "tokenIn", 18);
  await tokenIn.faucet(parseUnits("1000", 18));

  tokenInDeflationary = await MockTokenDeflationary.deploy(parseUnits("1000", 18));

  tokenOut = await MockToken.deploy("TokenOut", "tokenOut", 18);
  await tokenOut.faucet(parseUnits("1000", 18));

  xvs = await MockToken.deploy("XVS", "xvs", 18);
  await xvs.faucet(parseUnits("1000", 18));

  converter = await upgrades.deployProxy(converterFactory, [
    accessControl.address,
    oracle.address,
    xvsVaultTreasury.address,
    xvs.address,
    MIN_AMOUNT_TO_CONVERT,
  ]);

  await converter.setConverterNetwork(converterNetwork.address);
}

describe("XVS vault Converter: tests", () => {
  before(async function () {
    await loadFixture(fixture);
  });

  it("Check balanceOf converter for different tokens", async () => {
    const TOKEN_IN_AMOUNT = convertToUnit(10, 18);
    const TOKEN_OUT_AMOUNT = convertToUnit(20, 18);
    const DEFLATIONARY_AMOUNT = convertToUnit(30, 18);
    await tokenIn.transfer(converter.address, TOKEN_IN_AMOUNT);
    await tokenOut.transfer(converter.address, TOKEN_OUT_AMOUNT);
    await tokenInDeflationary.transfer(converter.address, DEFLATIONARY_AMOUNT);

    expect(await converter.balanceOf(tokenIn.address)).to.equals(TOKEN_IN_AMOUNT);
    expect(await converter.balanceOf(tokenOut.address)).to.equals(TOKEN_OUT_AMOUNT);
    expect(await converter.balanceOf(tokenInDeflationary.address)).to.equals("29700000000000000000");
  });

  it("Transfer XVS to Treasury after updateAssetsState", async () => {
    const [, fakeComptroller] = await ethers.getSigners();
    const XVS_AMOUNT = convertToUnit(10, 18);

    await xvs.transfer(converter.address, XVS_AMOUNT);

    expect(await converter.balanceOf(xvs.address)).to.equals(XVS_AMOUNT);

    await converter.updateAssetsState(fakeComptroller.address, xvs.address);
    expect(await converter.balanceOf(xvs.address)).to.equals(0);
    expect(await xvs.balanceOf(xvsVaultTreasury.address)).to.equals(XVS_AMOUNT);
  });

  describe("setBaseAsset", () => {
    it("Should revert when zero address is set", async () => {
      await expect(converter.setBaseAsset(await ethers.constants.AddressZero)).to.be.revertedWithCustomError(
        converter,
        "ZeroAddressNotAllowed",
      );
    });

    it("Should revert when called by non owner", async () => {
      const [, nonOwner] = await ethers.getSigners();

      await expect(converter.connect(nonOwner).setBaseAsset(await ethers.constants.AddressZero)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Should set base asset successfully", async () => {
      const [, unknownAddress] = await ethers.getSigners();

      await expect(converter.setBaseAsset(unknownAddress.address))
        .to.emit(converter, "BaseAssetUpdated")
        .withArgs(xvs.address, unknownAddress.address);
    });
  });
});
