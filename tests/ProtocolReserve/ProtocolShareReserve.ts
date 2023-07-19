import { FakeContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

import { convertToUnit } from "../../helpers/utils";
import { IComptroller, IPoolRegistry, IRiskFundTransformer, MockToken, ProtocolShareReserve } from "../../typechain";

let mockDAI: MockToken;
let fakeRiskFundTransformer: FakeContract<IRiskFundTransformer>;
let poolRegistry: FakeContract<IPoolRegistry>;
let fakeProtocolIncome: FakeContract<IRiskFundTransformer>;
let fakeComptroller: FakeContract<IComptroller>;
let protocolShareReserve: ProtocolShareReserve;

const fixture = async (): Promise<void> => {
  const MockDAI = await ethers.getContractFactory("MockToken");
  mockDAI = await MockDAI.deploy("MakerDAO", "DAI", 18);
  await mockDAI.faucet(convertToUnit(1000, 18));

  // Fake contracts
  fakeRiskFundTransformer = await smock.fake<IRiskFundTransformer>("IRiskFundTransformer");

  poolRegistry = await smock.fake<IPoolRegistry>("IPoolRegistry");
  poolRegistry.getVTokenForAsset.returns("0x0000000000000000000000000000000000000001");

  fakeProtocolIncome = await smock.fake<IRiskFundTransformer>("IRiskFundTransformer");
  fakeComptroller = await smock.fake<IComptroller>("IComptroller");

  // ProtocolShareReserve contract deployment
  const ProtocolShareReserve = await ethers.getContractFactory("ProtocolShareReserve");
  protocolShareReserve = await upgrades.deployProxy(ProtocolShareReserve, [fakeProtocolIncome.address]);

  await protocolShareReserve.setPoolRegistry(poolRegistry.address);
  await protocolShareReserve.setRiskFundTransformer(fakeRiskFundTransformer.address);
};

describe("ProtocolShareReserve: Tests", function () {
  /**
   * Deploying required contracts along with the poolRegistry.
   */

  before(async function () {
    await loadFixture(fixture);
  });

  it("Revert on invalid asset address.", async function () {
    await expect(
      protocolShareReserve.releaseFunds(fakeComptroller.address, "0x0000000000000000000000000000000000000000", 10),
    ).to.be.revertedWithCustomError(protocolShareReserve, "ZeroAddressNotAllowed");
  });

  it("Revert on Insufficient balance.", async function () {
    await expect(
      protocolShareReserve.releaseFunds(
        fakeComptroller.address, // Mock comptroller address
        mockDAI.address,
        10,
      ),
    ).to.be.rejectedWith("ProtocolShareReserve: Insufficient pool balance");
  });

  it("Release liquidated share reserve", async function () {
    await mockDAI.transfer(protocolShareReserve.address, convertToUnit(100, 18));

    fakeComptroller.isComptroller.returns(true);
    await protocolShareReserve.updateAssetsState(
      fakeComptroller.address, // Mock comptroller address
      mockDAI.address,
    );

    const balance = await mockDAI.balanceOf(protocolShareReserve.address);

    expect(balance).equal(convertToUnit(100, 18));

    let protocolUSDT = await protocolShareReserve.getPoolAssetReserve(fakeComptroller.address, mockDAI.address);

    expect(protocolUSDT).equal(convertToUnit(100, 18));

    await protocolShareReserve.releaseFunds(
      fakeComptroller.address, // Mock comptroller address
      mockDAI.address,
      convertToUnit(90, 18),
    );

    protocolUSDT = await protocolShareReserve.getPoolAssetReserve(fakeComptroller.address, mockDAI.address);

    expect(protocolUSDT).equal(convertToUnit(10, 18));

    const riskFundBal = await mockDAI.balanceOf(fakeRiskFundTransformer.address);
    const liquidatedShareBal = await mockDAI.balanceOf(fakeProtocolIncome.address);
    const protocolShareReserveBal = await mockDAI.balanceOf(protocolShareReserve.address);

    expect(riskFundBal).equal(convertToUnit(27, 18));
    expect(liquidatedShareBal).equal(convertToUnit(63, 18));
    expect(protocolShareReserveBal).equal(convertToUnit(10, 18));
  });
});
