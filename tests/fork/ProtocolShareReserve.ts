import { FakeContract, smock } from "@defi-wonderland/smock";
import chai from "chai";
import { BigNumber, Contract, Signer } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import hre from "hardhat";

import { IComptroller, IPoolRegistry } from "../../typechain";
import { forking, initMainnetUser } from "../utils";

chai.use(smock.matchers);
const { expect } = chai;

const FORK_MAINNET = process.env.FORK === "true" && process.env.FORKED_NETWORK === "bscmainnet";

// BSC mainnet
const NORMAL_TIMELOCK = "0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396";
const DEFAULT_PROXY_ADMIN = "0x6beb6D2695B67FEb73ad4f172E8E2975497187e4";
const PROTOCOL_SHARE_RESERVE = "0xCa01D5A9A248a830E9D93231e791B1afFed7c446";
const POOL_REGISTRY = "0x9F7b01A536aFA00EF10310A162877fd792cD0666";
const CORE_POOL_COMPTROLLER = "0xfD36E2c2a6789Db23113685031d7F16329158384";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const VBNB = "0xA07c5b74C9B40447a954e1466938b865b6BBea36";

// A pool that is live in the isolated-pools registry.
const LIVE_ISOLATED_POOL = "0x94c1495cD4c557f1560Cbd68EAB0d197e6291571";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const WHALE = "0xF977814e90dA44bFA03b6295A0616a897441aceC"; // Binance hot wallet

const SPREAD_INCOME = 0;
const LIQUIDATION_INCOME = 1;
const SCHEMA_PROTOCOL_RESERVE = 0;
const SCHEMA_ADDITIONAL_REVENUE = 1;

const PSR_ABI = [
  "function poolRegistry() view returns (address)",
  "function owner() view returns (address)",
  "function totalDistributions() view returns (uint256)",
  "function distributionTargets(uint256) view returns (uint8 schema, uint16 percentage, address destination)",
  "function assetsReserves(address,address,uint8) view returns (uint256)",
  "function totalAssetReserve(address) view returns (uint256)",
  "function maxLoopsLimit() view returns (uint256)",
  "function updateAssetsState(address,address,uint8)",
  "function setPoolRegistry(address)",
  "function addPoolRegistry(address)",
  "function removePoolRegistry(address)",
  "function getPoolRegistries() view returns (address[])",
  "function totalAdditionalPoolRegistries() view returns (uint256)",
  "function isAdditionalPoolRegistry(address) view returns (bool)",
  "function isMarketRegistered(address,address) view returns (bool)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
];

const FORK_BLOCK = 119500000;

