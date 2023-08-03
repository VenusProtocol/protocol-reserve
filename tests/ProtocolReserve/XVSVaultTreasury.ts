import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { Signer, constants } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import {
  IAccessControlManagerV8,
  IXVSVault,
  MockToken,
  MockToken__factory,
  XVSVaultTreasury,
  XVSVaultTreasury__factory,
} from "../../typechain";
import { convertToUnit } from "../utils";

const { expect } = chai;
chai.use(smock.matchers);

const FUND_XVS_AMOUNT = convertToUnit(10, 18);

let accessControl: FakeContract<IAccessControlManagerV8>;
let xvsVaultTreasury: MockContract<XVSVaultTreasury>;
let xvsVault: FakeContract<IXVSVault>;
let xvs: MockContract<MockToken>;
let nonAdmin: Signer;
let xvsStore: Signer;

async function fixture(): Promise<void> {
  [, nonAdmin, xvsStore] = await ethers.getSigners();
  const XVSVaultTreasury = await smock.mock<XVSVaultTreasury__factory>("XVSVaultTreasury");

  accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  xvsVault = await smock.fake<IXVSVault>("IXVSVault");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  xvs = await MockToken.deploy("XVS", "xvs", 18);
  await xvs.faucet(parseUnits("1000", 18));

  xvsVaultTreasury = await XVSVaultTreasury.deploy();

  await xvsVaultTreasury.initialize(accessControl.address, xvsVault.address, xvs.address);
}

describe("XVS vault treasury: tests", () => {
  beforeEach(async function () {
    await loadFixture(fixture);
  });

  describe("setXVSVault", async function () {
    it("reverts on invalid vault address", async function () {
      await expect(xvsVaultTreasury.setXVSVault(constants.AddressZero)).to.be.revertedWithCustomError(
        xvsVaultTreasury,
        "ZeroAddressNotAllowed",
      );
    });

    it("fails if called by a non-owner", async function () {
      await expect(xvsVaultTreasury.connect(nonAdmin).setXVSVault(xvsVaultTreasury.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("emits XVSVaultUpdated event", async function () {
      const newTreasury = await smock.fake<XVSVaultTreasury>("XVSVaultTreasury");
      const tx = xvsVaultTreasury.setXVSVault(newTreasury.address);
      await expect(tx).to.emit(xvsVaultTreasury, "XVSVaultUpdated").withArgs(xvsVault.address, newTreasury.address);
    });
  });

  describe("setXVSAddress", async function () {
    it("Reverts on invalid Auction contract address", async function () {
      await expect(xvsVaultTreasury.setXVSAddress(constants.AddressZero)).to.be.revertedWithCustomError(
        xvsVaultTreasury,
        "ZeroAddressNotAllowed",
      );
    });

    it("fails if called by a non-owner", async function () {
      await expect(xvsVaultTreasury.connect(nonAdmin).setXVSAddress(xvs.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("emits XVSAddressUpdated event", async function () {
      const newXVS = await smock.fake<MockToken>("MockToken");
      const tx = xvsVaultTreasury.setXVSAddress(newXVS.address);
      await expect(tx).to.emit(xvsVaultTreasury, "XVSAddressUpdated").withArgs(xvs.address, newXVS.address);
    });
  });

  describe("Transfer funds to XVSStore", () => {
    it("Revert on not access", async () => {
      await expect(xvsVaultTreasury.fundXVSVault(FUND_XVS_AMOUNT)).to.be.revertedWithCustomError(
        xvsVaultTreasury,
        "Unauthorized",
      );
    });

    it("Revert on Insufficent balance", async () => {
      accessControl.isAllowedToCall.returns(true);
      await expect(xvsVaultTreasury.fundXVSVault(FUND_XVS_AMOUNT)).to.be.revertedWithCustomError(
        xvsVaultTreasury,
        "InsufficientBalance",
      );
    });

    it("Transfer amount to XVSStore", async () => {
      const xvsStoreAddress = await xvsStore.getAddress();
      accessControl.isAllowedToCall.returns(true);
      await xvs.transfer(xvsVaultTreasury.address, FUND_XVS_AMOUNT);
      await xvsVault.xvsStore.returns(xvsStoreAddress);
      const tx = xvsVaultTreasury.fundXVSVault(FUND_XVS_AMOUNT);

      await expect(tx).to.changeTokenBalances(
        xvs,
        [xvsVaultTreasury.address, xvsStoreAddress],
        ["-10000000000000000000", "10000000000000000000"],
      );

      await expect(tx).to.emit(xvsVaultTreasury, "FundsTransferredToXVSStore");
    });
  });
});
