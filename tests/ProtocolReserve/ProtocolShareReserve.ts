import { FakeContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { ethers, upgrades } from "hardhat";

import { convertToUnit } from "../../helpers/utils";
import {
  IAccessControlManagerV8,
  IComptroller,
  IIncomeDestination,
  IPoolRegistry,
  MockToken,
  ProtocolShareReserve,
} from "../../typechain";

chai.use(smock.matchers);
const { expect } = chai;

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
  poolRegistry: FakeContract<IPoolRegistry>;
  protocolShareReserve: ProtocolShareReserve;
  xvsVaultSwapper: FakeContract<IIncomeDestination>;
  corePoolComptroller: FakeContract<IComptroller>;
  isolatedPoolComptroller: FakeContract<IComptroller>;
  spokePoolRegistry: FakeContract<IPoolRegistry>;
  spokePoolComptroller: FakeContract<IComptroller>;
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

  const corePoolComptroller = await smock.fake<IComptroller>("IComptroller");
  const isolatedPoolComptroller = await smock.fake<IComptroller>("IComptroller");
  const riskFundSwapper = await smock.fake<IIncomeDestination>("IIncomeDestination");
  const dao = await smock.fake<IIncomeDestination>("IIncomeDestination");
  const xvsVaultSwapper = await smock.fake<IIncomeDestination>("IIncomeDestination");
  const poolRegistry = await smock.fake<IPoolRegistry>("IPoolRegistry");

  // A pool that only a second, separately registered pool registry knows about.
  const spokePoolComptroller = await smock.fake<IComptroller>("IComptroller");
  const spokePoolRegistry = await smock.fake<IPoolRegistry>("IPoolRegistry");

  await corePoolComptroller.isComptroller.returns(true);
  await isolatedPoolComptroller.isComptroller.returns(true);
  await spokePoolComptroller.isComptroller.returns(true);

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
    spokePoolRegistry,
    spokePoolComptroller,
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
      percentage: 4000,
      destination: setup.riskFundSwapper.address,
    },
    {
      schema: SCHEMA_PROTOCOL_RESERVE,
      percentage: 2000,
      destination: setup.xvsVaultSwapper.address,
    },
    {
      schema: SCHEMA_PROTOCOL_RESERVE,
      percentage: 4000,
      destination: setup.dao.address,
    },
    {
      schema: SCHEMA_ADDITIONAL_REVENUE,
      percentage: 4800,
      destination: setup.riskFundSwapper.address,
    },
    {
      schema: SCHEMA_ADDITIONAL_REVENUE,
      percentage: 2600,
      destination: setup.xvsVaultSwapper.address,
    },
    {
      schema: SCHEMA_ADDITIONAL_REVENUE,
      percentage: 2600,
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
    expect(config1.percentage).to.equal(4000);

    expect(config2.schema).to.equal(SCHEMA_PROTOCOL_RESERVE);
    expect(config2.destination).to.equal(setup.xvsVaultSwapper.address);
    expect(config2.percentage).to.equal(2000);

    expect(config3.schema).to.equal(SCHEMA_PROTOCOL_RESERVE);
    expect(config3.destination).to.equal(setup.dao.address);
    expect(config3.percentage).to.equal(4000);

    expect(config4.schema).to.equal(SCHEMA_ADDITIONAL_REVENUE);
    expect(config4.destination).to.equal(setup.riskFundSwapper.address);
    expect(config4.percentage).to.equal(4800);

    expect(config5.schema).to.equal(SCHEMA_ADDITIONAL_REVENUE);
    expect(config5.destination).to.equal(setup.xvsVaultSwapper.address);
    expect(config5.percentage).to.equal(2600);

    expect(config6.schema).to.equal(SCHEMA_ADDITIONAL_REVENUE);
    expect(config6.destination).to.equal(setup.dao.address);
    expect(config6.percentage).to.equal(2600);
  });

  it("update configuration of schemas", async () => {
    const protocolShareReserve = setup.protocolShareReserve;
    await expect(
      protocolShareReserve.addOrUpdateDistributionConfigs([
        {
          schema: SCHEMA_PROTOCOL_RESERVE,
          percentage: 3000,
          destination: signers[0].address,
        },
      ]),
    ).to.be.revertedWithCustomError(protocolShareReserve, "InvalidTotalPercentage");

    await protocolShareReserve.addOrUpdateDistributionConfigs([
      {
        schema: SCHEMA_PROTOCOL_RESERVE,
        percentage: 3000,
        destination: setup.riskFundSwapper.address,
      },
      {
        schema: SCHEMA_PROTOCOL_RESERVE,
        percentage: 3000,
        destination: setup.xvsVaultSwapper.address,
      },
    ]);

    const config1 = await protocolShareReserve.distributionTargets(0);

    expect(config1.schema).to.equal(SCHEMA_PROTOCOL_RESERVE);
    expect(config1.destination).to.equal(setup.riskFundSwapper.address);
    expect(config1.percentage).to.equal(3000);
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

    await expect(protocolShareReserve.distributionTargets(6)).to.have.reverted;
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

describe("ProtocolShareReserve: multiple pool registries", function () {
  let setup: SetupProtocolShareReserveFixture;
  let signers: SignerWithAddress[];
  let protocolShareReserve: ProtocolShareReserve;
  let poolRegistry: FakeContract<IPoolRegistry>;
  let spokePoolRegistry: FakeContract<IPoolRegistry>;

  /// Makes a registry resolve exactly one (comptroller, asset) pair, returning zero for every other
  /// pair the way `PoolRegistry._vTokens` does.
  const resolveOnly = (
    registry: FakeContract<IPoolRegistry>,
    comptroller: FakeContract<IComptroller>,
    asset: MockToken,
  ) => {
    registry.getVTokenForAsset.reset();
    registry.getVTokenForAsset.returns(ethers.constants.AddressZero);
    registry.getVTokenForAsset.whenCalledWith(comptroller.address, asset.address).returns(ONE_ADDRESS);
  };

  beforeEach(async function () {
    setup = await loadFixture(fixture);
    await configureDistribution(setup);
    signers = await ethers.getSigners();
    protocolShareReserve = setup.protocolShareReserve;
    poolRegistry = setup.poolRegistry;
    spokePoolRegistry = setup.spokePoolRegistry;

    resolveOnly(poolRegistry, setup.isolatedPoolComptroller, setup.mockUSDT);
    resolveOnly(spokePoolRegistry, setup.spokePoolComptroller, setup.mockUSDC);
  });

  describe("addPoolRegistry", () => {
    it("reverts for a non-owner", async () => {
      await expect(
        protocolShareReserve.connect(signers[1]).addPoolRegistry(spokePoolRegistry.address),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("reverts for the zero address", async () => {
      await expect(protocolShareReserve.addPoolRegistry(ethers.constants.AddressZero)).to.be.revertedWithCustomError(
        protocolShareReserve,
        "ZeroAddressNotAllowed",
      );
    });

    it("reverts when the address is already the primary registry", async () => {
      await expect(protocolShareReserve.addPoolRegistry(poolRegistry.address)).to.be.revertedWithCustomError(
        protocolShareReserve,
        "PoolRegistryAlreadyAdded",
      );
    });

    it("reverts when the address was already added", async () => {
      await protocolShareReserve.addPoolRegistry(spokePoolRegistry.address);
      await expect(protocolShareReserve.addPoolRegistry(spokePoolRegistry.address)).to.be.revertedWithCustomError(
        protocolShareReserve,
        "PoolRegistryAlreadyAdded",
      );
    });

    it("records the registry and emits", async () => {
      await expect(protocolShareReserve.addPoolRegistry(spokePoolRegistry.address))
        .to.emit(protocolShareReserve, "PoolRegistryAdded")
        .withArgs(spokePoolRegistry.address);

      expect(await protocolShareReserve.isAdditionalPoolRegistry(spokePoolRegistry.address)).to.equal(true);
      expect(await protocolShareReserve.totalAdditionalPoolRegistries()).to.equal(1);
      expect(await protocolShareReserve.additionalPoolRegistries(0)).to.equal(spokePoolRegistry.address);
    });

    it("is bounded by maxLoopsLimit", async () => {
      // maxLoopsLimit can only be raised, so the bound needs a proxy deployed with a limit of one.
      const ProtocolShareReserve = await ethers.getContractFactory("ProtocolShareReserve");
      const accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
      accessControl.isAllowedToCall.returns(true);
      const bounded = await upgrades.deployProxy(ProtocolShareReserve, [accessControl.address, 1], {
        constructorArgs: [setup.corePoolComptroller.address, ONE_ADDRESS, ONE_ADDRESS],
      });

      await bounded.addPoolRegistry(spokePoolRegistry.address);

      const another = await smock.fake<IPoolRegistry>("IPoolRegistry");
      await expect(bounded.addPoolRegistry(another.address))
        .to.be.revertedWithCustomError(bounded, "MaxLoopsLimitExceeded")
        .withArgs(1, 2);
    });
  });

  describe("removePoolRegistry", () => {
    beforeEach(async () => {
      await protocolShareReserve.addPoolRegistry(spokePoolRegistry.address);
    });

    it("reverts for a non-owner", async () => {
      await expect(
        protocolShareReserve.connect(signers[1]).removePoolRegistry(spokePoolRegistry.address),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("reverts when the registry was never added", async () => {
      await expect(protocolShareReserve.removePoolRegistry(poolRegistry.address)).to.be.revertedWithCustomError(
        protocolShareReserve,
        "PoolRegistryNotFound",
      );
    });

    it("removes the registry and emits", async () => {
      await expect(protocolShareReserve.removePoolRegistry(spokePoolRegistry.address))
        .to.emit(protocolShareReserve, "PoolRegistryRemoved")
        .withArgs(spokePoolRegistry.address);

      expect(await protocolShareReserve.isAdditionalPoolRegistry(spokePoolRegistry.address)).to.equal(false);
      expect(await protocolShareReserve.totalAdditionalPoolRegistries()).to.equal(0);
    });

    it("keeps the remaining registries when removing from the middle", async () => {
      const second = await smock.fake<IPoolRegistry>("IPoolRegistry");
      const third = await smock.fake<IPoolRegistry>("IPoolRegistry");
      await protocolShareReserve.addPoolRegistry(second.address);
      await protocolShareReserve.addPoolRegistry(third.address);

      await protocolShareReserve.removePoolRegistry(second.address);

      expect(await protocolShareReserve.getPoolRegistries()).to.have.members([
        poolRegistry.address,
        spokePoolRegistry.address,
        third.address,
      ]);
    });

    it("can re-add a removed registry", async () => {
      await protocolShareReserve.removePoolRegistry(spokePoolRegistry.address);
      await protocolShareReserve.addPoolRegistry(spokePoolRegistry.address);

      expect(await protocolShareReserve.totalAdditionalPoolRegistries()).to.equal(1);
    });
  });

  describe("setPoolRegistry", () => {
    it("still repoints the primary registry", async () => {
      await expect(protocolShareReserve.setPoolRegistry(spokePoolRegistry.address))
        .to.emit(protocolShareReserve, "PoolRegistryUpdated")
        .withArgs(poolRegistry.address, spokePoolRegistry.address);

      expect(await protocolShareReserve.poolRegistry()).to.equal(spokePoolRegistry.address);
    });

    it("refuses to promote a registry that is already in the additional set", async () => {
      await protocolShareReserve.addPoolRegistry(spokePoolRegistry.address);

      await expect(protocolShareReserve.setPoolRegistry(spokePoolRegistry.address)).to.be.revertedWithCustomError(
        protocolShareReserve,
        "PoolRegistryAlreadyAdded",
      );
    });
  });

  describe("getPoolRegistries", () => {
    it("lists the primary registry first", async () => {
      await protocolShareReserve.addPoolRegistry(spokePoolRegistry.address);

      expect(await protocolShareReserve.getPoolRegistries()).to.deep.equal([
        poolRegistry.address,
        spokePoolRegistry.address,
      ]);
    });

    it("omits an unset primary registry", async () => {
      const ProtocolShareReserve = await ethers.getContractFactory("ProtocolShareReserve");
      const accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
      accessControl.isAllowedToCall.returns(true);
      const fresh = await upgrades.deployProxy(ProtocolShareReserve, [accessControl.address, 100], {
        constructorArgs: [setup.corePoolComptroller.address, ONE_ADDRESS, ONE_ADDRESS],
      });

      expect(await fresh.getPoolRegistries()).to.deep.equal([]);

      await fresh.addPoolRegistry(spokePoolRegistry.address);
      expect(await fresh.getPoolRegistries()).to.deep.equal([spokePoolRegistry.address]);
    });
  });

  describe("isMarketRegistered", () => {
    beforeEach(async () => {
      await protocolShareReserve.addPoolRegistry(spokePoolRegistry.address);
    });

    it("resolves through either registry", async () => {
      expect(
        await protocolShareReserve.isMarketRegistered(setup.isolatedPoolComptroller.address, setup.mockUSDT.address),
      ).to.equal(true);
      expect(
        await protocolShareReserve.isMarketRegistered(setup.spokePoolComptroller.address, setup.mockUSDC.address),
      ).to.equal(true);
    });

    it("is false for a pair no registry knows", async () => {
      expect(
        await protocolShareReserve.isMarketRegistered(setup.spokePoolComptroller.address, setup.mockDAI.address),
      ).to.equal(false);
    });

    it("does not cover the core pool", async () => {
      expect(
        await protocolShareReserve.isMarketRegistered(setup.corePoolComptroller.address, setup.mockDAI.address),
      ).to.equal(false);
    });
  });

  describe("updateAssetsState", () => {
    it("rejects a pool no registry knows", async () => {
      await setup.mockUSDC.transfer(protocolShareReserve.address, 100);

      await expect(
        protocolShareReserve.updateAssetsState(
          setup.spokePoolComptroller.address,
          setup.mockUSDC.address,
          SPREAD_INCOME,
        ),
      ).to.be.revertedWithCustomError(protocolShareReserve, "InvalidAddress");
    });

    it("keeps accepting a pool of the primary registry after a second one is added", async () => {
      await protocolShareReserve.addPoolRegistry(spokePoolRegistry.address);

      await setup.mockUSDT.transfer(protocolShareReserve.address, 100);
      await protocolShareReserve.updateAssetsState(
        setup.isolatedPoolComptroller.address,
        setup.mockUSDT.address,
        SPREAD_INCOME,
      );

      expect(
        await protocolShareReserve.assetsReserves(
          setup.isolatedPoolComptroller.address,
          setup.mockUSDT.address,
          SCHEMA_PROTOCOL_RESERVE,
        ),
      ).to.equal(100);
      // The primary registry answers first, so the additional one is never consulted.
      expect(spokePoolRegistry.getVTokenForAsset).to.have.callCount(0);
    });

    it("accepts a pool only the additional registry knows", async () => {
      await protocolShareReserve.addPoolRegistry(spokePoolRegistry.address);

      await setup.mockUSDC.transfer(protocolShareReserve.address, 100);
      await expect(
        protocolShareReserve.updateAssetsState(
          setup.spokePoolComptroller.address,
          setup.mockUSDC.address,
          LIQUIDATION_INCOME,
        ),
      )
        .to.emit(protocolShareReserve, "AssetsReservesUpdated")
        .withArgs(
          setup.spokePoolComptroller.address,
          setup.mockUSDC.address,
          100,
          LIQUIDATION_INCOME,
          SCHEMA_ADDITIONAL_REVENUE,
        );

      expect(
        await protocolShareReserve.assetsReserves(
          setup.spokePoolComptroller.address,
          setup.mockUSDC.address,
          SCHEMA_ADDITIONAL_REVENUE,
        ),
      ).to.equal(100);
    });

    it("books both product lines at the same time, under their own comptrollers", async () => {
      await protocolShareReserve.addPoolRegistry(spokePoolRegistry.address);

      await setup.mockUSDT.transfer(protocolShareReserve.address, 100);
      await protocolShareReserve.updateAssetsState(
        setup.isolatedPoolComptroller.address,
        setup.mockUSDT.address,
        SPREAD_INCOME,
      );
      await setup.mockUSDC.transfer(protocolShareReserve.address, 250);
      await protocolShareReserve.updateAssetsState(
        setup.spokePoolComptroller.address,
        setup.mockUSDC.address,
        SPREAD_INCOME,
      );

      expect(
        await protocolShareReserve.assetsReserves(
          setup.isolatedPoolComptroller.address,
          setup.mockUSDT.address,
          SCHEMA_PROTOCOL_RESERVE,
        ),
      ).to.equal(100);
      expect(
        await protocolShareReserve.assetsReserves(
          setup.spokePoolComptroller.address,
          setup.mockUSDC.address,
          SCHEMA_PROTOCOL_RESERVE,
        ),
      ).to.equal(250);
      expect(await protocolShareReserve.totalAssetReserve(setup.mockUSDT.address)).to.equal(100);
      expect(await protocolShareReserve.totalAssetReserve(setup.mockUSDC.address)).to.equal(250);
    });

    it("still bypasses the registries for the core pool", async () => {
      await setup.mockDAI.transfer(protocolShareReserve.address, 100);
      await protocolShareReserve.updateAssetsState(
        setup.corePoolComptroller.address,
        setup.mockDAI.address,
        SPREAD_INCOME,
      );

      expect(
        await protocolShareReserve.assetsReserves(
          setup.corePoolComptroller.address,
          setup.mockDAI.address,
          SCHEMA_PROTOCOL_RESERVE,
        ),
      ).to.equal(100);
    });

    it("stops accepting the pool once its registry is removed", async () => {
      await protocolShareReserve.addPoolRegistry(spokePoolRegistry.address);
      await protocolShareReserve.removePoolRegistry(spokePoolRegistry.address);

      await setup.mockUSDC.transfer(protocolShareReserve.address, 100);
      await expect(
        protocolShareReserve.updateAssetsState(
          setup.spokePoolComptroller.address,
          setup.mockUSDC.address,
          SPREAD_INCOME,
        ),
      ).to.be.revertedWithCustomError(protocolShareReserve, "InvalidAddress");
    });
  });

  describe("releaseFunds", () => {
    it("distributes income booked against an additional-registry pool", async () => {
      await protocolShareReserve.addPoolRegistry(spokePoolRegistry.address);

      await setup.mockUSDC.transfer(protocolShareReserve.address, 1000);
      await protocolShareReserve.updateAssetsState(
        setup.spokePoolComptroller.address,
        setup.mockUSDC.address,
        SPREAD_INCOME,
      );

      await protocolShareReserve.releaseFunds(setup.spokePoolComptroller.address, [setup.mockUSDC.address]);

      // SCHEMA_PROTOCOL_RESERVE splits 40 / 20 / 40 across the three destinations.
      expect(await setup.mockUSDC.balanceOf(setup.riskFundSwapper.address)).to.equal(400);
      expect(await setup.mockUSDC.balanceOf(setup.xvsVaultSwapper.address)).to.equal(200);
      expect(await setup.mockUSDC.balanceOf(setup.dao.address)).to.equal(400);
      expect(
        await protocolShareReserve.assetsReserves(
          setup.spokePoolComptroller.address,
          setup.mockUSDC.address,
          SCHEMA_PROTOCOL_RESERVE,
        ),
      ).to.equal(0);
    });
  });
});
