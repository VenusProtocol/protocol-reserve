import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { BigNumber, Signer, constants } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import {
  IAccessControlManagerV8,
  MockRouter,
  MockRouter__factory,
  MockToken,
  MockToken__factory,
  ResilientOracleInterface,
  TokenBuyback,
  TokenBuyback__factory,
} from "../../typechain";

const { expect } = chai;
chai.use(smock.matchers);

const AMOUNT_IN = parseUnits("100", 18);
const AMOUNT_OUT = parseUnits("200", 6);
const MIN_AMOUNT_OUT = parseUnits("190", 6);

// Test caps are intentionally large so the cap path is inert by default; tests that
// exercise cap behaviour override these via setDailyCapUsd / setPerBlockCapUsd.
const TEST_DAILY_CAP_USD = parseUnits("1000000000", 18);
const TEST_PER_BLOCK_CAP_USD = parseUnits("1000000000", 18);
const TEST_SLIPPAGE_EVENT_USD = parseUnits("500", 18);

// Oracle prices follow the Venus convention `getPrice(asset)` = USD * 10^(36 - decimals).
// tokenIn has 18 decimals → price = 1e18 represents $1; baseAsset has 6 decimals → 1e30 = $1.
const TOKEN_IN_PRICE = parseUnits("1", 18);
const BASE_ASSET_PRICE = parseUnits("1", 30);

let accessControl: FakeContract<IAccessControlManagerV8>;
let tokenIn: MockContract<MockToken>;
let baseAsset: MockContract<MockToken>;
let router: MockRouter;
let oracle: FakeContract<ResilientOracleInterface>;
let buyback: MockContract<TokenBuyback>;
let buybackAlt: MockContract<TokenBuyback>;
let owner: Signer;
let nonOwner: Signer;
let destinationEOA: Signer;
let destinationAltEOA: Signer;
let comptroller: Signer;
let psr: Signer;

const BUYBACK_SIG = "executeBuyback(address,uint256,uint256,uint256,address,bytes,address)";
const FORWARD_SIG = "forwardBaseAsset(address,uint256)";
const SET_DAILY_CAP_SIG = "setDailyCapUsd(uint256)";
const SET_PER_BLOCK_CAP_SIG = "setPerBlockCapUsd(uint256)";
const SET_SLIPPAGE_EVENT_SIG = "setSlippageEventUsd(uint256)";

async function deployBuyback(destination: string): Promise<MockContract<TokenBuyback>> {
  const TokenBuybackFactory = await smock.mock<TokenBuyback__factory>("TokenBuyback");
  return upgrades.deployProxy(
    TokenBuybackFactory,
    [accessControl.address, TEST_DAILY_CAP_USD, TEST_PER_BLOCK_CAP_USD, TEST_SLIPPAGE_EVENT_USD],
    {
      constructorArgs: [destination, baseAsset.address, await psr.getAddress(), oracle.address],
    },
  );
}

async function encodeSwap(amountIn: BigNumber, amountOut: BigNumber, recipient: string): Promise<string> {
  return router.interface.encodeFunctionData("swap", [
    tokenIn.address,
    amountIn,
    baseAsset.address,
    amountOut,
    recipient,
  ]);
}

function futureDeadline(): number {
  return Math.floor(Date.now() / 1000) + 3600;
}

async function fixture(): Promise<void> {
  [owner, nonOwner, destinationEOA, destinationAltEOA, comptroller, psr] = await ethers.getSigners();

  accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  accessControl.isAllowedToCall.returns(true);

  const MockTokenFactory = await smock.mock<MockToken__factory>("MockToken");
  tokenIn = await MockTokenFactory.deploy("TokenIn", "TKI", 18);
  baseAsset = await MockTokenFactory.deploy("BaseAsset", "BASE", 6);

  const RouterFactory = (await ethers.getContractFactory("MockRouter")) as MockRouter__factory;
  router = await RouterFactory.deploy();

  oracle = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
  oracle.getPrice.whenCalledWith(tokenIn.address).returns(TOKEN_IN_PRICE);
  oracle.getPrice.whenCalledWith(baseAsset.address).returns(BASE_ASSET_PRICE);

  buyback = await deployBuyback(await destinationEOA.getAddress());
  buybackAlt = await deployBuyback(await destinationAltEOA.getAddress());

  await buyback.setAllowedRouter(router.address, true);
  await buybackAlt.setAllowedRouter(router.address, true);

  await tokenIn.faucet(parseUnits("10000", 18));
  await baseAsset.faucet(parseUnits("20000", 6));

  await baseAsset.approve(router.address, parseUnits("10000", 6));
  await router.fund(baseAsset.address, parseUnits("10000", 6));
}

