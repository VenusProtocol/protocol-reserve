import { FakeContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";

import { convertToUnit } from "../helpers/utils";
import { IAccessControlManagerV8, IIncomeDestination, IPrime, MockToken, PoolRegistryInterface, ProtocolShareReserve } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

type SetupProtocolShareReserveFixture = {
  mockDAI: MockToken;
  riskFundSwapper: FakeContract<IIncomeDestination>;
  dao: FakeContract<IIncomeDestination>;
  prime: FakeContract<IPrime>;
  poolRegistry: FakeContract<PoolRegistryInterface>;
  protocolShareReserve: ProtocolShareReserve;
  xvsVaultSwapper: FakeContract<IIncomeDestination>;
};

const fixture = async (): Promise<SetupProtocolShareReserveFixture> => {
  const MockDAI = await ethers.getContractFactory("MockToken");
  const mockDAI = await MockDAI.deploy("MakerDAO", "DAI", 18);
  await mockDAI.faucet(convertToUnit(1000, 18));

  const signers: SignerWithAddress[] = await ethers.getSigners();
  const corePoolComptroller = signers[1];
  const riskFundSwapper = await smock.fake<IIncomeDestination>("IIncomeDestination"); 
  const dao = await smock.fake<IIncomeDestination>("IIncomeDestination");
  const xvsVaultSwapper = await smock.fake<IIncomeDestination>("IIncomeDestination");
  const prime = await smock.fake<IPrime>("IPrime"); 
  const poolRegistry = await smock.fake<PoolRegistryInterface>("PoolRegistryInterface");

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
    riskFundSwapper,
    dao,
    prime,
    poolRegistry,
    protocolShareReserve,
    xvsVaultSwapper
  }
};

/**
 * SCHEMA 1: Risk Fund Swapper (40 %), XVS Vault Reward (20 %), DAO (20 %) and Prime (20 %)
 * SCHEMA 2: Risk Fund Swapper (48 %), XVS Vault Reward (26 %) and DAO (26 %)
 */
const configureDistribution = async (setup: SetupProtocolShareReserveFixture) => {
  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: 0,
    percentage: 40,
    destination: setup.riskFundSwapper.address,
  })

  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: 0,
    percentage: 20,
    destination: setup.xvsVaultSwapper.address,
  })

  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: 0,
    percentage: 20,
    destination: setup.dao.address,
  })

  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: 0,
    percentage: 20,
    destination: setup.prime.address,
  })

  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: 1,
    percentage: 48,
    destination: setup.riskFundSwapper.address,
  })

  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: 1,
    percentage: 26,
    destination: setup.xvsVaultSwapper.address,
  })

  await setup.protocolShareReserve.addOrUpdateDistributionConfig({
    schema: 1,
    percentage: 26,
    destination: setup.dao.address,
  })
}

describe("ProtocolShareReserve: Tests", function () {
  let setup: SetupProtocolShareReserveFixture;
  let signers: SignerWithAddress[];
  before(async function () {
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

    expect(config1.schema).to.equal(0);
    expect(config1.destination).to.equal(setup.riskFundSwapper.address);
    expect(config1.percentage).to.equal(40);

    expect(config2.schema).to.equal(0);
    expect(config2.destination).to.equal(setup.xvsVaultSwapper.address);
    expect(config2.percentage).to.equal(20);

    expect(config3.schema).to.equal(0);
    expect(config3.destination).to.equal(setup.dao.address);
    expect(config3.percentage).to.equal(20);

    expect(config4.schema).to.equal(0);
    expect(config4.destination).to.equal(setup.prime.address);
    expect(config4.percentage).to.equal(20);

    expect(config5.schema).to.equal(1);
    expect(config5.destination).to.equal(setup.riskFundSwapper.address);
    expect(config5.percentage).to.equal(48);

    expect(config6.schema).to.equal(1);
    expect(config6.destination).to.equal(setup.xvsVaultSwapper.address);
    expect(config6.percentage).to.equal(26);

    expect(config7.schema).to.equal(1);
    expect(config7.destination).to.equal(setup.dao.address);
    expect(config7.percentage).to.equal(26);
  })

  it("update configuration of schemas", async () => {
    const protocolShareReserve = setup.protocolShareReserve;
    await expect(protocolShareReserve.addOrUpdateDistributionConfig({
      schema: 0,
      percentage: 30,
      destination: signers[0].address,
    })).to.be.revertedWith("ProtocolShareReserve: Percentage must be between 0 and 100");

    await protocolShareReserve.addOrUpdateDistributionConfig({
      schema: 0,
      percentage: 30,
      destination: setup.riskFundSwapper.address,
    })

    const config1 = await protocolShareReserve.distributionTargets(0)
    expect(config1.schema).to.equal(0);
    expect(config1.destination).to.equal(setup.riskFundSwapper.address);
    expect(config1.percentage).to.equal(30);
  })
});
