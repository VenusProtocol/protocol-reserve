import { FakeContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

import { convertToUnit } from "../helpers/utils";
import {
  ComptrollerInterface,
  IAccessControlManagerV8,
  IIncomeDestination,
  MockToken,
  PoolRegistryInterface,
  ProtocolShareReserve,
} from "../typechain";

const SCHEMA_PROTOCOL_RESERVE = 0;
const SCHEMA_ADDITIONAL_REVENUE = 1;

const SPREAD_INCOME = 0;
const LIQUIDATION_INCOME = 1;

const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";

type SetupProtocolShareReserveFixture = {
  mockDAI: MockToken;
  mockUSDC: MockToken;
  mockUSDT: MockToken;
  riskFundSwapper: FakeContract<IIncomeDestination>;
  dao: FakeContract<IIncomeDestination>;
  poolRegistry: FakeContract<PoolRegistryInterface>;
  protocolShareReserve: ProtocolShareReserve;
  xvsVaultSwapper: FakeContract<IIncomeDestination>;
  corePoolComptroller: FakeContract<ComptrollerInterface>;
  isolatedPoolComptroller: FakeContract<ComptrollerInterface>;
};

const fixture = async (): Promise<SetupProtocolShareReserveFixture> => {
  const MockDAI = await ethers.getContractFactory("MockToken");
  const mockDAI = await MockDAI.deploy("MakerDAO", "DAI", 18);
  await mockDAI.faucet(convertToUnit(1000, 18));

  const MockUSDC = await ethers.getContractFactory("MockToken");
  const mockUSDC = await MockUSDC.deploy("USD Coin", "USDC", 18);
  await mockUSDC.faucet(convertToUnit(1000, 18));

  const MockUSDT = await ethers.getContractFactory("MockToken");
  const mockUSDT = await MockUSDT.deploy("Tether Coin", "USDT", 18);
  await mockUSDT.faucet(convertToUnit(1000, 18));

  const MockWBNB = await ethers.getContractFactory("MockToken");
  const mockWBNB = await MockWBNB.deploy("BNB Coin", "WBNB", 18);
  await mockWBNB.faucet(convertToUnit(1000, 18));

  const MockVBNB = await ethers.getContractFactory("MockToken");
  const mockVBNB = await MockVBNB.deploy("vBNB Market", "vBNB", 18);
  await mockVBNB.faucet(convertToUnit(1000, 18));

  const corePoolComptroller = await smock.fake<ComptrollerInterface>("ComptrollerInterface");
  const isolatedPoolComptroller = await smock.fake<ComptrollerInterface>("ComptrollerInterface");
  const riskFundSwapper = await smock.fake<IIncomeDestination>("IIncomeDestination");
  const dao = await smock.fake<IIncomeDestination>("IIncomeDestination");
  const xvsVaultSwapper = await smock.fake<IIncomeDestination>("IIncomeDestination");
  const poolRegistry = await smock.fake<PoolRegistryInterface>("PoolRegistryInterface");

  await corePoolComptroller.isComptroller.returns(true);
  await isolatedPoolComptroller.isComptroller.returns(true);

  const accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  accessControl.isAllowedToCall.returns(true);

  // ProtocolShareReserve contract deployment
  const ProtocolShareReserve = await ethers.getContractFactory("ProtocolShareReserve");
  const protocolShareReserve = await upgrades.deployProxy(ProtocolShareReserve, [accessControl.address, 100], {
    constructorArgs: [corePoolComptroller.address, mockWBNB.address, mockVBNB.address],
  });

  await protocolShareReserve.setPoolRegistry(poolRegistry.address);

  return {
    mockDAI,
    mockUSDC,
    mockUSDT,
    riskFundSwapper,
    dao,
    poolRegistry,
    protocolShareReserve,
    xvsVaultSwapper,
    corePoolComptroller,
    isolatedPoolComptroller,
  };
};

/**
 * SCHEMA 1: Risk Fund Swapper (40 %), XVS Vault Reward (20 %), DAO (20 %) and Prime (20 %)
 * SCHEMA 2: Risk Fund Swapper (48 %), XVS Vault Reward (26 %) and DAO (26 %)
 */
const configureDistribution = async (setup: SetupProtocolShareReserveFixture) => {
  await setup.protocolShareReserve.addOrUpdateDistributionConfigs([
    {
      schema: SCHEMA_PROTOCOL_RESERVE,
      percentage: 40,
      destination: setup.riskFundSwapper.address,
    },
    {
      schema: SCHEMA_PROTOCOL_RESERVE,
      percentage: 20,
      destination: setup.xvsVaultSwapper.address,
    },
    {
      schema: SCHEMA_PROTOCOL_RESERVE,
      percentage: 40,
      destination: setup.dao.address,
    },
    {
      schema: SCHEMA_ADDITIONAL_REVENUE,
      percentage: 48,
      destination: setup.riskFundSwapper.address,
    },
    {
      schema: SCHEMA_ADDITIONAL_REVENUE,
      percentage: 26,
      destination: setup.xvsVaultSwapper.address,
    },
    {
      schema: SCHEMA_ADDITIONAL_REVENUE,
      percentage: 26,
      destination: setup.dao.address,
    },
  ]);
};

describe("ProtocolShareReserve: Tests", function () {
  let setup: SetupProtocolShareReserveFixture;
  let signers: SignerWithAddress[];

  beforeEach(async function () {
    setup = await loadFixture(fixture);
    await configureDistribution(setup);
    signers = await ethers.getSigners();
  });

  it("check configuration of schemas", async () => {
    const protocolShareReserve = setup.protocolShareReserve;

    const config1 = await protocolShareReserve.distributionTargets(0);
    const config2 = await protocolShareReserve.distributionTargets(1);
    const config3 = await protocolShareReserve.distributionTargets(2);
    const config4 = await protocolShareReserve.distributionTargets(3);
    const config5 = await protocolShareReserve.distributionTargets(4);
    const config6 = await protocolShareReserve.distributionTargets(5);

    expect(config1.schema).to.equal(SCHEMA_PROTOCOL_RESERVE);
    expect(config1.destination).to.equal(setup.riskFundSwapper.address);
    expect(config1.percentage).to.equal(40);

    expect(config2.schema).to.equal(SCHEMA_PROTOCOL_RESERVE);
    expect(config2.destination).to.equal(setup.xvsVaultSwapper.address);
    expect(config2.percentage).to.equal(20);

    expect(config3.schema).to.equal(SCHEMA_PROTOCOL_RESERVE);
    expect(config3.destination).to.equal(setup.dao.address);
    expect(config3.percentage).to.equal(40);

    expect(config4.schema).to.equal(SCHEMA_ADDITIONAL_REVENUE);
    expect(config4.destination).to.equal(setup.riskFundSwapper.address);
    expect(config4.percentage).to.equal(48);

    expect(config5.schema).to.equal(SCHEMA_ADDITIONAL_REVENUE);
    expect(config5.destination).to.equal(setup.xvsVaultSwapper.address);
    expect(config5.percentage).to.equal(26);

    expect(config6.schema).to.equal(SCHEMA_ADDITIONAL_REVENUE);
    expect(config6.destination).to.equal(setup.dao.address);
    expect(config6.percentage).to.equal(26);
  });

  it("update configuration of schemas", async () => {
    const protocolShareReserve = setup.protocolShareReserve;
    await expect(
      protocolShareReserve.addOrUpdateDistributionConfigs([
        {
          schema: SCHEMA_PROTOCOL_RESERVE,
          percentage: 30,
          destination: signers[0].address,
        },
      ]),
    ).to.be.revertedWithCustomError(protocolShareReserve, "InvalidTotalPercentage");

    await protocolShareReserve.addOrUpdateDistributionConfigs([
      {
        schema: SCHEMA_PROTOCOL_RESERVE,
        percentage: 30,
        destination: setup.riskFundSwapper.address,
      },
      {
        schema: SCHEMA_PROTOCOL_RESERVE,
        percentage: 30,
        destination: setup.xvsVaultSwapper.address,
      },
    ]);

    const config1 = await protocolShareReserve.distributionTargets(0);

    expect(config1.schema).to.equal(SCHEMA_PROTOCOL_RESERVE);
    expect(config1.destination).to.equal(setup.riskFundSwapper.address);
    expect(config1.percentage).to.equal(30);
  });

  it("remove configuration", async () => {
    const protocolShareReserve = setup.protocolShareReserve;
    expect(await protocolShareReserve.totalDistributions()).to.be.equal(6);

    const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
    const TWO_ADDRESS = "0x0000000000000000000000000000000000000002";

    await protocolShareReserve.addOrUpdateDistributionConfigs([
      {
        schema: SCHEMA_PROTOCOL_RESERVE,
        percentage: 0,
        destination: ONE_ADDRESS,
      },
    ]);
    expect(await protocolShareReserve.totalDistributions()).to.be.equal(7);

    let config = await protocolShareReserve.distributionTargets(6);

    expect(config.schema).to.equal(SCHEMA_PROTOCOL_RESERVE);
    expect(config.destination).to.equal(ONE_ADDRESS);
    expect(config.percentage).to.equal(0);

    await protocolShareReserve.removeDistributionConfig(SCHEMA_PROTOCOL_RESERVE, ONE_ADDRESS);

    expect(protocolShareReserve.distributionTargets(6)).to.have.reverted;
    expect(await protocolShareReserve.totalDistributions()).to.be.equal(6);

    await protocolShareReserve.addOrUpdateDistributionConfigs([
      {
        schema: SCHEMA_PROTOCOL_RESERVE,
        percentage: 0,
        destination: ONE_ADDRESS,
      },
      {
        schema: SCHEMA_PROTOCOL_RESERVE,
        percentage: 0,
        destination: TWO_ADDRESS,
      },
    ]);

    config = await protocolShareReserve.distributionTargets(6);

    expect(config.schema).to.equal(SCHEMA_PROTOCOL_RESERVE);
    expect(config.destination).to.equal(ONE_ADDRESS);
    expect(config.percentage).to.equal(0);

    config = await protocolShareReserve.distributionTargets(7);

    expect(config.schema).to.equal(SCHEMA_PROTOCOL_RESERVE);
    expect(config.destination).to.equal(TWO_ADDRESS);
    expect(config.percentage).to.equal(0);

    expect(await protocolShareReserve.totalDistributions()).to.be.equal(8);

    await protocolShareReserve.removeDistributionConfig(SCHEMA_PROTOCOL_RESERVE, ONE_ADDRESS);

    await expect(protocolShareReserve.distributionTargets(8)).to.have.reverted;
    expect(await protocolShareReserve.totalDistributions()).to.be.equal(7);

    config = await protocolShareReserve.distributionTargets(6);

    expect(config.schema).to.equal(SCHEMA_PROTOCOL_RESERVE);
    expect(config.destination).to.equal(TWO_ADDRESS);
    expect(config.percentage).to.equal(0);
  });

  it("collect and distribute of income", async () => {
    const mockDAI = setup.mockDAI;
    const protocolShareReserve = setup.protocolShareReserve;
    const mockUSDC = setup.mockUSDC;
    const mockUSDT = setup.mockUSDT;
    const corePoolComptroller = setup.corePoolComptroller;
    const isolatedPoolComptroller = setup.isolatedPoolComptroller;
    const poolRegistry = setup.poolRegistry;
    const riskFundSwapper = setup.riskFundSwapper;
    const xvsVaultSwapper = setup.xvsVaultSwapper;
    const dao = setup.dao;

    //Transfer liquidation and spread income from asset part of prime program
    await mockDAI.transfer(protocolShareReserve.address, 100);
    await protocolShareReserve.updateAssetsState(corePoolComptroller.address, mockDAI.address, SPREAD_INCOME);
    await mockDAI.transfer(protocolShareReserve.address, 100);
    await protocolShareReserve.updateAssetsState(corePoolComptroller.address, mockDAI.address, LIQUIDATION_INCOME);

    expect(
      await protocolShareReserve.assetsReserves(corePoolComptroller.address, mockDAI.address, SCHEMA_PROTOCOL_RESERVE),
    ).to.equal(100);
    expect(
      await protocolShareReserve.assetsReserves(
        corePoolComptroller.address,
        mockDAI.address,
        SCHEMA_ADDITIONAL_REVENUE,
      ),
    ).to.equal(100);

    await mockUSDC.transfer(protocolShareReserve.address, 100);
    await protocolShareReserve.updateAssetsState(corePoolComptroller.address, mockUSDC.address, SPREAD_INCOME);
    expect(
      await protocolShareReserve.assetsReserves(corePoolComptroller.address, mockUSDC.address, SCHEMA_PROTOCOL_RESERVE),
    ).to.equal(100);

    await mockUSDC.transfer(protocolShareReserve.address, 100);
    await protocolShareReserve.updateAssetsState(corePoolComptroller.address, mockUSDC.address, LIQUIDATION_INCOME);
    expect(
      await protocolShareReserve.assetsReserves(
        corePoolComptroller.address,
        mockUSDC.address,
        SCHEMA_ADDITIONAL_REVENUE,
      ),
    ).to.equal(100);

    //Transfer liquidation and spread income from asset part of IL
    await poolRegistry.getVTokenForAsset.returns(ONE_ADDRESS);
    await mockUSDT.transfer(protocolShareReserve.address, 100);
    await protocolShareReserve.updateAssetsState(isolatedPoolComptroller.address, mockUSDT.address, SPREAD_INCOME);
    expect(
      await protocolShareReserve.assetsReserves(
        isolatedPoolComptroller.address,
        mockUSDT.address,
        SCHEMA_PROTOCOL_RESERVE,
      ),
    ).to.equal(100);
    await mockUSDT.transfer(protocolShareReserve.address, 100);
    await protocolShareReserve.updateAssetsState(isolatedPoolComptroller.address, mockUSDT.address, LIQUIDATION_INCOME);
    expect(
      await protocolShareReserve.assetsReserves(
        isolatedPoolComptroller.address,
        mockUSDT.address,
        SCHEMA_ADDITIONAL_REVENUE,
      ),
    ).to.equal(100);

    //Release core comptroller income
    await protocolShareReserve.releaseFunds(corePoolComptroller.address, [mockDAI.address, mockUSDC.address]);

    expect(await mockDAI.balanceOf(xvsVaultSwapper.address)).to.equal(46);
    expect(await mockDAI.balanceOf(riskFundSwapper.address)).to.equal(88);
    expect(await mockDAI.balanceOf(dao.address)).to.equal(66);

    expect(await mockUSDC.balanceOf(xvsVaultSwapper.address)).to.equal(46);
    expect(await mockUSDC.balanceOf(riskFundSwapper.address)).to.equal(88);
    expect(await mockUSDC.balanceOf(dao.address)).to.equal(66);

    expect(
      await protocolShareReserve.getUnreleasedFunds(
        isolatedPoolComptroller.address,
        SCHEMA_ADDITIONAL_REVENUE,
        xvsVaultSwapper.address,
        mockUSDT.address,
      ),
    ).to.be.equal(26);

    expect(
      await protocolShareReserve.getUnreleasedFunds(
        isolatedPoolComptroller.address,
        SCHEMA_ADDITIONAL_REVENUE,
        riskFundSwapper.address,
        mockUSDT.address,
      ),
    ).to.be.equal(48);

    expect(
      await protocolShareReserve.getUnreleasedFunds(
        isolatedPoolComptroller.address,
        SCHEMA_ADDITIONAL_REVENUE,
        dao.address,
        mockUSDT.address,
      ),
    ).to.be.equal(26);

    //Release isolated comptroller income
    await protocolShareReserve.releaseFunds(isolatedPoolComptroller.address, [mockUSDT.address]);

    expect(await mockUSDT.balanceOf(xvsVaultSwapper.address)).to.equal(46);
    expect(await mockUSDT.balanceOf(riskFundSwapper.address)).to.equal(88);
    expect(await mockUSDT.balanceOf(dao.address)).to.equal(66);

    //Check if all funds are released
    expect(
      await protocolShareReserve.assetsReserves(corePoolComptroller.address, mockDAI.address, SCHEMA_PROTOCOL_RESERVE),
    ).to.equal(0);
    expect(
      await protocolShareReserve.assetsReserves(
        corePoolComptroller.address,
        mockDAI.address,
        SCHEMA_ADDITIONAL_REVENUE,
      ),
    ).to.equal(0);
    expect(
      await protocolShareReserve.assetsReserves(
        corePoolComptroller.address,
        mockUSDC.address,
        SCHEMA_ADDITIONAL_REVENUE,
      ),
    ).to.equal(0);
    expect(
      await protocolShareReserve.assetsReserves(
        corePoolComptroller.address,
        mockUSDC.address,
        SCHEMA_ADDITIONAL_REVENUE,
      ),
    ).to.equal(0);
    expect(
      await protocolShareReserve.assetsReserves(
        isolatedPoolComptroller.address,
        mockUSDT.address,
        SCHEMA_ADDITIONAL_REVENUE,
      ),
    ).to.equal(0);
    expect(
      await protocolShareReserve.assetsReserves(
        isolatedPoolComptroller.address,
        mockUSDT.address,
        SCHEMA_ADDITIONAL_REVENUE,
      ),
    ).to.equal(0);
  });
});
