import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Signer, constants } from "ethers";
import { parseUnits } from "ethers/lib/utils.js";
import { ethers } from "hardhat";

import { convertToUnit } from "../../helpers/utils";
import {
  IAccessControlManagerV8,
  IComptroller,
  IShortfall,
  MockToken,
  MockToken__factory,
  RiskFundConverter,
  RiskFundV2,
  RiskFundV2__factory,
} from "../../typechain";

let riskFundConverter: FakeContract<RiskFundConverter>;
let shortfall: FakeContract<IShortfall>;
let riskFund: MockContract<RiskFundV2>;
let tokenA: MockContract<MockToken>;
let admin: SignerWithAddress;
let nonAdmin: Signer;
let comptrollerA: FakeContract<IComptroller>;
let acm: FakeContract<IAccessControlManagerV8>;

const riskFundFixture = async (): Promise<void> => {
  [admin, nonAdmin] = await ethers.getSigners();

  const RiskFund = await smock.mock<RiskFundV2__factory>("RiskFundV2");
  riskFund = await RiskFund.deploy();

  shortfall = await smock.fake<IShortfall>("IShortfall");
  riskFundConverter = await smock.fake<RiskFundConverter>("RiskFundConverter");
  comptrollerA = await smock.fake<IComptroller>("IComptroller");
  acm = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  tokenA = await MockToken.deploy("TokenA", "tokenA", 18);
  await tokenA.faucet(parseUnits("1000", 18));

  await riskFund.setVariable("_owner", await admin.getAddress());
  await riskFund.setVariable("riskFundConverter", riskFundConverter.address);
  await riskFund.setVariable("shortfall", shortfall.address);
  await riskFund.setVariable("_accessControlManager", acm.address);

  acm.isAllowedToCall.reset();
  acm.isAllowedToCall.returns(true);
};

describe("Risk Fund: Tests", function () {
  beforeEach(async function () {
    await loadFixture(riskFundFixture);
    acm.isAllowedToCall.reset();
    acm.isAllowedToCall.returns(true);
  });

  describe("Test all setters", async function () {
    describe("setConvertibleBaseAsset", async function () {
      it("reverts on invalid base address", async function () {
        await expect(
          riskFund.connect(admin).setConvertibleBaseAsset(constants.AddressZero),
        ).to.be.revertedWithCustomError(riskFund, "ZeroAddressNotAllowed");
      });

      it("fails if called by a non-owner", async function () {
        await expect(riskFund.connect(nonAdmin).setConvertibleBaseAsset(tokenA.address)).to.be.revertedWith(
          "Ownable: caller is not the owner",
        );
      });

      it("emits ConvertibleBaseAssetUpdated event", async function () {
        const tx = riskFund.connect(admin).setConvertibleBaseAsset(tokenA.address);
        await expect(tx)
          .to.emit(riskFund, "ConvertibleBaseAssetUpdated")
          .withArgs(constants.AddressZero, tokenA.address);
      });
    });

    describe("setShortfallContractAddress", async function () {
      it("Reverts on invalid Auction contract address", async function () {
        await expect(riskFund.setShortfallContractAddress(constants.AddressZero)).to.be.revertedWithCustomError(
          riskFund,
          "ZeroAddressNotAllowed",
        );
      });

      it("fails if called by a non-owner", async function () {
        await expect(riskFund.connect(nonAdmin).setShortfallContractAddress(shortfall.address)).to.be.revertedWith(
          "Ownable: caller is not the owner",
        );
      });

      it("emits ShortfallContractUpdated event", async function () {
        const newShortfall = await smock.fake<IShortfall>("IShortfall");
        const tx = riskFund.setShortfallContractAddress(newShortfall.address);
        await expect(tx)
          .to.emit(riskFund, "ShortfallContractUpdated")
          .withArgs(shortfall.address, newShortfall.address);
      });
    });
  });

  describe("transferReserveForAuction: Transfer to Auction contract", async function () {
    beforeEach(async () => {
      await riskFund.setVariable("shortfall", await admin.getAddress());
      await riskFund.connect(admin).setConvertibleBaseAsset(tokenA.address);
    });

    it("reverts for non-shortfall caller", async function () {
      await expect(
        riskFund.connect(nonAdmin).transferReserveForAuction(comptrollerA.address, convertToUnit(30, 18)),
      ).to.be.revertedWithCustomError(riskFund, "InvalidShortfallAddress");
    });

    it("reverts when amount exceeds contract balance", async function () {
      await expect(
        riskFund.connect(admin).transferReserveForAuction(comptrollerA.address, convertToUnit(100, 18)),
      ).to.be.revertedWithCustomError(riskFund, "InsufficientBalance");
    });

    it("transfers from contract balance to shortfall and emits TransferredReserveForAuction", async function () {
      const COMPTROLLER_A_AMOUNT = convertToUnit(30, 18);

      await tokenA.transfer(riskFund.address, COMPTROLLER_A_AMOUNT);

      // `shortfall` state variable was set to admin.address in the parent beforeEach
      // so the transferReserveForAuction caller check passes when called from admin.
      const transferAmount = convertToUnit(20, 18);
      const tx = riskFund.connect(admin).transferReserveForAuction(comptrollerA.address, transferAmount);

      await expect(tx).to.emit(riskFund, "TransferredReserveForAuction").withArgs(comptrollerA.address, transferAmount);
      await expect(tx).to.changeTokenBalances(
        tokenA,
        [riskFund.address, await admin.getAddress()],
        ["-20000000000000000000", "20000000000000000000"],
      );
    });
  });

  describe("sweepToken", () => {
    const DEPOSIT = convertToUnit(10, 18);

    beforeEach(async () => {
      await riskFund.connect(admin).setConvertibleBaseAsset(tokenA.address);
      await tokenA.transfer(riskFund.address, DEPOSIT);
    });

    it("reverts when amount exceeds balance", async () => {
      await expect(
        riskFund.sweepToken(tokenA.address, await admin.getAddress(), parseUnits("1000", 18)),
      ).to.be.revertedWithCustomError(riskFund, "InsufficientBalance");
    });

    it("reverts when token address is zero", async () => {
      await expect(
        riskFund.sweepToken(constants.AddressZero, await admin.getAddress(), parseUnits("1", 18)),
      ).to.be.revertedWithCustomError(riskFund, "ZeroAddressNotAllowed");
    });

    it("reverts when recipient is zero", async () => {
      await expect(
        riskFund.sweepToken(tokenA.address, constants.AddressZero, parseUnits("1", 18)),
      ).to.be.revertedWithCustomError(riskFund, "ZeroAddressNotAllowed");
    });

    it("reverts when amount is zero", async () => {
      await expect(riskFund.sweepToken(tokenA.address, await admin.getAddress(), 0)).to.be.revertedWithCustomError(
        riskFund,
        "ZeroValueNotAllowed",
      );
    });

    it("fails if called by a non-owner", async () => {
      await expect(
        riskFund.connect(nonAdmin).sweepToken(tokenA.address, await admin.getAddress(), 1000),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("transfers tokens to recipient and emits SweepToken", async () => {
      const recipient = await admin.getAddress();
      await expect(riskFund.sweepToken(tokenA.address, recipient, 1000))
        .to.emit(riskFund, "SweepToken")
        .withArgs(tokenA.address, recipient, 1000);
    });
  });
});
