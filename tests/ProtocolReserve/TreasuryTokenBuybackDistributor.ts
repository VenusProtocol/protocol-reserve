import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import {
  MockDeflatingToken__factory,
  MockToken,
  MockToken__factory,
  MockVAI,
  MockVAI__factory,
  MockVaiPsm,
  MockVaiPsm__factory,
  TreasuryTokenBuybackDistributor,
  TreasuryTokenBuybackDistributor__factory,
} from "../../typechain";

const { expect } = chai;

const MAX_BPS = BigNumber.from(10_000);
const WEIGHTS = {
  btcb: BigNumber.from(1_500),
  eth: BigNumber.from(1_500),
  xvs: BigNumber.from(1_000),
  usdt: BigNumber.from(1_500),
  usdc: BigNumber.from(1_500),
  u: BigNumber.from(3_000),
};

// Six distinct EOAs stand in for the six Treasury TokenBuyback proxies. The distributor only
// does plain ERC20 transfers to them, so their bytecode is irrelevant to what we assert.
let btcbBuyback: string;
let ethBuyback: string;
let xvsBuyback: string;
let usdtBuyback: string;
let usdcBuyback: string;
let uBuyback: string;
// Placeholder VAI / PSM / stable-token wiring for the tests that don't exercise the PSM path
// (the constructor only nonzero-checks them, so plain EOAs suffice here).
let vai: string;
let vaiPsm: string;
let stableToken: string;

let distributor: TreasuryTokenBuybackDistributor;

async function deployDistributor(): Promise<TreasuryTokenBuybackDistributor> {
  const factory = (await ethers.getContractFactory(
    "TreasuryTokenBuybackDistributor",
  )) as TreasuryTokenBuybackDistributor__factory;
  return factory.deploy(
    btcbBuyback,
    ethBuyback,
    xvsBuyback,
    usdtBuyback,
    usdcBuyback,
    uBuyback,
    vai,
    vaiPsm,
    stableToken,
  );
}

async function fixture(): Promise<{ distributor: TreasuryTokenBuybackDistributor }> {
  return { distributor: await deployDistributor() };
}

async function deployToken(decimals = 18): Promise<MockToken> {
  const factory = (await ethers.getContractFactory("MockToken")) as MockToken__factory;
  return factory.deploy("Mock", "MCK", decimals);
}

before(async () => {
  const signers = await ethers.getSigners();
  // signers[1..6] act as the six buyback destinations
  btcbBuyback = await signers[1].getAddress();
  ethBuyback = await signers[2].getAddress();
  xvsBuyback = await signers[3].getAddress();
  usdtBuyback = await signers[4].getAddress();
  usdcBuyback = await signers[5].getAddress();
  uBuyback = await signers[6].getAddress();
  vai = await signers[7].getAddress();
  vaiPsm = await signers[8].getAddress();
  stableToken = await signers[9].getAddress();
});

