import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { BigNumber, Signer, constants } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import {
  IAccessControlManagerV8,
  IRiskFund,
  MockRouter,
  MockRouter__factory,
  MockToken,
  MockToken__factory,
  TokenBuyback,
  TokenBuyback__factory,
} from "../../typechain";

const { expect } = chai;
chai.use(smock.matchers);

const AMOUNT_IN = parseUnits("100", 18);
const AMOUNT_OUT = parseUnits("200", 6);
const MIN_AMOUNT_OUT = parseUnits("190", 6);

let accessControl: FakeContract<IAccessControlManagerV8>;
let tokenIn: MockContract<MockToken>;
let baseAsset: MockContract<MockToken>;
let router: MockRouter;
let riskFund: FakeContract<IRiskFund>;
let buyback: MockContract<TokenBuyback>;
let buybackRiskFund: MockContract<TokenBuyback>;
let owner: Signer;
let nonOwner: Signer;
let destinationEOA: Signer;
let comptroller: Signer;

const BUYBACK_SIG = "executeBuyback(address,uint256,uint256,uint256,address,bytes,address)";
const FORWARD_SIG = "forwardBaseAsset(address)";

async function deployBuyback(destination: string, isRiskFund: boolean): Promise<MockContract<TokenBuyback>> {
  const TokenBuybackFactory = await smock.mock<TokenBuyback__factory>("TokenBuyback");
  return upgrades.deployProxy(TokenBuybackFactory, [accessControl.address], {
    constructorArgs: [destination, baseAsset.address, isRiskFund],
  });
}

