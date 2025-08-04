import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

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
let whitelistedTokenIn: MockContract<MockToken>;
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

  whitelistedTokenIn = await MockToken.deploy("WhitelistedTokenIn", "whitelistedTokenIn", 18);
  await whitelistedTokenIn.faucet(parseUnits("1000", 18));

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
  beforeEach(async function () {
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

  describe("Assets direct transfer", () => {
    it("Revert on invalid access control", async () => {
      await accessControl.isAllowedToCall.returns(false);

      await expect(
        converter.setAssetsDirectTransfer([whitelistedTokenIn.address], [true]),
      ).to.be.revertedWithCustomError(converter, "Unauthorized");
    });

    it("Success on the setAssetsDirectTransfer", async () => {
      await accessControl.isAllowedToCall.returns(true);

      await expect(converter.setAssetsDirectTransfer([whitelistedTokenIn.address], [true]))
        .to.emit(converter, "AssetsDirectTransferUpdated")
        .withArgs(xvsVaultTreasury.address, whitelistedTokenIn.address, true);

      expect(await converter.assetsDirectTransfer(whitelistedTokenIn.address)).to.equal(true);
    });

    it("Transfer funds to treasury directly when using whitelisted token", async () => {
      const [, fakeComptroller] = await ethers.getSigners();
      const whitelistedTokenAmount = convertToUnit(10, 18);

      expect(await whitelistedTokenIn.balanceOf(xvsVaultTreasury.address)).to.equal(0);
      expect(await whitelistedTokenIn.balanceOf(converter.address)).to.equal(0);
      await whitelistedTokenIn.transfer(converter.address, whitelistedTokenAmount);
      await converter.setAssetsDirectTransfer([whitelistedTokenIn.address], [true]);
      await converter.updateAssetsState(fakeComptroller.address, whitelistedTokenIn.address);

      expect(await whitelistedTokenIn.balanceOf(converter.address)).to.equal(0);
      expect(await whitelistedTokenIn.balanceOf(xvsVaultTreasury.address)).to.equal(whitelistedTokenAmount);
    });

    it("Revert on invalid parameters lengths", async () => {
      await accessControl.isAllowedToCall.returns(true);

      await expect(
        converter.setAssetsDirectTransfer([whitelistedTokenIn.address, whitelistedTokenIn.address], [true]),
      ).to.be.revertedWithCustomError(converter, "InputLengthMisMatch");

      await expect(
        converter.setAssetsDirectTransfer([whitelistedTokenIn.address], [true, true]),
      ).to.be.revertedWithCustomError(converter, "InputLengthMisMatch");
    });
  });

  describe("setBaseAsset", () => {
    it("Should revert on non-owner call", async () => {
      const [, user] = await ethers.getSigners();
      await expect(converter.connect(user).setBaseAsset(tokenIn.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Should revert on zero address", async () => {
      await expect(converter.setBaseAsset(ethers.constants.AddressZero)).to.be.revertedWithCustomError(
        converter,
        "ZeroAddressNotAllowed",
      );
    });

    it("Should succeed on updating existing base asset", async () => {
      await converter.setBaseAsset(tokenIn.address);
      expect(await converter.baseAsset()).to.equal(tokenIn.address);

      const tx = await converter.setBaseAsset(tokenOut.address);
      expect(tx).to.emit(converter, "BaseAssetUpdated").withArgs(tokenIn.address, tokenOut.address);

      expect(await converter.baseAsset()).to.equal(tokenOut.address);
    });

    it("Should succeed on setting same base asset multiple times", async () => {
      await converter.setBaseAsset(tokenIn.address);
      expect(await converter.baseAsset()).to.equal(tokenIn.address);

      const tx = await converter.setBaseAsset(tokenIn.address);
      expect(tx).to.emit(converter, "BaseAssetUpdated").withArgs(tokenIn.address, tokenIn.address);

      expect(await converter.baseAsset()).to.equal(tokenIn.address);
    });
  });

  describe("balanceOf", () => {
    it("Should return zero for token not in contract", async () => {
      expect(await converter.balanceOf(tokenIn.address)).to.equal(0);
      expect(await converter.balanceOf(tokenOut.address)).to.equal(0);
    });

    it("Should return correct balance for single token", async () => {
      const amount = convertToUnit(100, 18);
      await tokenIn.transfer(converter.address, amount);

      expect(await converter.balanceOf(tokenIn.address)).to.equal(amount);
      expect(await converter.balanceOf(tokenOut.address)).to.equal(0);
    });

    it("Should return correct balances for multiple tokens", async () => {
      const tokenInAmount = convertToUnit(50, 18);
      const tokenOutAmount = convertToUnit(75, 18);
      const xvsAmount = convertToUnit(25, 18);

      await tokenIn.transfer(converter.address, tokenInAmount);
      await tokenOut.transfer(converter.address, tokenOutAmount);
      await xvs.transfer(converter.address, xvsAmount);

      expect(await converter.balanceOf(tokenIn.address)).to.equal(tokenInAmount);
      expect(await converter.balanceOf(tokenOut.address)).to.equal(tokenOutAmount);
      expect(await converter.balanceOf(xvs.address)).to.equal(xvsAmount);
    });

    it("Should handle zero address token with no revert", async () => {
      await expect(converter.balanceOf(ethers.constants.AddressZero)).to.be.reverted;
    });
  });
});