describe("TokenBuyback", () => {
  beforeEach(async () => {
    await loadFixture(fixture);
    accessControl.isAllowedToCall.reset();
    accessControl.isAllowedToCall.returns(true);
  });

  describe("Initialization", () => {
    it("sets immutables from constructor", async () => {
      expect(await buyback.DESTINATION()).to.equal(await destinationEOA.getAddress());
      expect(await buyback.BASE_ASSET()).to.equal(baseAsset.address);
      expect(await buyback.PROTOCOL_SHARE_RESERVE()).to.equal(await psr.getAddress());
      expect(await buyback.RESILIENT_ORACLE()).to.equal(oracle.address);

      expect(await buybackAlt.DESTINATION()).to.equal(await destinationAltEOA.getAddress());
    });

    it("seeds cap config and window start from initialize", async () => {
      expect(await buyback.dailyCapUsd()).to.equal(TEST_DAILY_CAP_USD);
      expect(await buyback.perBlockCapUsd()).to.equal(TEST_PER_BLOCK_CAP_USD);
      expect(await buyback.slippageEventUsd()).to.equal(TEST_SLIPPAGE_EVENT_USD);
      expect(await buyback.windowStart()).to.be.gt(0);
    });

    it("constructor reverts on zero destination", async () => {
      const TokenBuybackFactory = await smock.mock<TokenBuyback__factory>("TokenBuyback");
      await expect(
        upgrades.deployProxy(
          TokenBuybackFactory,
          [accessControl.address, TEST_DAILY_CAP_USD, TEST_PER_BLOCK_CAP_USD, TEST_SLIPPAGE_EVENT_USD],
          {
            constructorArgs: [constants.AddressZero, baseAsset.address, await psr.getAddress(), oracle.address],
          },
        ),
      ).to.be.reverted;
    });

    it("constructor reverts on zero base asset", async () => {
      const TokenBuybackFactory = await smock.mock<TokenBuyback__factory>("TokenBuyback");
      await expect(
        upgrades.deployProxy(
          TokenBuybackFactory,
          [accessControl.address, TEST_DAILY_CAP_USD, TEST_PER_BLOCK_CAP_USD, TEST_SLIPPAGE_EVENT_USD],
          {
            constructorArgs: [
              await destinationEOA.getAddress(),
              constants.AddressZero,
              await psr.getAddress(),
              oracle.address,
            ],
          },
        ),
      ).to.be.reverted;
    });

    it("constructor reverts on zero protocol share reserve", async () => {
      const TokenBuybackFactory = await smock.mock<TokenBuyback__factory>("TokenBuyback");
      await expect(
        upgrades.deployProxy(
          TokenBuybackFactory,
          [accessControl.address, TEST_DAILY_CAP_USD, TEST_PER_BLOCK_CAP_USD, TEST_SLIPPAGE_EVENT_USD],
          {
            constructorArgs: [
              await destinationEOA.getAddress(),
              baseAsset.address,
              constants.AddressZero,
              oracle.address,
            ],
          },
        ),
      ).to.be.reverted;
    });

    it("constructor reverts on zero resilient oracle", async () => {
      const TokenBuybackFactory = await smock.mock<TokenBuyback__factory>("TokenBuyback");
      await expect(
        upgrades.deployProxy(
          TokenBuybackFactory,
          [accessControl.address, TEST_DAILY_CAP_USD, TEST_PER_BLOCK_CAP_USD, TEST_SLIPPAGE_EVENT_USD],
          {
            constructorArgs: [
              await destinationEOA.getAddress(),
              baseAsset.address,
              await psr.getAddress(),
              constants.AddressZero,
            ],
          },
        ),
      ).to.be.reverted;
    });

    it("reverts on double initialize", async () => {
      await expect(
        buyback.initialize(accessControl.address, TEST_DAILY_CAP_USD, TEST_PER_BLOCK_CAP_USD, TEST_SLIPPAGE_EVENT_USD),
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("updateAssetsState", () => {
    it("emits AssetsReceived with the first-deposit delta", async () => {
      await tokenIn.transfer(buyback.address, AMOUNT_IN);
      const comptrollerAddr = await comptroller.getAddress();

      await expect(buyback.connect(psr).updateAssetsState(comptrollerAddr, tokenIn.address))
        .to.emit(buyback, "AssetsReceived")
        .withArgs(comptrollerAddr, tokenIn.address, AMOUNT_IN);

      expect(await buyback.assetsReserves(tokenIn.address)).to.equal(AMOUNT_IN);
    });

    it("reverts UnauthorizedCaller when msg.sender is not PROTOCOL_SHARE_RESERVE", async () => {
      await expect(buyback.connect(nonOwner).updateAssetsState(await comptroller.getAddress(), tokenIn.address))
        .to.be.revertedWithCustomError(buyback, "UnauthorizedCaller")
        .withArgs(await nonOwner.getAddress());
    });

    it("reverts UnauthorizedCaller when owner calls it (PSR is the only permitted caller)", async () => {
      await expect(buyback.connect(owner).updateAssetsState(await comptroller.getAddress(), tokenIn.address))
        .to.be.revertedWithCustomError(buyback, "UnauthorizedCaller")
        .withArgs(await owner.getAddress());
    });

    // Regression: attacker with no permissions attempts to forge per-pool attribution
    // by donating D tokens and then calling updateAssetsState for a spoofed comptroller.
    // With the PROTOCOL_SHARE_RESERVE gate the call reverts before any AssetsReceived
    // event is emitted, so off-chain ledgers can trust the event feed.
    it("reverts donation-spoof attribution attack from arbitrary EOA", async () => {
      const donation = parseUnits("50", 18);
      const fakeComptroller = await nonOwner.getAddress();
      await tokenIn.transfer(buyback.address, donation);

      await expect(buyback.connect(nonOwner).updateAssetsState(fakeComptroller, tokenIn.address))
        .to.be.revertedWithCustomError(buyback, "UnauthorizedCaller")
        .withArgs(fakeComptroller);

      // Watermark untouched, donation remains recoverable via sweepToken
      expect(await buyback.assetsReserves(tokenIn.address)).to.equal(0);
    });

    // POC: PSR.releaseFunds calls safeTransfer+updateAssetsState per-pool-per-asset.
    // Two consecutive deliveries of the same asset from different pools must each
    // report their own delta, not the cumulative contract balance. The pre-fix
    // implementation emitted 100 then 300 (cumulative) instead of 100 then 200.
    it("reports per-call delta across back-to-back pool deliveries (regression)", async () => {
      const comptrollerA = await comptroller.getAddress();
      const comptrollerB = await nonOwner.getAddress();
      const firstDelivery = parseUnits("100", 18);
      const secondDelivery = parseUnits("200", 18);

      await tokenIn.transfer(buyback.address, firstDelivery);
      await expect(buyback.connect(psr).updateAssetsState(comptrollerA, tokenIn.address))
        .to.emit(buyback, "AssetsReceived")
        .withArgs(comptrollerA, tokenIn.address, firstDelivery);

      await tokenIn.transfer(buyback.address, secondDelivery);
      await expect(buyback.connect(psr).updateAssetsState(comptrollerB, tokenIn.address))
        .to.emit(buyback, "AssetsReceived")
        .withArgs(comptrollerB, tokenIn.address, secondDelivery);

      expect(await buyback.assetsReserves(tokenIn.address)).to.equal(firstDelivery.add(secondDelivery));
    });

    it("does not emit AssetsReceived on a no-op call with no new inflow", async () => {
      const comptrollerAddr = await comptroller.getAddress();
      await tokenIn.transfer(buyback.address, AMOUNT_IN);
      await buyback.connect(psr).updateAssetsState(comptrollerAddr, tokenIn.address);

      await expect(buyback.connect(psr).updateAssetsState(comptrollerAddr, tokenIn.address)).to.not.emit(
        buyback,
        "AssetsReceived",
      );
    });

    it("ignores pre-existing dust when computing the first delta", async () => {
      const dust = parseUnits("5", 18);
      const delivery = parseUnits("100", 18);
      const comptrollerAddr = await comptroller.getAddress();

      // Dust arrives before any updateAssetsState bookkeeping (e.g. leftover from a
      // prior partial swap or a donation). The next legitimate PSR delivery should
      // still report the full balance minus the zero watermark — we take a
      // conservative one-time hit, not ongoing inflation.
      await tokenIn.transfer(buyback.address, dust);
      await tokenIn.transfer(buyback.address, delivery);

      await expect(buyback.connect(psr).updateAssetsState(comptrollerAddr, tokenIn.address))
        .to.emit(buyback, "AssetsReceived")
        .withArgs(comptrollerAddr, tokenIn.address, dust.add(delivery));
    });

    it("watermark tracks outflow: buyback then next delivery reports only the new amount", async () => {
      const comptrollerA = await comptroller.getAddress();
      const comptrollerB = await nonOwner.getAddress();
      const firstDelivery = AMOUNT_IN;
      const secondDelivery = parseUnits("50", 18);

      await tokenIn.transfer(buyback.address, firstDelivery);
      await buyback.connect(psr).updateAssetsState(comptrollerA, tokenIn.address);

      const calldata = await encodeSwap(firstDelivery, AMOUNT_OUT, buyback.address);
      await buyback.executeBuyback(
        tokenIn.address,
        firstDelivery,
        MIN_AMOUNT_OUT,
        futureDeadline(),
        router.address,
        calldata,
        comptrollerA,
      );

      expect(await buyback.assetsReserves(tokenIn.address)).to.equal(0);

      await tokenIn.transfer(buyback.address, secondDelivery);
      await expect(buyback.connect(psr).updateAssetsState(comptrollerB, tokenIn.address))
        .to.emit(buyback, "AssetsReceived")
        .withArgs(comptrollerB, tokenIn.address, secondDelivery);
    });

    it("sweepToken resyncs the watermark so subsequent deltas stay accurate", async () => {
      const comptrollerAddr = await comptroller.getAddress();
      const delivery = AMOUNT_IN;
      const sweepAmount = parseUnits("40", 18);
      const topUp = parseUnits("10", 18);

      await tokenIn.transfer(buyback.address, delivery);
      await buyback.connect(psr).updateAssetsState(comptrollerAddr, tokenIn.address);

      await buyback.sweepToken(tokenIn.address, await owner.getAddress(), sweepAmount);
      expect(await buyback.assetsReserves(tokenIn.address)).to.equal(delivery.sub(sweepAmount));

      await tokenIn.transfer(buyback.address, topUp);
      await expect(buyback.connect(psr).updateAssetsState(comptrollerAddr, tokenIn.address))
        .to.emit(buyback, "AssetsReceived")
        .withArgs(comptrollerAddr, tokenIn.address, topUp);
    });

    it("forwardBaseAsset resyncs BASE_ASSET watermark", async () => {
      const comptrollerAddr = await comptroller.getAddress();
      const firstDrop = parseUnits("300", 6);
      const secondDrop = parseUnits("100", 6);

      await baseAsset.transfer(buyback.address, firstDrop);
      await buyback.connect(psr).updateAssetsState(comptrollerAddr, baseAsset.address);
      expect(await buyback.assetsReserves(baseAsset.address)).to.equal(firstDrop);

      await buyback.forwardBaseAsset(comptrollerAddr, firstDrop);
      expect(await buyback.assetsReserves(baseAsset.address)).to.equal(0);

      await baseAsset.transfer(buyback.address, secondDrop);
      await expect(buyback.connect(psr).updateAssetsState(comptrollerAddr, baseAsset.address))
        .to.emit(buyback, "AssetsReceived")
        .withArgs(comptrollerAddr, baseAsset.address, secondDrop);
    });
  });

  describe("setAllowedRouter", () => {
    it("only owner can set", async () => {
      await expect(buyback.connect(nonOwner).setAllowedRouter(router.address, true)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("reverts on zero address", async () => {
      await expect(buyback.setAllowedRouter(constants.AddressZero, true)).to.be.revertedWithCustomError(
        buyback,
        "ZeroAddressNotAllowed",
      );
    });

    it("toggles router allowlist and emits event", async () => {
      const other = await nonOwner.getAddress();
      await expect(buyback.setAllowedRouter(other, true)).to.emit(buyback, "RouterAllowlisted").withArgs(other, true);
      expect(await buyback.allowedRouters(other)).to.equal(true);

      await expect(buyback.setAllowedRouter(other, false)).to.emit(buyback, "RouterAllowlisted").withArgs(other, false);
      expect(await buyback.allowedRouters(other)).to.equal(false);
    });
  });

  describe("sweepToken", () => {
    beforeEach(async () => {
      await tokenIn.transfer(buyback.address, AMOUNT_IN);
    });

    it("only owner", async () => {
      await expect(
        buyback.connect(nonOwner).sweepToken(tokenIn.address, await nonOwner.getAddress(), AMOUNT_IN),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("reverts on zero token", async () => {
      await expect(
        buyback.sweepToken(constants.AddressZero, await owner.getAddress(), AMOUNT_IN),
      ).to.be.revertedWithCustomError(buyback, "ZeroAddressNotAllowed");
    });

    it("reverts on zero recipient", async () => {
      await expect(buyback.sweepToken(tokenIn.address, constants.AddressZero, AMOUNT_IN)).to.be.revertedWithCustomError(
        buyback,
        "ZeroAddressNotAllowed",
      );
    });

    it("reverts on zero amount", async () => {
      await expect(buyback.sweepToken(tokenIn.address, await owner.getAddress(), 0)).to.be.revertedWithCustomError(
        buyback,
        "ZeroValueNotAllowed",
      );
    });

    it("transfers and emits SweepToken", async () => {
      const recipient = await owner.getAddress();
      await expect(buyback.sweepToken(tokenIn.address, recipient, AMOUNT_IN))
        .to.emit(buyback, "SweepToken")
        .withArgs(tokenIn.address, recipient, AMOUNT_IN);
    });
  });

  describe("executeBuyback", () => {
    beforeEach(async () => {
      await tokenIn.transfer(buyback.address, AMOUNT_IN);
      await tokenIn.transfer(buybackAlt.address, AMOUNT_IN);
    });

    it("happy path — forwards swap output to DESTINATION", async () => {
      const calldata = await encodeSwap(AMOUNT_IN, AMOUNT_OUT, buyback.address);
      const destAddr = await destinationEOA.getAddress();
      const before = await baseAsset.balanceOf(destAddr);

      const tx = buyback.executeBuyback(
        tokenIn.address,
        AMOUNT_IN,
        MIN_AMOUNT_OUT,
        futureDeadline(),
        router.address,
        calldata,
        await comptroller.getAddress(),
      );

      await expect(tx)
        .to.emit(buyback, "BuybackExecuted")
        .withArgs(tokenIn.address, AMOUNT_IN, AMOUNT_OUT, router.address, await comptroller.getAddress());

      expect((await baseAsset.balanceOf(destAddr)).sub(before)).to.equal(AMOUNT_OUT);
      expect(await baseAsset.balanceOf(buyback.address)).to.equal(0);
      expect(await tokenIn.allowance(buyback.address, router.address)).to.equal(0);
    });

    it("reverts when ACM denies", async () => {
      accessControl.isAllowedToCall.whenCalledWith(await owner.getAddress(), BUYBACK_SIG).returns(false);
      const calldata = await encodeSwap(AMOUNT_IN, AMOUNT_OUT, buyback.address);

      await expect(
        buyback.executeBuyback(
          tokenIn.address,
          AMOUNT_IN,
          MIN_AMOUNT_OUT,
          futureDeadline(),
          router.address,
          calldata,
          await comptroller.getAddress(),
        ),
      ).to.be.revertedWithCustomError(buyback, "Unauthorized");
    });

    it("reverts on expired deadline", async () => {
      const calldata = await encodeSwap(AMOUNT_IN, AMOUNT_OUT, buyback.address);
      await expect(
        buyback.executeBuyback(
          tokenIn.address,
          AMOUNT_IN,
          MIN_AMOUNT_OUT,
          1, // past
          router.address,
          calldata,
          await comptroller.getAddress(),
        ),
      ).to.be.revertedWithCustomError(buyback, "DeadlineExpired");
    });

    it("reverts when tokenIn equals BASE_ASSET", async () => {
      const calldata = await encodeSwap(AMOUNT_IN, AMOUNT_OUT, buyback.address);
      await expect(
        buyback.executeBuyback(
          baseAsset.address,
          AMOUNT_IN,
          MIN_AMOUNT_OUT,
          futureDeadline(),
          router.address,
          calldata,
          await comptroller.getAddress(),
        ),
      )
        .to.be.revertedWithCustomError(buyback, "InvalidTokenIn")
        .withArgs(baseAsset.address);
    });

    it("reverts when router not allowed", async () => {
      await buyback.setAllowedRouter(router.address, false);
      const calldata = await encodeSwap(AMOUNT_IN, AMOUNT_OUT, buyback.address);
      await expect(
        buyback.executeBuyback(
          tokenIn.address,
          AMOUNT_IN,
          MIN_AMOUNT_OUT,
          futureDeadline(),
          router.address,
          calldata,
          await comptroller.getAddress(),
        ),
      )
        .to.be.revertedWithCustomError(buyback, "RouterNotAllowed")
        .withArgs(router.address);
    });

    it("reverts on zero amountIn", async () => {
      const calldata = await encodeSwap(AMOUNT_IN, AMOUNT_OUT, buyback.address);
      await expect(
        buyback.executeBuyback(
          tokenIn.address,
          0,
          MIN_AMOUNT_OUT,
          futureDeadline(),
          router.address,
          calldata,
          await comptroller.getAddress(),
        ),
      ).to.be.revertedWithCustomError(buyback, "ZeroValueNotAllowed");
    });

    it("reverts on insufficient balance", async () => {
      const tooMuch = AMOUNT_IN.mul(2);
      const calldata = await encodeSwap(tooMuch, AMOUNT_OUT, buyback.address);
      await expect(
        buyback.executeBuyback(
          tokenIn.address,
          tooMuch,
          MIN_AMOUNT_OUT,
          futureDeadline(),
          router.address,
          calldata,
          await comptroller.getAddress(),
        ),
      )
        .to.be.revertedWithCustomError(buyback, "InsufficientBalance")
        .withArgs(tokenIn.address, tooMuch, AMOUNT_IN);
    });

    it("propagates router error on failure", async () => {
      await router.setShouldFail(true);
      const calldata = await encodeSwap(AMOUNT_IN, AMOUNT_OUT, buyback.address);
      await expect(
        buyback.executeBuyback(
          tokenIn.address,
          AMOUNT_IN,
          MIN_AMOUNT_OUT,
          futureDeadline(),
          router.address,
          calldata,
          await comptroller.getAddress(),
        ),
      ).to.be.revertedWithCustomError(router, "RouterForcedFailure");
    });

    it("reverts on slippage", async () => {
      const lowOutput = parseUnits("100", 6);
      const calldata = await encodeSwap(AMOUNT_IN, lowOutput, buyback.address);
      await expect(
        buyback.executeBuyback(
          tokenIn.address,
          AMOUNT_IN,
          MIN_AMOUNT_OUT,
          futureDeadline(),
          router.address,
          calldata,
          await comptroller.getAddress(),
        ),
      )
        .to.be.revertedWithCustomError(buyback, "SlippageExceeded")
        .withArgs(MIN_AMOUNT_OUT, lowOutput);
    });

    it("amountOut zero results in no DESTINATION transfer", async () => {
      await router.setSkipTransfer(true);
      const calldata = await encodeSwap(AMOUNT_IN, AMOUNT_OUT, buyback.address);
      const comptrollerAddr = await comptroller.getAddress();
      const destAddr = await destinationEOA.getAddress();
      const destBefore = await baseAsset.balanceOf(destAddr);

      await buyback.executeBuyback(
        tokenIn.address,
        AMOUNT_IN,
        0,
        futureDeadline(),
        router.address,
        calldata,
        comptrollerAddr,
      );

      expect(await baseAsset.balanceOf(destAddr)).to.equal(destBefore);
    });

    it("donation to DESTINATION does not inflate amountOut", async () => {
      const calldata = await encodeSwap(AMOUNT_IN, AMOUNT_OUT, buyback.address);
      const destAddr = await destinationEOA.getAddress();

      // Attacker donates directly to DESTINATION before cron runs
      await baseAsset.transfer(destAddr, parseUnits("500", 6));
      const destBeforeBuyback = await baseAsset.balanceOf(destAddr);

      await buyback.executeBuyback(
        tokenIn.address,
        AMOUNT_IN,
        MIN_AMOUNT_OUT,
        futureDeadline(),
        router.address,
        calldata,
        await comptroller.getAddress(),
      );

      const destAfter = await baseAsset.balanceOf(destAddr);
      // Destination received exactly AMOUNT_OUT from the buyback, not more
      expect(destAfter.sub(destBeforeBuyback)).to.equal(AMOUNT_OUT);
    });

    it("allowance reset to zero even after partial consumption", async () => {
      // Router only consumes half of the approved amount
      const calldata = router.interface.encodeFunctionData("swap", [
        tokenIn.address,
        AMOUNT_IN.div(2),
        baseAsset.address,
        AMOUNT_OUT,
        buyback.address,
      ]);

      await buyback.executeBuyback(
        tokenIn.address,
        AMOUNT_IN,
        MIN_AMOUNT_OUT,
        futureDeadline(),
        router.address,
        calldata,
        await comptroller.getAddress(),
      );

      expect(await tokenIn.allowance(buyback.address, router.address)).to.equal(0);
    });
  });

  describe("forwardBaseAsset", () => {
    it("reverts when ACM denies", async () => {
      accessControl.isAllowedToCall.whenCalledWith(await owner.getAddress(), FORWARD_SIG).returns(false);
      await expect(
        buyback.forwardBaseAsset(await comptroller.getAddress(), parseUnits("1", 6)),
      ).to.be.revertedWithCustomError(buyback, "Unauthorized");
    });

    it("no-op when amount is zero", async () => {
      const comptrollerAddr = await comptroller.getAddress();
      const tx = await buyback.forwardBaseAsset(comptrollerAddr, 0);
      const receipt = await tx.wait();
      expect(receipt.events?.find(e => e.event === "BaseAssetForwarded")).to.equal(undefined);
    });

    it("reverts on insufficient balance", async () => {
      const deposit = parseUnits("100", 6);
      const tooMuch = parseUnits("150", 6);
      await baseAsset.transfer(buyback.address, deposit);
      const comptrollerAddr = await comptroller.getAddress();

      await expect(buyback.forwardBaseAsset(comptrollerAddr, tooMuch))
        .to.be.revertedWithCustomError(buyback, "InsufficientBalance")
        .withArgs(baseAsset.address, tooMuch, deposit);
    });

    it("transfers the specified amount to DESTINATION and emits BaseAssetForwarded", async () => {
      const deposit = parseUnits("300", 6);
      const forwardAmount = parseUnits("200", 6);
      await baseAsset.transfer(buyback.address, deposit);
      const destAddr = await destinationEOA.getAddress();
      const before = await baseAsset.balanceOf(destAddr);
      const comptrollerAddr = await comptroller.getAddress();

      await expect(buyback.forwardBaseAsset(comptrollerAddr, forwardAmount))
        .to.emit(buyback, "BaseAssetForwarded")
        .withArgs(comptrollerAddr, forwardAmount);

      expect((await baseAsset.balanceOf(destAddr)).sub(before)).to.equal(forwardAmount);
      expect(await baseAsset.balanceOf(buyback.address)).to.equal(deposit.sub(forwardAmount));
    });

    // Attribution is off-chain now: cron partitions the balance per pool using amounts
    // derived from AssetsReceived deltas. Each call emits its own BaseAssetForwarded
    // event with the pool's comptroller, giving the cron an auditable ledger of splits
    // even though no on-chain per-pool accounting remains on the DESTINATION.
    it("per-pool attribution via event: amount parameter partitions transfers across comptrollers", async () => {
      const comptrollerA = await comptroller.getAddress();
      const comptrollerB = await nonOwner.getAddress();
      const poolADeposit = parseUnits("100", 6);
      const poolBDeposit = parseUnits("200", 6);
      const destAddr = await destinationEOA.getAddress();
      const destBefore = await baseAsset.balanceOf(destAddr);

      // PSR delivers BASE_ASSET for pool A, then pool B, without a cron drain in between
      await baseAsset.transfer(buyback.address, poolADeposit);
      await buyback.connect(psr).updateAssetsState(comptrollerA, baseAsset.address);
      await baseAsset.transfer(buyback.address, poolBDeposit);
      await buyback.connect(psr).updateAssetsState(comptrollerB, baseAsset.address);

      await expect(buyback.forwardBaseAsset(comptrollerA, poolADeposit))
        .to.emit(buyback, "BaseAssetForwarded")
        .withArgs(comptrollerA, poolADeposit);

      await expect(buyback.forwardBaseAsset(comptrollerB, poolBDeposit))
        .to.emit(buyback, "BaseAssetForwarded")
        .withArgs(comptrollerB, poolBDeposit);

      expect((await baseAsset.balanceOf(destAddr)).sub(destBefore)).to.equal(poolADeposit.add(poolBDeposit));
      expect(await baseAsset.balanceOf(buyback.address)).to.equal(0);
    });
  });

  describe("cap and slippage setters", () => {
    it("setDailyCapUsd updates state and emits event under ACM", async () => {
      const newCap = parseUnits("12345", 18);
      await expect(buyback.setDailyCapUsd(newCap))
        .to.emit(buyback, "DailyCapUpdated")
        .withArgs(TEST_DAILY_CAP_USD, newCap);
      expect(await buyback.dailyCapUsd()).to.equal(newCap);
    });

    it("setDailyCapUsd reverts when ACM denies", async () => {
      accessControl.isAllowedToCall.whenCalledWith(await owner.getAddress(), SET_DAILY_CAP_SIG).returns(false);
      await expect(buyback.setDailyCapUsd(parseUnits("1", 18))).to.be.revertedWithCustomError(buyback, "Unauthorized");
    });

    it("setPerBlockCapUsd updates state and emits event under ACM", async () => {
      const newCap = parseUnits("777", 18);
      await expect(buyback.setPerBlockCapUsd(newCap))
        .to.emit(buyback, "PerBlockCapUpdated")
        .withArgs(TEST_PER_BLOCK_CAP_USD, newCap);
      expect(await buyback.perBlockCapUsd()).to.equal(newCap);
    });

    it("setPerBlockCapUsd reverts when ACM denies", async () => {
      accessControl.isAllowedToCall.whenCalledWith(await owner.getAddress(), SET_PER_BLOCK_CAP_SIG).returns(false);
      await expect(buyback.setPerBlockCapUsd(parseUnits("1", 18))).to.be.revertedWithCustomError(
        buyback,
        "Unauthorized",
      );
    });

    it("setSlippageEventUsd updates state and emits event under ACM", async () => {
      const newThreshold = parseUnits("99", 18);
      await expect(buyback.setSlippageEventUsd(newThreshold))
        .to.emit(buyback, "SlippageEventUsdUpdated")
        .withArgs(TEST_SLIPPAGE_EVENT_USD, newThreshold);
      expect(await buyback.slippageEventUsd()).to.equal(newThreshold);
    });

    it("setSlippageEventUsd reverts when ACM denies", async () => {
      accessControl.isAllowedToCall.whenCalledWith(await owner.getAddress(), SET_SLIPPAGE_EVENT_SIG).returns(false);
      await expect(buyback.setSlippageEventUsd(parseUnits("1", 18))).to.be.revertedWithCustomError(
        buyback,
        "Unauthorized",
      );
    });
  });

  describe("daily and per-block caps", () => {
    beforeEach(async () => {
      await tokenIn.transfer(buyback.address, parseUnits("1000", 18));
    });

    async function runSwap(amountIn: BigNumber, amountOut: BigNumber): Promise<void> {
      const calldata = await encodeSwap(amountIn, amountOut, buyback.address);
      await buyback.executeBuyback(
        tokenIn.address,
        amountIn,
        0,
        futureDeadline(),
        router.address,
        calldata,
        await comptroller.getAddress(),
      );
    }

    it("accumulates usdConsumedInWindow on successful swaps", async () => {
      // 100 tokenIn @ $1 → $100 USD consumed
      await runSwap(parseUnits("100", 18), parseUnits("100", 6));
      expect(await buyback.usdConsumedInWindow()).to.equal(parseUnits("100", 18));

      await runSwap(parseUnits("50", 18), parseUnits("50", 6));
      expect(await buyback.usdConsumedInWindow()).to.equal(parseUnits("150", 18));
    });

    it("reverts when daily cap is exceeded", async () => {
      // Pin per-block cap high so we are exclusively testing daily-cap behavior
      await buyback.setDailyCapUsd(parseUnits("150", 18));

      await runSwap(parseUnits("100", 18), parseUnits("100", 6));

      // Second swap of $60 would push window total to $160 > $150 cap
      const calldata = await encodeSwap(parseUnits("60", 18), parseUnits("60", 6), buyback.address);
      await expect(
        buyback.executeBuyback(
          tokenIn.address,
          parseUnits("60", 18),
          0,
          futureDeadline(),
          router.address,
          calldata,
          await comptroller.getAddress(),
        ),
      )
        .to.be.revertedWithCustomError(buyback, "DailyCapExceeded")
        .withArgs(parseUnits("160", 18), parseUnits("150", 18));
    });

    it("daily window resets after WINDOW elapses", async () => {
      await buyback.setDailyCapUsd(parseUnits("150", 18));
      await runSwap(parseUnits("100", 18), parseUnits("100", 6));

      // Advance time past 24h
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Window resets, $100 swap fits inside fresh $150 cap
      await runSwap(parseUnits("100", 18), parseUnits("100", 6));
      expect(await buyback.usdConsumedInWindow()).to.equal(parseUnits("100", 18));
    });

    it("reverts when per-block cap is exceeded across two swaps in the same block", async () => {
      // Daily cap high, per-block cap tight. Disable auto-mining so two txs land in
      // the same block.
      await buyback.setPerBlockCapUsd(parseUnits("120", 18));
      await ethers.provider.send("evm_setAutomine", [false]);

      try {
        const calldata1 = await encodeSwap(parseUnits("100", 18), parseUnits("100", 6), buyback.address);
        const tx1 = await buyback.executeBuyback(
          tokenIn.address,
          parseUnits("100", 18),
          0,
          futureDeadline(),
          router.address,
          calldata1,
          await comptroller.getAddress(),
        );

        const calldata2 = await encodeSwap(parseUnits("50", 18), parseUnits("50", 6), buyback.address);
        const tx2 = await buyback.executeBuyback(
          tokenIn.address,
          parseUnits("50", 18),
          0,
          futureDeadline(),
          router.address,
          calldata2,
          await comptroller.getAddress(),
        );

        await ethers.provider.send("evm_mine", []);

        await tx1.wait(); // first swap succeeds
        await expect(tx2.wait()).to.be.rejected; // second swap reverts on per-block cap
      } finally {
        await ethers.provider.send("evm_setAutomine", [true]);
      }
    });

    it("per-block counter resets across blocks", async () => {
      await buyback.setPerBlockCapUsd(parseUnits("100", 18));

      await runSwap(parseUnits("100", 18), parseUnits("100", 6));
      // Next block — per-block counter resets, another $100 fits
      await runSwap(parseUnits("100", 18), parseUnits("100", 6));
      expect(await buyback.usdConsumedInBlock()).to.equal(parseUnits("100", 18));
    });
  });

  describe("AbnormalSlippage event", () => {
    beforeEach(async () => {
      await tokenIn.transfer(buyback.address, parseUnits("1000", 18));
    });

    it("does not emit AbnormalSlippage when swap returns matching USD value", async () => {
      const calldata = await encodeSwap(parseUnits("100", 18), parseUnits("100", 6), buyback.address);
      const tx = buyback.executeBuyback(
        tokenIn.address,
        parseUnits("100", 18),
        0,
        futureDeadline(),
        router.address,
        calldata,
        await comptroller.getAddress(),
      );
      await expect(tx).to.not.emit(buyback, "AbnormalSlippage");
    });

    it("does not emit AbnormalSlippage when slippage is below threshold", async () => {
      // $400 slippage on a $500 threshold → silent
      await buyback.setSlippageEventUsd(parseUnits("500", 18));
      const calldata = await encodeSwap(parseUnits("1000", 18), parseUnits("600", 6), buyback.address);
      const tx = buyback.executeBuyback(
        tokenIn.address,
        parseUnits("1000", 18),
        0,
        futureDeadline(),
        router.address,
        calldata,
        await comptroller.getAddress(),
      );
      await expect(tx).to.not.emit(buyback, "AbnormalSlippage");
    });

    it("emits AbnormalSlippage when usdIn - usdOut exceeds threshold", async () => {
      // $1000 in, $400 out → $600 slippage > $500 threshold
      await buyback.setSlippageEventUsd(parseUnits("500", 18));
      const calldata = await encodeSwap(parseUnits("1000", 18), parseUnits("400", 6), buyback.address);
      const tx = buyback.executeBuyback(
        tokenIn.address,
        parseUnits("1000", 18),
        0,
        futureDeadline(),
        router.address,
        calldata,
        await comptroller.getAddress(),
      );
      await expect(tx)
        .to.emit(buyback, "AbnormalSlippage")
        .withArgs(
          tokenIn.address,
          parseUnits("1000", 18),
          parseUnits("400", 6),
          parseUnits("1000", 18),
          parseUnits("400", 18),
        );
    });

    it("does not block the swap when AbnormalSlippage fires (event-only)", async () => {
      await buyback.setSlippageEventUsd(parseUnits("500", 18));
      const destAddr = await destinationEOA.getAddress();
      const destBefore = await baseAsset.balanceOf(destAddr);

      const calldata = await encodeSwap(parseUnits("1000", 18), parseUnits("400", 6), buyback.address);
      await buyback.executeBuyback(
        tokenIn.address,
        parseUnits("1000", 18),
        0,
        futureDeadline(),
        router.address,
        calldata,
        await comptroller.getAddress(),
      );

      // Swap output still landed at DESTINATION
      expect((await baseAsset.balanceOf(destAddr)).sub(destBefore)).to.equal(parseUnits("400", 6));
    });
  });
});