async function encodeSwap(
  amountIn: BigNumber,
  amountOut: BigNumber,
  recipient: string,
): Promise<string> {
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
  [owner, nonOwner, destinationEOA, comptroller] = await ethers.getSigners();

  accessControl = await smock.fake<IAccessControlManagerV8>("IAccessControlManagerV8");
  accessControl.isAllowedToCall.returns(true);

  riskFund = await smock.fake<IRiskFund>("IRiskFund");

  const MockTokenFactory = await smock.mock<MockToken__factory>("MockToken");
  tokenIn = await MockTokenFactory.deploy("TokenIn", "TKI", 18);
  baseAsset = await MockTokenFactory.deploy("BaseAsset", "BASE", 6);

  const RouterFactory = (await ethers.getContractFactory("MockRouter")) as MockRouter__factory;
  router = await RouterFactory.deploy();

  buyback = await deployBuyback(await destinationEOA.getAddress(), false);
  buybackRiskFund = await deployBuyback(riskFund.address, true);

  await buyback.setAllowedRouter(router.address, true);
  await buybackRiskFund.setAllowedRouter(router.address, true);

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
    riskFund.updatePoolState.reset();
  });

  describe("Initialization", () => {
    it("sets immutables from constructor", async () => {
      expect(await buyback.DESTINATION()).to.equal(await destinationEOA.getAddress());
      expect(await buyback.BASE_ASSET()).to.equal(baseAsset.address);
      expect(await buyback.IS_RISK_FUND()).to.equal(false);

      expect(await buybackRiskFund.DESTINATION()).to.equal(riskFund.address);
      expect(await buybackRiskFund.IS_RISK_FUND()).to.equal(true);
    });

    it("constructor reverts on zero destination", async () => {
      const TokenBuybackFactory = await smock.mock<TokenBuyback__factory>("TokenBuyback");
      await expect(
        upgrades.deployProxy(TokenBuybackFactory, [accessControl.address], {
          constructorArgs: [constants.AddressZero, baseAsset.address, false],
        }),
      ).to.be.reverted;
    });

    it("constructor reverts on zero base asset", async () => {
      const TokenBuybackFactory = await smock.mock<TokenBuyback__factory>("TokenBuyback");
      await expect(
        upgrades.deployProxy(TokenBuybackFactory, [accessControl.address], {
          constructorArgs: [await destinationEOA.getAddress(), constants.AddressZero, false],
        }),
      ).to.be.reverted;
    });

    it("reverts on double initialize", async () => {
      await expect(buyback.initialize(accessControl.address)).to.be.revertedWith(
        "Initializable: contract is already initialized",
      );
    });
  });

  describe("updateAssetsState", () => {
    it("emits AssetsReceived with current balance", async () => {
      await tokenIn.transfer(buyback.address, AMOUNT_IN);
      const comptrollerAddr = await comptroller.getAddress();

      await expect(buyback.updateAssetsState(comptrollerAddr, tokenIn.address))
        .to.emit(buyback, "AssetsReceived")
        .withArgs(comptrollerAddr, tokenIn.address, AMOUNT_IN);
    });

    it("callable by any account", async () => {
      await expect(
        buyback.connect(nonOwner).updateAssetsState(await comptroller.getAddress(), tokenIn.address),
      ).to.not.be.reverted;
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
      await expect(buyback.setAllowedRouter(other, true))
        .to.emit(buyback, "RouterAllowlisted")
        .withArgs(other, true);
      expect(await buyback.allowedRouters(other)).to.equal(true);

      await expect(buyback.setAllowedRouter(other, false))
        .to.emit(buyback, "RouterAllowlisted")
        .withArgs(other, false);
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
      await expect(
        buyback.sweepToken(tokenIn.address, constants.AddressZero, AMOUNT_IN),
      ).to.be.revertedWithCustomError(buyback, "ZeroAddressNotAllowed");
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
      await tokenIn.transfer(buybackRiskFund.address, AMOUNT_IN);
    });

    it("happy path — non-RiskFund instance", async () => {
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

    it("reverts when IS_RISK_FUND and comptroller is zero", async () => {
      const calldata = await encodeSwap(AMOUNT_IN, AMOUNT_OUT, buybackRiskFund.address);
      await expect(
        buybackRiskFund.executeBuyback(
          tokenIn.address,
          AMOUNT_IN,
          MIN_AMOUNT_OUT,
          futureDeadline(),
          router.address,
          calldata,
          constants.AddressZero,
        ),
      ).to.be.revertedWithCustomError(buybackRiskFund, "ComptrollerRequired");
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

    it("happy path — RiskFund instance calls updatePoolState", async () => {
      const calldata = await encodeSwap(AMOUNT_IN, AMOUNT_OUT, buybackRiskFund.address);
      const comptrollerAddr = await comptroller.getAddress();

      await buybackRiskFund.executeBuyback(
        tokenIn.address,
        AMOUNT_IN,
        MIN_AMOUNT_OUT,
        futureDeadline(),
        router.address,
        calldata,
        comptrollerAddr,
      );

      expect(riskFund.updatePoolState).to.have.been.calledOnceWith(
        comptrollerAddr,
        baseAsset.address,
        AMOUNT_OUT,
      );
    });

    it("RiskFund: amountOut zero skips updatePoolState", async () => {
      await router.setSkipTransfer(true);
      const calldata = await encodeSwap(AMOUNT_IN, AMOUNT_OUT, buybackRiskFund.address);
      const comptrollerAddr = await comptroller.getAddress();

      await buybackRiskFund.executeBuyback(
        tokenIn.address,
        AMOUNT_IN,
        0,
        futureDeadline(),
        router.address,
        calldata,
        comptrollerAddr,
      );

      expect(riskFund.updatePoolState).to.not.have.been.called;
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
      await expect(buyback.forwardBaseAsset(await comptroller.getAddress())).to.be.revertedWithCustomError(
        buyback,
        "Unauthorized",
      );
    });

    it("reverts when IS_RISK_FUND and comptroller is zero", async () => {
      await expect(buybackRiskFund.forwardBaseAsset(constants.AddressZero)).to.be.revertedWithCustomError(
        buybackRiskFund,
        "ComptrollerRequired",
      );
    });

    it("no-op when balance is zero", async () => {
      const comptrollerAddr = await comptroller.getAddress();
      const tx = await buyback.forwardBaseAsset(comptrollerAddr);
      const receipt = await tx.wait();
      expect(receipt.events?.find(e => e.event === "BaseAssetForwarded")).to.equal(undefined);
    });

    it("transfers full balance to DESTINATION (non-RiskFund)", async () => {
      const amount = parseUnits("300", 6);
      await baseAsset.transfer(buyback.address, amount);
      const destAddr = await destinationEOA.getAddress();
      const before = await baseAsset.balanceOf(destAddr);
      const comptrollerAddr = await comptroller.getAddress();

      await expect(buyback.forwardBaseAsset(comptrollerAddr))
        .to.emit(buyback, "BaseAssetForwarded")
        .withArgs(comptrollerAddr, amount);

      expect((await baseAsset.balanceOf(destAddr)).sub(before)).to.equal(amount);
      expect(await baseAsset.balanceOf(buyback.address)).to.equal(0);
      expect(riskFund.updatePoolState).to.not.have.been.called;
    });

    it("RiskFund: transfers and calls updatePoolState", async () => {
      const amount = parseUnits("300", 6);
      await baseAsset.transfer(buybackRiskFund.address, amount);
      const comptrollerAddr = await comptroller.getAddress();

      await buybackRiskFund.forwardBaseAsset(comptrollerAddr);

      expect(riskFund.updatePoolState).to.have.been.calledOnceWith(
        comptrollerAddr,
        baseAsset.address,
        amount,
      );
    });
  });
});
