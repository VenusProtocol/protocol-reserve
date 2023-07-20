import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Signer, constants } from "ethers";
import { parseUnits } from "ethers/lib/utils.js";
import { ethers } from "hardhat";

import { convertToUnit } from "../../helpers/utils";
import {
  IComptroller,
  IShortfall,
  MockToken,
  MockToken__factory,
  RiskFundTransformer,
  RiskFundV2,
  RiskFundV2__factory,
} from "../../typechain";

let riskFundTransformer: FakeContract<RiskFundTransformer>;
let shortfall: FakeContract<IShortfall>;
let riskFund: MockContract<RiskFundV2>;
let tokenA: MockContract<MockToken>;
let admin: Signer;
let nonAdmin: Signer;
let bidder: Signer;
let comptrollerA: FakeContract<IComptroller>;

const riskFundFixture = async (): Promise<void> => {
  [admin, nonAdmin, bidder] = await ethers.getSigners();

  const RiskFund = await smock.mock<RiskFundV2__factory>("RiskFundV2");
  riskFund = await RiskFund.deploy();

  shortfall = await smock.fake<IShortfall>("IShortfall");
  riskFundTransformer = await smock.fake<RiskFundTransformer>("RiskFundTransformer");
  comptrollerA = await smock.fake<IComptroller>("IComptroller");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  tokenA = await MockToken.deploy("TokenA", "tokenA", 18);
  await tokenA.faucet(parseUnits("1000", 18));

  await riskFund.setVariable("_owner", await admin.getAddress());
  await riskFund.setVariable("riskFundTransformer", riskFundTransformer.address);
  await riskFund.setVariable("shortfall", shortfall.address);
};

describe("Risk Fund: Tests", function () {
  beforeEach(async function () {
    await loadFixture(riskFundFixture);
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

    describe("setRiskFundTransformer", async function () {
      it("reverts on invalid transformer address", async function () {
        await expect(riskFund.setRiskFundTransformer(constants.AddressZero)).to.be.revertedWithCustomError(
          riskFund,
          "ZeroAddressNotAllowed",
        );
      });

      it("fails if called by a non-owner", async function () {
        await expect(riskFund.connect(nonAdmin).setRiskFundTransformer(riskFundTransformer.address)).to.be.revertedWith(
          "Ownable: caller is not the owner",
        );
      });

      it("emits RiskFundTransformerUpdated event", async function () {
        const newTransformer = await smock.fake<RiskFundTransformer>("RiskFundTransformer");
        const tx = riskFund.setRiskFundTransformer(newTransformer.address);
        await expect(tx)
          .to.emit(riskFund, "RiskFundTransformerUpdated")
          .withArgs(riskFundTransformer.address, newTransformer.address);
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

    it("Revert while transfering funds to Auction contract", async function () {
      await expect(
        riskFund
          .connect(nonAdmin)
          .transferReserveForAuction(comptrollerA.address, await bidder.getAddress(), convertToUnit(30, 18)),
      ).to.be.revertedWithCustomError(riskFund, "InvalidShortfallAddress");

      await expect(
        riskFund
          .connect(admin)
          .transferReserveForAuction(comptrollerA.address, await bidder.getAddress(), convertToUnit(100, 18)),
      ).to.be.revertedWithCustomError(riskFund, "InsufficientPoolReserve");
    });

    it("Transfer funds to auction contact", async function () {
      const COMPTROLLER_A_AMOUNT = convertToUnit(30, 18);

      await tokenA.transfer(riskFund.address, COMPTROLLER_A_AMOUNT);
      await riskFund.setVariable("poolReserves", {
        [comptrollerA.address]: COMPTROLLER_A_AMOUNT,
      });

      const tx = riskFund
        .connect(admin)
        .transferReserveForAuction(comptrollerA.address, await bidder.getAddress(), convertToUnit(20, 18));

      await expect(tx).to.changeTokenBalances(
        tokenA,
        [riskFund.address, await bidder.getAddress()],
        ["-20000000000000000000", "20000000000000000000"],
      );
    });
  });

  describe("updatePoolState: Update pools states after getting funds", () => {
    it(" Update pool reserves", async () => {
      const COMPTROLLER_A_AMOUNT = convertToUnit(10, 18);
      const beforePoolReserve = await riskFund.poolReserves(comptrollerA.address);

      await riskFund.setVariable("riskFundTransformer", await admin.getAddress());
      await riskFund.connect(admin).updatePoolState(comptrollerA.address, COMPTROLLER_A_AMOUNT);

      const afterPoolReserve = await riskFund.poolReserves(comptrollerA.address);
      expect(afterPoolReserve).equals(String(Number(beforePoolReserve) + Number(COMPTROLLER_A_AMOUNT)));
    });
  });
});
