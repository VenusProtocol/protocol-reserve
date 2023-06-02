import { FakeContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";

import { convertToUnit } from "../helpers/utils";
import { ComptrollerInterface, IAccessControlManagerV8, IIncomeDestination, IPrime, MockToken, PoolRegistryInterface, ProtocolShareReserve } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

const SCHEMA_ONE = 0;
const SCHEMA_TWO = 1;
const SPREAD_INCOME = 0;
const LIQUIDATION_INCOME = 1;

type SetupProtocolShareReserveFixture = {
  mockDAI: MockToken;
  mockUSDC: MockToken;
  mockUSDT: MockToken
  riskFundSwapper: FakeContract<IIncomeDestination>;
  dao: FakeContract<IIncomeDestination>;
  prime: FakeContract<IPrime>;
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

  const corePoolComptroller =await smock.fake<ComptrollerInterface>("ComptrollerInterface"); 
  const isolatedPoolComptroller =await smock.fake<ComptrollerInterface>("ComptrollerInterface"); 
  const riskFundSwapper = await smock.fake<IIncomeDestination>("IIncomeDestination"); 
  const dao = await smock.fake<IIncomeDestination>("IIncomeDestination");
  const xvsVaultSwapper = await smock.fake<IIncomeDestination>("IIncomeDestination");
  const prime = await smock.fake<IPrime>("IPrime"); 
  const poolRegistry = await smock.fake<PoolRegistryInterface>("PoolRegistryInterface");

  await corePoolComptroller.isComptroller.returns(true);
  await isolatedPoolComptroller.isComptroller.returns(true);

  const accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  accessControl.isAllowedToCall.returns(true);

  // ProtocolShareReserve contract deployment
  const ProtocolShareReserve = await ethers.getContractFactory("ProtocolShareReserve");
  const protocolShareReserve = await upgrades.deployProxy(ProtocolShareReserve, [
    corePoolComptroller.address,
    accessControl.address,
  ]);

  await protocolShareReserve.setPoolRegistry(poolRegistry.address);
  await protocolShareReserve.setPrime(prime.address);

  return {
    mockDAI,
    mockUSDC,
    mockUSDT,
    riskFundSwapper,
    dao,
    prime,
    poolRegistry,
    protocolShareReserve,
    xvsVaultSwapper,
    corePoolComptroller,
    isolatedPoolComptroller
  }
};

/**
 * SCHEMA 1: Risk Fund Swapper (40 %), XVS Vault Reward (20 %), DAO (20 %) and Prime (20 %)
 * SCHEMA 2: Risk Fund Swapper (48 %), XVS Vault Reward (26 %) and DAO (26 %)
 */
const configureDistribution = async (setup: SetupProtocolShareReserveFixture) => {
  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: SCHEMA_ONE,
    percentage: 40,
    destination: setup.riskFundSwapper.address,
  })

  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: SCHEMA_ONE,
    percentage: 20,
    destination: setup.xvsVaultSwapper.address,
  })

  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: SCHEMA_ONE,
    percentage: 20,
    destination: setup.dao.address,
  })

  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: SCHEMA_ONE,
    percentage: 20,
    destination: setup.prime.address,
  })

  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: SCHEMA_TWO,
    percentage: 48,
    destination: setup.riskFundSwapper.address,
  })

  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: SCHEMA_TWO,
    percentage: 26,
    destination: setup.xvsVaultSwapper.address,
  })

  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: SCHEMA_TWO,
    percentage: 26,
    destination: setup.dao.address,
  })
}

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

    const config1 = await protocolShareReserve.distributionTargets(0)
    const config2 = await protocolShareReserve.distributionTargets(1)
    const config3 = await protocolShareReserve.distributionTargets(2)
    const config4 = await protocolShareReserve.distributionTargets(3)
    const config5 = await protocolShareReserve.distributionTargets(4)
    const config6 = await protocolShareReserve.distributionTargets(5)
    const config7 = await protocolShareReserve.distributionTargets(6)

    expect(config1.schema).to.equal(SCHEMA_ONE);
    expect(config1.destination).to.equal(setup.riskFundSwapper.address);
    expect(config1.percentage).to.equal(40);

    expect(config2.schema).to.equal(SCHEMA_ONE);
    expect(config2.destination).to.equal(setup.xvsVaultSwapper.address);
    expect(config2.percentage).to.equal(20);

    expect(config3.schema).to.equal(SCHEMA_ONE);
    expect(config3.destination).to.equal(setup.dao.address);
    expect(config3.percentage).to.equal(20);

    expect(config4.schema).to.equal(SCHEMA_ONE);
    expect(config4.destination).to.equal(setup.prime.address);
    expect(config4.percentage).to.equal(20);

    expect(config5.schema).to.equal(SCHEMA_TWO);
    expect(config5.destination).to.equal(setup.riskFundSwapper.address);
    expect(config5.percentage).to.equal(48);

    expect(config6.schema).to.equal(SCHEMA_TWO);
    expect(config6.destination).to.equal(setup.xvsVaultSwapper.address);
    expect(config6.percentage).to.equal(26);

    expect(config7.schema).to.equal(SCHEMA_TWO);
    expect(config7.destination).to.equal(setup.dao.address);
    expect(config7.percentage).to.equal(26);
  })

  it("update configuration of schemas", async () => {
    const protocolShareReserve = setup.protocolShareReserve;
    await expect(protocolShareReserve.addOrUpdateDistributionConfig({
      schema: SCHEMA_ONE,
      percentage: 30,
      destination: signers[0].address,
    })).to.be.revertedWith("ProtocolShareReserve: Percentage must be between 0 and 100");

    await protocolShareReserve.addOrUpdateDistributionConfig({
      schema: SCHEMA_ONE,
      percentage: 30,
      destination: setup.riskFundSwapper.address,
    })

    const config1 = await protocolShareReserve.distributionTargets(0)
    expect(config1.schema).to.equal(SCHEMA_ONE);
    expect(config1.destination).to.equal(setup.riskFundSwapper.address);
    expect(config1.percentage).to.equal(30);
  })

  it("collect and distribute of income", async () => {
    const mockDAI = setup.mockDAI;
    const protocolShareReserve = setup.protocolShareReserve;
    const mockUSDC = setup.mockUSDC;
    const mockUSDT = setup.mockUSDT;
    const corePoolComptroller = setup.corePoolComptroller;
    const prime = setup.prime;
    const isolatedPoolComptroller = setup.isolatedPoolComptroller;
    const poolRegistry = setup.poolRegistry;

    //Transfer liquidation and spread income from asset part of prime program
    await mockDAI.transfer(protocolShareReserve.address, 100);
    await prime.isPrime.returns(true);
    await protocolShareReserve.updateAssetsState(
      corePoolComptroller.address,
      mockDAI.address,
      SPREAD_INCOME
    )
    await mockDAI.transfer(protocolShareReserve.address, 100);
    await protocolShareReserve.updateAssetsState(
      corePoolComptroller.address,
      mockDAI.address,
      LIQUIDATION_INCOME
    )

    await prime.isPrime.returns(false);

    expect(await protocolShareReserve.assetsReserves(corePoolComptroller.address, mockDAI.address, SCHEMA_ONE)).to.equal(100);
    expect(await protocolShareReserve.assetsReserves(corePoolComptroller.address, mockDAI.address, SCHEMA_TWO)).to.equal(100);

    //Transfer liquidation and spread income from asset not part of prime program
    await mockUSDC.transfer(protocolShareReserve.address, 100);
    await protocolShareReserve.updateAssetsState(
      corePoolComptroller.address,
      mockUSDC.address,
      SPREAD_INCOME
    )
    expect(await protocolShareReserve.assetsReserves(corePoolComptroller.address, mockUSDC.address, SCHEMA_TWO)).to.equal(100);
    
    await mockUSDC.transfer(protocolShareReserve.address, 100);
    await protocolShareReserve.updateAssetsState(
      corePoolComptroller.address,
      mockUSDC.address,
      LIQUIDATION_INCOME
    )
    expect(await protocolShareReserve.assetsReserves(corePoolComptroller.address, mockUSDC.address, SCHEMA_TWO)).to.equal(200);

    //Transfer liquidation and spread income from asset part of IL
    await poolRegistry.getVTokenForAsset.returns("0x0000000000000000000000000000000000000001")
    await mockUSDT.transfer(protocolShareReserve.address, 100);
    await protocolShareReserve.updateAssetsState(
      isolatedPoolComptroller.address,
      mockUSDT.address,
      SPREAD_INCOME
    )
    expect(await protocolShareReserve.assetsReserves(isolatedPoolComptroller.address, mockUSDT.address, SCHEMA_TWO)).to.equal(100);
    await mockUSDT.transfer(protocolShareReserve.address, 100);
    await protocolShareReserve.updateAssetsState(
      isolatedPoolComptroller.address,
      mockUSDT.address,
      LIQUIDATION_INCOME
    )
    expect(await protocolShareReserve.assetsReserves(isolatedPoolComptroller.address, mockUSDT.address, SCHEMA_TWO)).to.equal(200);
  });
});