describe("TreasuryTokenBuybackDistributor", () => {
  beforeEach(async () => {
    ({ distributor } = await loadFixture(fixture));
  });

  describe("deployment / configuration", () => {
    it("stores the six buyback addresses as immutables", async () => {
      expect(await distributor.BTCB_BUYBACK()).to.equal(btcbBuyback);
      expect(await distributor.ETH_BUYBACK()).to.equal(ethBuyback);
      expect(await distributor.XVS_BUYBACK()).to.equal(xvsBuyback);
      expect(await distributor.USDT_BUYBACK()).to.equal(usdtBuyback);
      expect(await distributor.USDC_BUYBACK()).to.equal(usdcBuyback);
      expect(await distributor.U_BUYBACK()).to.equal(uBuyback);
    });

    it("weights sum to MAX_BPS (100%)", async () => {
      const sum = (await distributor.BTCB_WEIGHT())
        .add(await distributor.ETH_WEIGHT())
        .add(await distributor.XVS_WEIGHT())
        .add(await distributor.USDT_WEIGHT())
        .add(await distributor.USDC_WEIGHT())
        .add(await distributor.U_WEIGHT());
      expect(sum).to.equal(await distributor.MAX_BPS());
      expect(sum).to.equal(MAX_BPS);
    });

    it("stores the VAI / PSM / stable-token wiring as immutables", async () => {
      expect(await distributor.VAI()).to.equal(vai);
      expect(await distributor.VAI_PSM()).to.equal(vaiPsm);
      expect(await distributor.STABLE_TOKEN()).to.equal(stableToken);
    });

    it("reverts if any constructor address is zero", async () => {
      const factory = (await ethers.getContractFactory(
        "TreasuryTokenBuybackDistributor",
      )) as TreasuryTokenBuybackDistributor__factory;
      const z = ethers.constants.AddressZero;
      await expect(
        factory.deploy(z, ethBuyback, xvsBuyback, usdtBuyback, usdcBuyback, uBuyback, vai, vaiPsm, stableToken),
      ).to.be.reverted;
      await expect(
        factory.deploy(btcbBuyback, ethBuyback, xvsBuyback, usdtBuyback, usdcBuyback, z, vai, vaiPsm, stableToken),
      ).to.be.reverted;
      await expect(
        factory.deploy(btcbBuyback, ethBuyback, xvsBuyback, usdtBuyback, usdcBuyback, uBuyback, z, vaiPsm, stableToken),
      ).to.be.reverted;
      await expect(
        factory.deploy(btcbBuyback, ethBuyback, xvsBuyback, usdtBuyback, usdcBuyback, uBuyback, vai, z, stableToken),
      ).to.be.reverted;
      await expect(
        factory.deploy(btcbBuyback, ethBuyback, xvsBuyback, usdtBuyback, usdcBuyback, uBuyback, vai, vaiPsm, z),
      ).to.be.reverted;
    });
  });

  describe("distribute", () => {
    it("splits a single token by weight, remainder (dust) to U", async () => {
      const token = await deployToken(18);
      // Choose an amount that does NOT divide evenly by MAX_BPS so dust routes to U.
      const total = parseUnits("100", 18).add(7); // +7 wei of dust
      await token.allocateTo(distributor.address, total);

      await expect(distributor.distribute([token.address]))
        .to.emit(distributor, "TokenDistributed")
        .withArgs(token.address, total);

      const expected = (w: BigNumber) => total.mul(w).div(MAX_BPS);
      expect(await token.balanceOf(btcbBuyback)).to.equal(expected(WEIGHTS.btcb));
      expect(await token.balanceOf(ethBuyback)).to.equal(expected(WEIGHTS.eth));
      expect(await token.balanceOf(xvsBuyback)).to.equal(expected(WEIGHTS.xvs));
      expect(await token.balanceOf(usdtBuyback)).to.equal(expected(WEIGHTS.usdt));
      expect(await token.balanceOf(usdcBuyback)).to.equal(expected(WEIGHTS.usdc));

      // U gets the remainder = total - sum(other five legs), which >= nominal 30% share.
      const otherFive = expected(WEIGHTS.btcb)
        .add(expected(WEIGHTS.eth))
        .add(expected(WEIGHTS.xvs))
        .add(expected(WEIGHTS.usdt))
        .add(expected(WEIGHTS.usdc));
      const expectedU = total.sub(otherFive);
      expect(await token.balanceOf(uBuyback)).to.equal(expectedU);
      expect(expectedU).to.be.gte(expected(WEIGHTS.u)); // U absorbs the dust

      // Distributor fully drained.
      expect(await token.balanceOf(distributor.address)).to.equal(0);
    });

    it("distributes exactly by weight when the amount divides evenly", async () => {
      const token = await deployToken(18);
      const total = MAX_BPS.mul(parseUnits("1", 18)); // divisible by 10000
      await token.allocateTo(distributor.address, total);

      await distributor.distribute([token.address]);

      expect(await token.balanceOf(btcbBuyback)).to.equal(total.mul(WEIGHTS.btcb).div(MAX_BPS));
      expect(await token.balanceOf(uBuyback)).to.equal(total.mul(WEIGHTS.u).div(MAX_BPS));
      expect(await token.balanceOf(distributor.address)).to.equal(0);
    });

    it("skips tokens with a zero balance (no transfers, no event)", async () => {
      const token = await deployToken(18);
      await expect(distributor.distribute([token.address])).to.not.emit(distributor, "TokenDistributed");
      expect(await token.balanceOf(uBuyback)).to.equal(0);
    });

    it("handles a batch of tokens with differing decimals in one call", async () => {
      const t18 = await deployToken(18);
      const t6 = await deployToken(6);
      const total18 = parseUnits("500", 18).add(3);
      const total6 = parseUnits("500", 6).add(9);
      await t18.allocateTo(distributor.address, total18);
      await t6.allocateTo(distributor.address, total6);

      await distributor.distribute([t18.address, t6.address]);

      for (const [tk, total] of [
        [t18, total18],
        [t6, total6],
      ] as const) {
        expect(await tk.balanceOf(btcbBuyback)).to.equal(total.mul(WEIGHTS.btcb).div(MAX_BPS));
        expect(await tk.balanceOf(xvsBuyback)).to.equal(total.mul(WEIGHTS.xvs).div(MAX_BPS));
        expect(await tk.balanceOf(distributor.address)).to.equal(0);
      }
    });

    it("is idempotent for a repeated token in the same batch (second pass is a no-op)", async () => {
      const token = await deployToken(18);
      const total = parseUnits("100", 18);
      await token.allocateTo(distributor.address, total);

      // TokenDistributed should fire exactly once (second pass sees a zero balance).
      const tx = await distributor.distribute([token.address, token.address]);
      const receipt = await tx.wait();
      const events = receipt.events?.filter(e => e.event === "TokenDistributed") ?? [];
      expect(events.length).to.equal(1);
      expect(await token.balanceOf(distributor.address)).to.equal(0);
    });

    it("drains a fee-on-transfer token to zero (remainder leg absorbs the fee wobble)", async () => {
      const factory = (await ethers.getContractFactory("MockDeflatingToken")) as MockDeflatingToken__factory;
      const total = parseUnits("1000", 18);
      const token = await factory.deploy(total);
      await token.transfer(distributor.address, total);
      const held = await token.balanceOf(distributor.address); // net of the transfer fee

      await distributor.distribute([token.address]);

      // Regardless of the per-leg fee, the distributor must end at zero.
      expect(await token.balanceOf(distributor.address)).to.equal(0);
      // BTCB leg received (held * 15%) minus its own transfer fee (1%).
      const nominalBtcb = held.mul(WEIGHTS.btcb).div(MAX_BPS);
      expect(await token.balanceOf(btcbBuyback)).to.equal(nominalBtcb.sub(nominalBtcb.div(100)));
    });
  });

  describe("convertVaiViaPsm", () => {
    const ONE = parseUnits("1", 18);
    const FEE_OUT = BigNumber.from(10); // 0.10%, matching bscmainnet PegStability_USDT

    let vaiToken: MockVAI;
    let stable: MockToken;
    let psm: MockVaiPsm;
    let treasury: string;
    let psmDistributor: TreasuryTokenBuybackDistributor;

    // Replicates the contract's on-chain sizing so tests assert exact amounts.
    const expectedStableOut = (vaiBal: BigNumber, price: BigNumber) => {
      const priceOut = price.gt(ONE) ? price : ONE;
      return vaiBal.mul(MAX_BPS).mul(ONE).div(MAX_BPS.add(FEE_OUT).mul(priceOut));
    };
    const requiredVai = (stableOut: BigNumber, price: BigNumber) => {
      const priceOut = price.gt(ONE) ? price : ONE;
      const stableUSD = stableOut.mul(priceOut).div(ONE);
      const fee = stableUSD.mul(FEE_OUT).div(MAX_BPS);
      return { stableUSD, fee, total: stableUSD.add(fee) };
    };

    async function setup(price = ONE, psmStableReserves = parseUnits("2000000", 18)) {
      treasury = await (await ethers.getSigners())[10].getAddress();
      vaiToken = await ((await ethers.getContractFactory("MockVAI")) as MockVAI__factory).deploy();
      stable = await deployToken(18); // USDT (18 decimals on BSC)
      psm = await ((await ethers.getContractFactory("MockVaiPsm")) as MockVaiPsm__factory).deploy(
        vaiToken.address,
        stable.address,
        treasury,
        FEE_OUT,
        price,
      );
      // Fund the PSM with stable reserves to pay out redemptions.
      await stable.allocateTo(psm.address, psmStableReserves);

      const factory = (await ethers.getContractFactory(
        "TreasuryTokenBuybackDistributor",
      )) as TreasuryTokenBuybackDistributor__factory;
      psmDistributor = await factory.deploy(
        btcbBuyback,
        ethBuyback,
        xvsBuyback,
        usdtBuyback,
        usdcBuyback,
        uBuyback,
        vaiToken.address,
        psm.address,
        stable.address,
      );
    }

    it("redeems the held VAI for the stable token at the PSM (peg price)", async () => {
      await setup();
      const vaiBal = parseUnits("526974", 18).add(123); // odd wei to exercise flooring
      await vaiToken.mint(psmDistributor.address, vaiBal);

      const stableOut = expectedStableOut(vaiBal, ONE);
      const { fee, total } = requiredVai(stableOut, ONE);

      await expect(psmDistributor.convertVaiViaPsm())
        .to.emit(psmDistributor, "VaiConvertedViaPsm")
        .withArgs(total, stableOut);

      // Distributor received exactly stableOut USDT and holds no more than sub-fee VAI dust.
      expect(await stable.balanceOf(psmDistributor.address)).to.equal(stableOut);
      expect(await vaiToken.balanceOf(psmDistributor.address)).to.equal(vaiBal.sub(total));
      // Leftover VAI is negligible dust (bounded by the fee granularity of a single swap).
      expect(vaiBal.sub(total)).to.be.lt(parseUnits("1", 18));
      // Fee VAI landed in the PSM treasury; approval was reset to zero afterwards.
      expect(await vaiToken.balanceOf(treasury)).to.equal(fee);
      expect(await vaiToken.allowance(psmDistributor.address, psm.address)).to.equal(0);
    });

    it("is a no-op when the contract holds no VAI", async () => {
      await setup();
      await expect(psmDistributor.convertVaiViaPsm()).to.not.emit(psmDistributor, "VaiConvertedViaPsm");
      expect(await stable.balanceOf(psmDistributor.address)).to.equal(0);
    });

    it("falls back gracefully (no revert) when the PSM swap reverts, leaving VAI intact", async () => {
      await setup();
      const vaiBal = parseUnits("100000", 18);
      await vaiToken.mint(psmDistributor.address, vaiBal);
      await psm.setForceRevert(true);

      await expect(psmDistributor.convertVaiViaPsm()).to.not.be.reverted;
      // VAI untouched, no stable received, and the transient approval was cleaned up (never granted).
      expect(await vaiToken.balanceOf(psmDistributor.address)).to.equal(vaiBal);
      expect(await stable.balanceOf(psmDistributor.address)).to.equal(0);
      expect(await vaiToken.allowance(psmDistributor.address, psm.address)).to.equal(0);
    });

    it("does not over-ask when the stable trades above peg (priceOut > 1$)", async () => {
      const price = parseUnits("1.005", 18); // stable at $1.005
      await setup(price);
      const vaiBal = parseUnits("50000", 18);
      await vaiToken.mint(psmDistributor.address, vaiBal);

      const stableOut = expectedStableOut(vaiBal, price);
      await expect(psmDistributor.convertVaiViaPsm()).to.emit(psmDistributor, "VaiConvertedViaPsm");

      expect(await stable.balanceOf(psmDistributor.address)).to.equal(stableOut);
      // Required VAI never exceeded the balance (no revert / fallback), leaving only small dust.
      const { total } = requiredVai(stableOut, price);
      expect(await vaiToken.balanceOf(psmDistributor.address)).to.equal(vaiBal.sub(total));
    });

    it("hands the redeemed stable token off to distribute (split across the six buybacks)", async () => {
      await setup();
      const vaiBal = parseUnits("400000", 18);
      await vaiToken.mint(psmDistributor.address, vaiBal);

      await psmDistributor.convertVaiViaPsm();
      const stableOut = await stable.balanceOf(psmDistributor.address);

      // Mirrors the VIP: distribute the VAI (now dust) and the freshly received USDT.
      await psmDistributor.distribute([vaiToken.address, stable.address]);

      expect(await stable.balanceOf(btcbBuyback)).to.equal(stableOut.mul(WEIGHTS.btcb).div(MAX_BPS));
      expect(await stable.balanceOf(usdcBuyback)).to.equal(stableOut.mul(WEIGHTS.usdc).div(MAX_BPS));
      expect(await stable.balanceOf(psmDistributor.address)).to.equal(0);
    });

    it("rejects a direct call to the internal _convertVaiViaPsm (only self)", async () => {
      await setup();
      await expect(psmDistributor._convertVaiViaPsm()).to.be.revertedWithCustomError(psmDistributor, "OnlySelf");
    });
  });
});
