import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { impersonateAccount, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
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
  RiskFundConverter,
  RiskFundV2,
  RiskFundV2__factory,
} from "../../typechain";

let riskFundConverter: FakeContract<RiskFundConverter>;
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
  riskFundConverter = await smock.fake<RiskFundConverter>("RiskFundConverter");
  comptrollerA = await smock.fake<IComptroller>("IComptroller");

  const MockToken = await smock.mock<MockToken__factory>("MockToken");
  tokenA = await MockToken.deploy("TokenA", "tokenA", 18);
  await tokenA.faucet(parseUnits("1000", 18));

  await riskFund.setVariable("_owner", await admin.getAddress());
  await riskFund.setVariable("riskFundConverter", riskFundConverter.address);
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

    describe("setRiskFundConverter", async function () {
      it("reverts on invalid converter address", async function () {
        await expect(riskFund.setRiskFundConverter(constants.AddressZero)).to.be.revertedWithCustomError(
          riskFund,
          "ZeroAddressNotAllowed",
        );
      });

      it("fails if called by a non-owner", async function () {
        await expect(riskFund.connect(nonAdmin).setRiskFundConverter(riskFundConverter.address)).to.be.revertedWith(
          "Ownable: caller is not the owner",
        );
      });

      it("emits RiskFundConverterUpdated event", async function () {
        const newConverter = await smock.fake<RiskFundConverter>("RiskFundConverter");
        const tx = riskFund.setRiskFundConverter(newConverter.address);
        await expect(tx)
          .to.emit(riskFund, "RiskFundConverterUpdated")
          .withArgs(riskFundConverter.address, newConverter.address);
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
      await riskFund.setVariable("poolAssetsFunds", {
        [comptrollerA.address]: { [tokenA.address]: COMPTROLLER_A_AMOUNT },
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
      const beforePoolReserve = await riskFund.poolAssetsFunds(comptrollerA.address, tokenA.address);

      await riskFund.setVariable("riskFundConverter", await admin.getAddress());
      await riskFund.connect(admin).updatePoolState(comptrollerA.address, tokenA.address, COMPTROLLER_A_AMOUNT);

      const afterPoolReserve = await riskFund.poolAssetsFunds(comptrollerA.address, tokenA.address);
      expect(afterPoolReserve).equals(String(Number(beforePoolReserve) + Number(COMPTROLLER_A_AMOUNT)));
    });
  });

  describe("SweepTokens", () => {
    let riskFundConverterSigner: Signer;
    const COMPTROLLER_A_AMOUNT: string = convertToUnit(10, 18);

    beforeEach(async () => {
      await riskFund.connect(admin).setConvertibleBaseAsset(tokenA.address);

      await tokenA.transfer(riskFund.address, COMPTROLLER_A_AMOUNT);
    });

    it("Transfer sweep tokens to (to) address", async () => {
      await impersonateAccount(riskFundConverter.address);
      riskFundConverterSigner = await ethers.getSigner(riskFundConverter.address);
      await admin.sendTransaction({ to: riskFundConverter.address, value: ethers.utils.parseEther("10") });

      await riskFund
        .connect(riskFundConverterSigner)
        .updatePoolState(comptrollerA.address, tokenA.address, COMPTROLLER_A_AMOUNT);

      await expect(riskFund.sweepToken(tokenA.address, await admin.getAddress(), 1000)).to.changeTokenBalances(
        tokenA,
        [await riskFund.owner(), riskFund.address],
        [1000, -1000],
      );
    });

    it("Transfer untracked token to (to) address", async () => {
      await expect(riskFund.sweepToken(tokenA.address, await admin.getAddress(), 1000)).to.changeTokenBalances(
        tokenA,
        [await riskFund.owner(), riskFund.address],
        [1000, -1000],
      );
    });
  });
});
