import { FakeContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

import { convertToUnit } from "../helpers/utils";
import { ComptrollerInterface, IRiskFund, MockToken, PoolRegistryInterface, ProtocolShareReserve } from "../typechain";

let mockDAI: MockToken;
let fakeRiskFund: FakeContract<IRiskFund>;
let poolRegistry: FakeContract<PoolRegistryInterface>;
let fakeProtocolIncome: FakeContract<IRiskFund>;
let fakeComptroller: FakeContract<ComptrollerInterface>;
let protocolShareReserve: ProtocolShareReserve;

const fixture = async (): Promise<void> => {
  const MockDAI = await ethers.getContractFactory("MockToken");
  mockDAI = await MockDAI.deploy("MakerDAO", "DAI", 18);
  await mockDAI.faucet(convertToUnit(1000, 18));

  // Fake contracts
  fakeRiskFund = await smock.fake<IRiskFund>("IRiskFund");
  await fakeRiskFund.updateAssetsState.returns();

  poolRegistry = await smock.fake<PoolRegistryInterface>("PoolRegistryInterface");
  poolRegistry.getVTokenForAsset.returns("0x0000000000000000000000000000000000000001");

  fakeProtocolIncome = await smock.fake<IRiskFund>("IRiskFund");
  fakeComptroller = await smock.fake<ComptrollerInterface>("ComptrollerInterface");

  // ProtocolShareReserve contract deployment
  const ProtocolShareReserve = await ethers.getContractFactory("ProtocolShareReserve");
  protocolShareReserve = await upgrades.deployProxy(ProtocolShareReserve, [
    fakeProtocolIncome.address,
    fakeRiskFund.address,
  ]);

  await protocolShareReserve.setPoolRegistry(poolRegistry.address);
};

describe("ProtocolShareReserve: Tests", function () {
  /**
   * Deploying required contracts along with the poolRegistry.
   */

  before(async function () {
    await loadFixture(fixture);
  });

});