forking(FORK_BLOCK, () => {
  if (!FORK_MAINNET) {
    return;
  }

  /**
   * `setPoolRegistry` cannot serve a second pool registry: the moment it points elsewhere, every live
   * isolated-pool vToken fails the membership check, and since that check also runs on the
   * protocol-seize path, every liquidation in those pools reverts.
   *
   * These tests upgrade the live proxy in place, then assert the deployed accounting survives and
   * that both registries resolve at the same time.
   */
  describe("ProtocolShareReserve fork (bscmainnet): multiple pool registries", () => {
    let timelock: Signer;
    let whale: Signer;
    let deployer: Signer;

    let psr: Contract;
    let usdt: Contract;
    let poolRegistry: Contract;

    let spokeRegistry: FakeContract<IPoolRegistry>;
    let spokeComptroller: FakeContract<IComptroller>;

    // State read off the live proxy before the upgrade.
    let deployedRegistry: string;
    let deployedTotalDistributions: BigNumber;
    let deployedTargets: { schema: number; percentage: number; destination: string }[];
    let deployedUsdtTotalReserve: BigNumber;
    let deployedIsolatedSpread: BigNumber;

    const INCOME = parseUnits("1000", 18);

    const reportIncome = (comptroller: string, asset: string, incomeType: number) =>
      psr.connect(deployer).updateAssetsState(comptroller, asset, incomeType);

    before(async () => {
      [deployer] = await hre.ethers.getSigners();

      timelock = await initMainnetUser(NORMAL_TIMELOCK);
      whale = await initMainnetUser(WHALE);
      const tenBnb = "0x8AC7230489E80000";
      await hre.network.provider.send("hardhat_setBalance", [NORMAL_TIMELOCK, tenBnb]);
      await hre.network.provider.send("hardhat_setBalance", [WHALE, tenBnb]);

      psr = await hre.ethers.getContractAt(PSR_ABI, PROTOCOL_SHARE_RESERVE);
      usdt = await hre.ethers.getContractAt(ERC20_ABI, USDT);
      poolRegistry = await hre.ethers.getContractAt(
        ["function getVTokenForAsset(address,address) view returns (address)"],
        POOL_REGISTRY,
      );

      // Fail loudly rather than prove nothing if the fork block predates the pool.
      expect(await poolRegistry.getVTokenForAsset(LIVE_ISOLATED_POOL, USDT)).to.not.equal(
        hre.ethers.constants.AddressZero,
      );

      deployedRegistry = await psr.poolRegistry();
      deployedTotalDistributions = await psr.totalDistributions();
      deployedTargets = [];
      for (let i = 0; i < deployedTotalDistributions.toNumber(); i++) {
        const target = await psr.distributionTargets(i);
        deployedTargets.push({
          schema: target.schema,
          percentage: target.percentage,
          destination: target.destination,
        });
      }
      deployedUsdtTotalReserve = await psr.totalAssetReserve(USDT);
      deployedIsolatedSpread = await psr.assetsReserves(LIVE_ISOLATED_POOL, USDT, SCHEMA_PROTOCOL_RESERVE);

      // A separate pool registry, and a pool the isolated-pools registry has never heard of.
      spokeRegistry = await smock.fake<IPoolRegistry>("IPoolRegistry");
      spokeComptroller = await smock.fake<IComptroller>("IComptroller");
      spokeComptroller.isComptroller.returns(true);
      spokeRegistry.getVTokenForAsset.returns(hre.ethers.constants.AddressZero);
      spokeRegistry.getVTokenForAsset
        .whenCalledWith(spokeComptroller.address, USDT)
        .returns("0x0000000000000000000000000000000000000001");

      const factory = await hre.ethers.getContractFactory("ProtocolShareReserve");
      const newImpl = await factory.deploy(CORE_POOL_COMPTROLLER, WBNB, VBNB);
      await newImpl.deployed();

      const proxyAdmin = await hre.ethers.getContractAt(
        ["function upgrade(address proxy, address implementation) external"],
        DEFAULT_PROXY_ADMIN,
      );
      await proxyAdmin.connect(timelock).upgrade(PROTOCOL_SHARE_RESERVE, newImpl.address);
    });

    describe("the upgrade itself", () => {
      it("leaves the primary registry pointed where it was", async () => {
        expect(await psr.poolRegistry()).to.equal(deployedRegistry);
        expect(deployedRegistry).to.equal(POOL_REGISTRY);
      });

      it("preserves the distribution configuration", async () => {
        expect(await psr.totalDistributions()).to.equal(deployedTotalDistributions);

        for (let i = 0; i < deployedTargets.length; i++) {
          const target = await psr.distributionTargets(i);
          expect(target.schema).to.equal(deployedTargets[i].schema);
          expect(target.percentage).to.equal(deployedTargets[i].percentage);
          expect(target.destination).to.equal(deployedTargets[i].destination);
        }
      });

      it("preserves the income accounting", async () => {
        expect(await psr.totalAssetReserve(USDT)).to.equal(deployedUsdtTotalReserve);
        expect(await psr.assetsReserves(LIVE_ISOLATED_POOL, USDT, SCHEMA_PROTOCOL_RESERVE)).to.equal(
          deployedIsolatedSpread,
        );
      });

      it("starts with an empty additional registry set", async () => {
        expect(await psr.totalAdditionalPoolRegistries()).to.equal(0);
        expect(await psr.getPoolRegistries()).to.deep.equal([POOL_REGISTRY]);
      });
    });

    describe("resolving markets", () => {
      it("rejects the spoke pool before its registry is added", async () => {
        expect(await psr.isMarketRegistered(spokeComptroller.address, USDT)).to.equal(false);
        await expect(reportIncome(spokeComptroller.address, USDT, SPREAD_INCOME)).to.be.reverted;
      });

      it("accepts the spoke pool once governance adds its registry", async () => {
        await psr.connect(timelock).addPoolRegistry(spokeRegistry.address);

        expect(await psr.isAdditionalPoolRegistry(spokeRegistry.address)).to.equal(true);
        expect(await psr.getPoolRegistries()).to.deep.equal([POOL_REGISTRY, spokeRegistry.address]);
        expect(await psr.isMarketRegistered(spokeComptroller.address, USDT)).to.equal(true);
      });

      it("keeps accepting the live isolated pool at the same time", async () => {
        // Adding a registry, unlike repointing one, leaves the primary untouched.
        expect(await psr.poolRegistry()).to.equal(POOL_REGISTRY);
        expect(await psr.isMarketRegistered(LIVE_ISOLATED_POOL, USDT)).to.equal(true);

        await usdt.connect(whale).transfer(PROTOCOL_SHARE_RESERVE, INCOME);
        await reportIncome(LIVE_ISOLATED_POOL, USDT, SPREAD_INCOME);

        expect(await psr.assetsReserves(LIVE_ISOLATED_POOL, USDT, SCHEMA_PROTOCOL_RESERVE)).to.equal(
          deployedIsolatedSpread.add(INCOME),
        );
      });

      it("books spoke income under the spoke comptroller", async () => {
        const before = await psr.assetsReserves(spokeComptroller.address, USDT, SCHEMA_ADDITIONAL_REVENUE);
        const totalBefore = await psr.totalAssetReserve(USDT);

        await usdt.connect(whale).transfer(PROTOCOL_SHARE_RESERVE, INCOME);
        await reportIncome(spokeComptroller.address, USDT, LIQUIDATION_INCOME);

        expect(await psr.assetsReserves(spokeComptroller.address, USDT, SCHEMA_ADDITIONAL_REVENUE)).to.equal(
          before.add(INCOME),
        );
        expect(await psr.totalAssetReserve(USDT)).to.equal(totalBefore.add(INCOME));
        // The isolated pool's ledger is untouched by the spoke's income.
        expect(await psr.assetsReserves(LIVE_ISOLATED_POOL, USDT, SCHEMA_PROTOCOL_RESERVE)).to.equal(
          deployedIsolatedSpread.add(INCOME),
        );
      });

      it("still bypasses the registries for the core pool", async () => {
        const before = await psr.assetsReserves(CORE_POOL_COMPTROLLER, USDT, SCHEMA_PROTOCOL_RESERVE);

        await usdt.connect(whale).transfer(PROTOCOL_SHARE_RESERVE, INCOME);
        await reportIncome(CORE_POOL_COMPTROLLER, USDT, SPREAD_INCOME);

        expect(await psr.assetsReserves(CORE_POOL_COMPTROLLER, USDT, SCHEMA_PROTOCOL_RESERVE)).to.equal(
          before.add(INCOME),
        );
      });

      it("re-blocks the spoke pool when governance removes its registry", async () => {
        await psr.connect(timelock).removePoolRegistry(spokeRegistry.address);

        expect(await psr.isMarketRegistered(spokeComptroller.address, USDT)).to.equal(false);
        expect(await psr.isMarketRegistered(LIVE_ISOLATED_POOL, USDT)).to.equal(true);
        await expect(reportIncome(spokeComptroller.address, USDT, SPREAD_INCOME)).to.be.reverted;

        await psr.connect(timelock).addPoolRegistry(spokeRegistry.address);
      });
    });

    describe("access control", () => {
      it("restricts addPoolRegistry to the owner", async () => {
        expect(await psr.owner()).to.equal(NORMAL_TIMELOCK);
        await expect(psr.connect(deployer).addPoolRegistry(spokeRegistry.address)).to.be.revertedWith(
          "Ownable: caller is not the owner",
        );
      });

      it("restricts removePoolRegistry to the owner", async () => {
        await expect(psr.connect(deployer).removePoolRegistry(spokeRegistry.address)).to.be.revertedWith(
          "Ownable: caller is not the owner",
        );
      });
    });
  });
});
