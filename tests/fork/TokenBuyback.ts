import chai from "chai";
import { BigNumber, Contract, Signer, utils } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import hre from "hardhat";

import { forking, initMainnetUser } from "../utils";

const { expect } = chai;

const FORK_MAINNET = process.env.FORK === "true" && process.env.FORKED_NETWORK === "bscmainnet";

// BSC mainnet
const NORMAL_TIMELOCK = "0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396";
const ACM = "0x4788629abc6cfca10f9f969efdeaa1cf70c23555";
const RISK_FUND_V2 = "0xdF31a28D68A2AB381D42b380649Ead7ae2A76E42";
const DEFAULT_PROXY_ADMIN = "0x6beb6D2695B67FEb73ad4f172E8E2975497187e4";
const PRIME_LIQUIDITY_PROVIDER = "0x23c4F844ffDdC6161174eB32c770D4D8C07833F2";
const CORE_POOL_COMPTROLLER = "0xfd36e2c2a6789db23113685031d7f16329158384";

// BSC mainnet — tokens
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const BTCB = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";
const ETH = "0x2170Ed0880ac9A755fd29B2688956BD959F933F8";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const XVS = "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63";

// BSC mainnet — additional destinations
const XVS_VAULT_TREASURY = "0x269ff7818DB317f60E386D2be0B259e1a324a40a";
const V_TREASURY = "0xF322942f644A996A617BD29c16bd7d231d9F35E9";

// BSC mainnet — DEX
const PANCAKE_V2_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

// Whale — holds all major BSC tokens at most blocks. Must NOT be AMM LP pair,
// draining from an LP breaks pool K invariant and corrupts later swaps.
const WHALE = "0xF977814e90dA44bFA03b6295A0616a897441aceC"; // Binance hot wallet

// ACM function signatures to grant
const EXECUTE_BUYBACK_SIG = "executeBuyback(address,uint256,uint256,uint256,address,bytes,address)";
const FORWARD_BASE_ASSET_SIG = "forwardBaseAsset(address)";
const UPDATE_POOL_STATE_SIG = "updatePoolState(address,address,uint256)";

// PancakeSwap V2 Router minimal ABI
const PANCAKE_V2_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const FORK_BLOCK = 93647884;

forking(FORK_BLOCK, () => {
  if (!FORK_MAINNET) {
    return;
  }

  describe("TokenBuyback fork (bscmainnet)", () => {
    let timelock: Signer;
    let whale: Signer;
    let deployer: Signer;
    let deployerAddr: string;
    let comptrollerAddr: string;

    let acm: Contract;
    let riskFundV2: Contract;
    let btcb: Contract;
    let usdt: Contract;
    let pancakeRouter: Contract;

    let riskFundBuyback: Contract;
    let primeBuyback: Contract;

    const BTCB_IN = parseUnits("0.01", 18); // ~$600 at most blocks

    async function deployBuyback(destination: string, baseAsset: string, isRiskFund: boolean): Promise<Contract> {
      const factory = await hre.ethers.getContractFactory("TokenBuyback");
      // @ts-expect-error hardhat-upgrades attaches `upgrades` at runtime via plugin
      const proxy = await hre.upgrades.deployProxy(factory, [ACM], {
        constructorArgs: [destination, baseAsset, isRiskFund],
        unsafeAllow: ["constructor", "state-variable-immutable"],
      });
      await proxy.deployed();
      return proxy;
    }

    async function grantAcm(target: string, sig: string, caller: string): Promise<void> {
      await acm.connect(timelock).giveCallPermission(target, sig, caller);
    }

    // Acquires USDT by swapping BTCB->USDT on PancakeSwap and depositing into `recipient`.
    // Used for forwardBaseAsset tests that need USDT in the buyback contract, since
    // Binance hot wallet does not hold USDT at this fork block.
    async function acquireUsdt(recipient: string, btcbAmount: BigNumber): Promise<BigNumber> {
      await btcb.connect(whale).approve(PANCAKE_V2_ROUTER, btcbAmount);
      const path = [BTCB, WBNB, USDT];
      const balanceBefore = await usdt.balanceOf(recipient);
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      await pancakeRouter.connect(whale).swapExactTokensForTokens(btcbAmount, 0, path, recipient, deadline);
      const balanceAfter = await usdt.balanceOf(recipient);
      return balanceAfter.sub(balanceBefore);
    }

    async function pancakeCalldata(
      tokenIn: string,
      amountIn: BigNumber,
      minOut: BigNumber,
      path: string[],
      recipient: string,
      deadline: number,
    ): Promise<string> {
      return pancakeRouter.interface.encodeFunctionData("swapExactTokensForTokens", [
        amountIn,
        minOut,
        path,
        recipient,
        deadline,
      ]);
    }

    before(async () => {
      [deployer] = await hre.ethers.getSigners();
      deployerAddr = await deployer.getAddress();
      comptrollerAddr = utils.getAddress(CORE_POOL_COMPTROLLER);

      timelock = await initMainnetUser(NORMAL_TIMELOCK);
      whale = await initMainnetUser(WHALE);

      // Fund impersonated accounts with gas via hardhat_setBalance
      const hexTen = "0x8ac7230489e80000"; // 10 BNB
      await hre.network.provider.send("hardhat_setBalance", [NORMAL_TIMELOCK, hexTen]);
      await hre.network.provider.send("hardhat_setBalance", [WHALE, hexTen]);

      acm = await hre.ethers.getContractAt("IAccessControlManagerV8", ACM);
      riskFundV2 = await hre.ethers.getContractAt("RiskFundV2", RISK_FUND_V2);
      btcb = await hre.ethers.getContractAt(ERC20_ABI, BTCB);
      usdt = await hre.ethers.getContractAt(ERC20_ABI, USDT);
      pancakeRouter = await hre.ethers.getContractAt(PANCAKE_V2_ABI, PANCAKE_V2_ROUTER);

      // Upgrade RiskFundV2 on fork so it has the new ACM-gated updatePoolState.
      // Mainnet impl still has the old `msg.sender == riskFundConverter` guard.
      const RiskFundV2Factory = await hre.ethers.getContractFactory("RiskFundV2");
      const newImpl = await RiskFundV2Factory.deploy();
      await newImpl.deployed();
      const proxyAdmin = await hre.ethers.getContractAt(
        ["function upgrade(address proxy, address implementation) external"],
        DEFAULT_PROXY_ADMIN,
      );
      await proxyAdmin.connect(timelock).upgrade(RISK_FUND_V2, newImpl.address);
    });

    describe("RiskFundBuyback E2E", () => {
      before(async () => {
        riskFundBuyback = await deployBuyback(RISK_FUND_V2, USDT, true);

        // Allowlist PancakeSwap router
        await riskFundBuyback.setAllowedRouter(PANCAKE_V2_ROUTER, true);

        // ACM grants:
        //  - deployer can call executeBuyback / forwardBaseAsset
        //  - riskFundBuyback can call updatePoolState on RiskFundV2
        await grantAcm(riskFundBuyback.address, EXECUTE_BUYBACK_SIG, deployerAddr);
        await grantAcm(riskFundBuyback.address, FORWARD_BASE_ASSET_SIG, deployerAddr);
        await grantAcm(RISK_FUND_V2, UPDATE_POOL_STATE_SIG, riskFundBuyback.address);
      });

      it("swaps BTCB -> USDT via PancakeSwap, forwards to RiskFundV2, updates pool state", async () => {
        // Fund buyback with BTCB from whale (simulates PSR delivery)
        await btcb.connect(whale).transfer(riskFundBuyback.address, BTCB_IN);

        const path = [BTCB, WBNB, USDT];
        const quoted = await pancakeRouter.getAmountsOut(BTCB_IN, path);
        const expectedOut = quoted[quoted.length - 1];
        const minOut = expectedOut.mul(99).div(100); // 1% slippage buffer

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const calldata = await pancakeCalldata(BTCB, BTCB_IN, minOut, path, riskFundBuyback.address, deadline);

        const usdtBeforeDest = await usdt.balanceOf(RISK_FUND_V2);
        const poolBefore = await riskFundV2.poolAssetsFunds(comptrollerAddr, USDT);

        const tx = riskFundBuyback.executeBuyback(
          BTCB,
          BTCB_IN,
          minOut,
          deadline,
          PANCAKE_V2_ROUTER,
          calldata,
          comptrollerAddr,
        );

        await expect(tx).to.emit(riskFundBuyback, "BuybackExecuted");

        const usdtAfterDest = await usdt.balanceOf(RISK_FUND_V2);
        const poolAfter = await riskFundV2.poolAssetsFunds(comptrollerAddr, USDT);
        const delta = usdtAfterDest.sub(usdtBeforeDest);

        expect(delta).to.be.gte(minOut);
        expect(poolAfter.sub(poolBefore)).to.equal(delta);
        expect(await btcb.balanceOf(riskFundBuyback.address)).to.equal(0);
        expect(await usdt.balanceOf(riskFundBuyback.address)).to.equal(0);
        expect(await btcb.allowance(riskFundBuyback.address, PANCAKE_V2_ROUTER)).to.equal(0);
      });

      it("forwardBaseAsset moves USDT directly to RiskFundV2 and updates pool state", async () => {
        const forwardAmount = await acquireUsdt(riskFundBuyback.address, parseUnits("0.005", 18));
        expect(forwardAmount).to.be.gt(0);

        const usdtBefore = await usdt.balanceOf(RISK_FUND_V2);
        const poolBefore = await riskFundV2.poolAssetsFunds(comptrollerAddr, USDT);

        await expect(riskFundBuyback.forwardBaseAsset(comptrollerAddr))
          .to.emit(riskFundBuyback, "BaseAssetForwarded")
          .withArgs(comptrollerAddr, forwardAmount);

        expect((await usdt.balanceOf(RISK_FUND_V2)).sub(usdtBefore)).to.equal(forwardAmount);
        expect((await riskFundV2.poolAssetsFunds(comptrollerAddr, USDT)).sub(poolBefore)).to.equal(forwardAmount);
        expect(await usdt.balanceOf(riskFundBuyback.address)).to.equal(0);
      });

      it("reverts on expired deadline", async () => {
        await btcb.connect(whale).transfer(riskFundBuyback.address, BTCB_IN);

        const path = [BTCB, WBNB, USDT];
        const calldata = await pancakeCalldata(BTCB, BTCB_IN, 0, path, riskFundBuyback.address, 1);

        await expect(
          riskFundBuyback.executeBuyback(BTCB, BTCB_IN, 0, 1, PANCAKE_V2_ROUTER, calldata, comptrollerAddr),
        ).to.be.revertedWithCustomError(riskFundBuyback, "DeadlineExpired");
      });

      it("reverts when router not allowlisted", async () => {
        const rogue = await deployBuyback(RISK_FUND_V2, USDT, true);
        await grantAcm(rogue.address, EXECUTE_BUYBACK_SIG, deployerAddr);

        await btcb.connect(whale).transfer(rogue.address, BTCB_IN);
        const path = [BTCB, WBNB, USDT];
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const calldata = await pancakeCalldata(BTCB, BTCB_IN, 0, path, rogue.address, deadline);

        await expect(
          rogue.executeBuyback(BTCB, BTCB_IN, 0, deadline, PANCAKE_V2_ROUTER, calldata, comptrollerAddr),
        ).to.be.revertedWithCustomError(rogue, "RouterNotAllowed");
      });

      it("reverts on slippage when minAmountOut exceeds quoted output", async () => {
        await btcb.connect(whale).transfer(riskFundBuyback.address, BTCB_IN);

        const path = [BTCB, WBNB, USDT];
        const quoted = await pancakeRouter.getAmountsOut(BTCB_IN, path);
        const optimistic = quoted[quoted.length - 1].mul(110).div(100); // demand 10% more than quoted

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        // router uses loose minOut; contract guard trips on outer check
        const calldata = await pancakeCalldata(BTCB, BTCB_IN, 0, path, riskFundBuyback.address, deadline);

        await expect(
          riskFundBuyback.executeBuyback(
            BTCB,
            BTCB_IN,
            optimistic,
            deadline,
            PANCAKE_V2_ROUTER,
            calldata,
            comptrollerAddr,
          ),
        ).to.be.revertedWithCustomError(riskFundBuyback, "SlippageExceeded");
      });

      it("reverts InvalidTokenIn when tokenIn equals BASE_ASSET", async () => {
        await acquireUsdt(riskFundBuyback.address, parseUnits("0.001", 18));

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const calldata = await pancakeCalldata(
          USDT,
          parseUnits("1", 18),
          0,
          [USDT, BTCB],
          riskFundBuyback.address,
          deadline,
        );

        await expect(
          riskFundBuyback.executeBuyback(
            USDT,
            parseUnits("1", 18),
            0,
            deadline,
            PANCAKE_V2_ROUTER,
            calldata,
            comptrollerAddr,
          ),
        )
          .to.be.revertedWithCustomError(riskFundBuyback, "InvalidTokenIn")
          .withArgs(USDT);
      });

      it("reverts InsufficientBalance when amountIn exceeds contract balance", async () => {
        // Fresh deploy; no BTCB held
        const fresh = await deployBuyback(RISK_FUND_V2, USDT, true);
        await fresh.setAllowedRouter(PANCAKE_V2_ROUTER, true);
        await grantAcm(fresh.address, EXECUTE_BUYBACK_SIG, deployerAddr);

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const calldata = await pancakeCalldata(BTCB, BTCB_IN, 0, [BTCB, WBNB, USDT], fresh.address, deadline);

        await expect(
          fresh.executeBuyback(BTCB, BTCB_IN, 0, deadline, PANCAKE_V2_ROUTER, calldata, comptrollerAddr),
        ).to.be.revertedWithCustomError(fresh, "InsufficientBalance");
      });

      it("reverts ComptrollerRequired on executeBuyback when IS_RISK_FUND and comptroller is zero", async () => {
        await btcb.connect(whale).transfer(riskFundBuyback.address, BTCB_IN);

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const calldata = await pancakeCalldata(BTCB, BTCB_IN, 0, [BTCB, WBNB, USDT], riskFundBuyback.address, deadline);

        await expect(
          riskFundBuyback.executeBuyback(
            BTCB,
            BTCB_IN,
            0,
            deadline,
            PANCAKE_V2_ROUTER,
            calldata,
            hre.ethers.constants.AddressZero,
          ),
        ).to.be.revertedWithCustomError(riskFundBuyback, "ComptrollerRequired");
      });

      it("reverts Unauthorized when caller lacks ACM permission", async () => {
        const [, outsider] = await hre.ethers.getSigners();

        await btcb.connect(whale).transfer(riskFundBuyback.address, BTCB_IN);

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const calldata = await pancakeCalldata(BTCB, BTCB_IN, 0, [BTCB, WBNB, USDT], riskFundBuyback.address, deadline);

        await expect(
          riskFundBuyback
            .connect(outsider)
            .executeBuyback(BTCB, BTCB_IN, 0, deadline, PANCAKE_V2_ROUTER, calldata, comptrollerAddr),
        ).to.be.revertedWithCustomError(riskFundBuyback, "Unauthorized");

        await expect(riskFundBuyback.connect(outsider).forwardBaseAsset(comptrollerAddr)).to.be.revertedWithCustomError(
          riskFundBuyback,
          "Unauthorized",
        );
      });

      it("guards against output-redirect: router sends output to attacker, contract balance-diff = 0, SlippageExceeded", async () => {
        const [, attacker] = await hre.ethers.getSigners();
        const attackerAddr = await attacker.getAddress();

        await btcb.connect(whale).transfer(riskFundBuyback.address, BTCB_IN);

        const path = [BTCB, WBNB, USDT];
        const quoted = await pancakeRouter.getAmountsOut(BTCB_IN, path);
        const minOut = quoted[quoted.length - 1].mul(99).div(100);
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Malicious calldata: swap proceeds sent to attacker, not to buyback contract
        const calldata = await pancakeCalldata(BTCB, BTCB_IN, 0, path, attackerAddr, deadline);

        await expect(
          riskFundBuyback.executeBuyback(BTCB, BTCB_IN, minOut, deadline, PANCAKE_V2_ROUTER, calldata, comptrollerAddr),
        ).to.be.revertedWithCustomError(riskFundBuyback, "SlippageExceeded");
      });

      it("donation-inflation protection: pre-donated BASE_ASSET excluded from amountOut", async () => {
        const buybackUsdtStart = await usdt.balanceOf(riskFundBuyback.address);
        const donation = await acquireUsdt(riskFundBuyback.address, parseUnits("0.002", 18));
        expect(donation).to.be.gt(0);

        await btcb.connect(whale).transfer(riskFundBuyback.address, BTCB_IN);

        const path = [BTCB, WBNB, USDT];
        const quoted = await pancakeRouter.getAmountsOut(BTCB_IN, path);
        const minOut = quoted[quoted.length - 1].mul(99).div(100);
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const calldata = await pancakeCalldata(BTCB, BTCB_IN, minOut, path, riskFundBuyback.address, deadline);

        const destBefore = await usdt.balanceOf(RISK_FUND_V2);

        await riskFundBuyback.executeBuyback(
          BTCB,
          BTCB_IN,
          minOut,
          deadline,
          PANCAKE_V2_ROUTER,
          calldata,
          comptrollerAddr,
        );

        const destDelta = (await usdt.balanceOf(RISK_FUND_V2)).sub(destBefore);
        // Only swap output transferred to DESTINATION; pre-swap donation + residual stays in buyback
        expect(destDelta).to.be.gte(minOut);
        expect(destDelta).to.be.lt(minOut.add(donation));
        expect(await usdt.balanceOf(riskFundBuyback.address)).to.equal(buybackUsdtStart.add(donation));
      });

      it("supports sequential buybacks (approval reset between calls)", async () => {
        const btcbStart = await btcb.balanceOf(riskFundBuyback.address);
        await btcb.connect(whale).transfer(riskFundBuyback.address, BTCB_IN.mul(2));

        const path = [BTCB, WBNB, USDT];
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        for (let i = 0; i < 2; i++) {
          const calldata = await pancakeCalldata(BTCB, BTCB_IN, 0, path, riskFundBuyback.address, deadline);
          await riskFundBuyback.executeBuyback(
            BTCB,
            BTCB_IN,
            0,
            deadline,
            PANCAKE_V2_ROUTER,
            calldata,
            comptrollerAddr,
          );
          expect(await btcb.allowance(riskFundBuyback.address, PANCAKE_V2_ROUTER)).to.equal(0);
        }
        // Two swaps of BTCB_IN each consumed the BTCB_IN * 2 we added; residual is unchanged
        expect(await btcb.balanceOf(riskFundBuyback.address)).to.equal(btcbStart);
      });
    });

    describe("PrimeBuyback_USDT E2E (IS_RISK_FUND=false)", () => {
      before(async () => {
        primeBuyback = await deployBuyback(PRIME_LIQUIDITY_PROVIDER, USDT, false);
        await primeBuyback.setAllowedRouter(PANCAKE_V2_ROUTER, true);
        await grantAcm(primeBuyback.address, EXECUTE_BUYBACK_SIG, deployerAddr);
        await grantAcm(primeBuyback.address, FORWARD_BASE_ASSET_SIG, deployerAddr);
      });

      it("swaps BTCB -> USDT, forwards to PrimeLiquidityProvider, no updatePoolState call", async () => {
        await btcb.connect(whale).transfer(primeBuyback.address, BTCB_IN);

        const path = [BTCB, WBNB, USDT];
        const quoted = await pancakeRouter.getAmountsOut(BTCB_IN, path);
        const minOut = quoted[quoted.length - 1].mul(99).div(100);
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const calldata = await pancakeCalldata(BTCB, BTCB_IN, minOut, path, primeBuyback.address, deadline);

        const primeBefore = await usdt.balanceOf(PRIME_LIQUIDITY_PROVIDER);

        await primeBuyback.executeBuyback(
          BTCB,
          BTCB_IN,
          minOut,
          deadline,
          PANCAKE_V2_ROUTER,
          calldata,
          hre.ethers.constants.AddressZero, // comptroller unused when IS_RISK_FUND=false
        );

        const primeAfter = await usdt.balanceOf(PRIME_LIQUIDITY_PROVIDER);
        expect(primeAfter.sub(primeBefore)).to.be.gte(minOut);
        expect(await usdt.balanceOf(primeBuyback.address)).to.equal(0);
      });

      it("forwardBaseAsset with AddressZero comptroller when not RiskFund", async () => {
        const forwardAmount = await acquireUsdt(primeBuyback.address, parseUnits("0.005", 18));
        expect(forwardAmount).to.be.gt(0);

        const primeBefore = await usdt.balanceOf(PRIME_LIQUIDITY_PROVIDER);

        await expect(primeBuyback.forwardBaseAsset(hre.ethers.constants.AddressZero))
          .to.emit(primeBuyback, "BaseAssetForwarded")
          .withArgs(hre.ethers.constants.AddressZero, forwardAmount);

        expect((await usdt.balanceOf(PRIME_LIQUIDITY_PROVIDER)).sub(primeBefore)).to.equal(forwardAmount);
      });
    });

    describe("Admin + edge cases", () => {
      let buyback: Contract;

      before(async () => {
        buyback = await deployBuyback(RISK_FUND_V2, USDT, true);
        await grantAcm(buyback.address, FORWARD_BASE_ASSET_SIG, deployerAddr);
      });

      it("setAllowedRouter toggles on and off, emits RouterAllowlisted", async () => {
        await expect(buyback.setAllowedRouter(PANCAKE_V2_ROUTER, true))
          .to.emit(buyback, "RouterAllowlisted")
          .withArgs(PANCAKE_V2_ROUTER, true);
        expect(await buyback.allowedRouters(PANCAKE_V2_ROUTER)).to.equal(true);

        await expect(buyback.setAllowedRouter(PANCAKE_V2_ROUTER, false))
          .to.emit(buyback, "RouterAllowlisted")
          .withArgs(PANCAKE_V2_ROUTER, false);
        expect(await buyback.allowedRouters(PANCAKE_V2_ROUTER)).to.equal(false);

        // Re-enable for downstream tests
        await buyback.setAllowedRouter(PANCAKE_V2_ROUTER, true);
      });

      it("setAllowedRouter reverts ZeroAddressNotAllowed for zero router", async () => {
        await expect(buyback.setAllowedRouter(hre.ethers.constants.AddressZero, true)).to.be.revertedWithCustomError(
          buyback,
          "ZeroAddressNotAllowed",
        );
      });

      it("setAllowedRouter reverts for non-owner caller", async () => {
        const [, outsider] = await hre.ethers.getSigners();
        await expect(buyback.connect(outsider).setAllowedRouter(PANCAKE_V2_ROUTER, true)).to.be.revertedWith(
          "Ownable: caller is not the owner",
        );
      });

      it("sweepToken transfers tokens and emits SweepToken", async () => {
        await btcb.connect(whale).transfer(buyback.address, BTCB_IN);
        const [, recipient] = await hre.ethers.getSigners();
        const recipientAddr = await recipient.getAddress();
        const recipientBefore = await btcb.balanceOf(recipientAddr);

        await expect(buyback.sweepToken(BTCB, recipientAddr, BTCB_IN))
          .to.emit(buyback, "SweepToken")
          .withArgs(BTCB, recipientAddr, BTCB_IN);

        expect((await btcb.balanceOf(recipientAddr)).sub(recipientBefore)).to.equal(BTCB_IN);
        expect(await btcb.balanceOf(buyback.address)).to.equal(0);
      });

      it("sweepToken reverts for non-owner caller", async () => {
        const [, outsider] = await hre.ethers.getSigners();
        await expect(
          buyback.connect(outsider).sweepToken(BTCB, await outsider.getAddress(), BTCB_IN),
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("sweepToken reverts ZeroAddressNotAllowed for zero token or recipient", async () => {
        await expect(
          buyback.sweepToken(hre.ethers.constants.AddressZero, deployerAddr, 1),
        ).to.be.revertedWithCustomError(buyback, "ZeroAddressNotAllowed");

        await expect(buyback.sweepToken(BTCB, hre.ethers.constants.AddressZero, 1)).to.be.revertedWithCustomError(
          buyback,
          "ZeroAddressNotAllowed",
        );
      });

      it("sweepToken reverts ZeroValueNotAllowed for zero amount", async () => {
        await expect(buyback.sweepToken(BTCB, deployerAddr, 0)).to.be.revertedWithCustomError(
          buyback,
          "ZeroValueNotAllowed",
        );
      });

      it("updateAssetsState emits AssetsReceived with contract token balance", async () => {
        await btcb.connect(whale).transfer(buyback.address, BTCB_IN);

        await expect(buyback.updateAssetsState(comptrollerAddr, BTCB))
          .to.emit(buyback, "AssetsReceived")
          .withArgs(comptrollerAddr, BTCB, BTCB_IN);

        // Cleanup for subsequent tests
        await buyback.sweepToken(BTCB, deployerAddr, BTCB_IN);
      });

      it("forwardBaseAsset reverts ComptrollerRequired when IS_RISK_FUND and comptroller is zero", async () => {
        await expect(buyback.forwardBaseAsset(hre.ethers.constants.AddressZero)).to.be.revertedWithCustomError(
          buyback,
          "ComptrollerRequired",
        );
      });

      it("forwardBaseAsset is a no-op when BASE_ASSET balance is zero", async () => {
        expect(await usdt.balanceOf(buyback.address)).to.equal(0);
        const destBefore = await usdt.balanceOf(RISK_FUND_V2);

        const tx = await buyback.forwardBaseAsset(comptrollerAddr);
        const receipt = await tx.wait();

        expect(receipt.events?.some((e: { event?: string }) => e.event === "BaseAssetForwarded")).to.equal(false);
        expect(await usdt.balanceOf(RISK_FUND_V2)).to.equal(destBefore);
      });
    });

    describe("Instance coverage (one happy-path swap per instance)", () => {
      async function runBuyback(
        buyback: Contract,
        destination: string,
        baseAsset: string,
        baseAssetContract: Contract,
        tokenIn: string,
        tokenInAmount: BigNumber,
        path: string[],
        comptrollerOverride?: string,
      ): Promise<void> {
        const destBefore = await baseAssetContract.balanceOf(destination);

        const quoted = await pancakeRouter.getAmountsOut(tokenInAmount, path);
        const minOut = quoted[quoted.length - 1].mul(99).div(100);
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const calldata = await pancakeCalldata(tokenIn, tokenInAmount, minOut, path, buyback.address, deadline);

        const ctr = comptrollerOverride ?? hre.ethers.constants.AddressZero;
        await buyback.executeBuyback(tokenIn, tokenInAmount, minOut, deadline, PANCAKE_V2_ROUTER, calldata, ctr);

        const destAfter = await baseAssetContract.balanceOf(destination);
        expect(destAfter.sub(destBefore)).to.be.gte(minOut);
        expect(await baseAssetContract.balanceOf(buyback.address)).to.equal(0);
        expect(await (await hre.ethers.getContractAt(ERC20_ABI, tokenIn)).balanceOf(buyback.address)).to.equal(0);

        // baseAsset unused indirectly here but kept for API symmetry with the call site
        expect(baseAsset).to.equal(await buyback.BASE_ASSET());
      }

      it("USDCPrimeBuyback: BTCB -> USDC via PancakeSwap forwards to PrimeLiquidityProvider", async () => {
        const usdc = await hre.ethers.getContractAt(ERC20_ABI, USDC);
        const buyback = await deployBuyback(PRIME_LIQUIDITY_PROVIDER, USDC, false);
        await buyback.setAllowedRouter(PANCAKE_V2_ROUTER, true);
        await grantAcm(buyback.address, EXECUTE_BUYBACK_SIG, deployerAddr);

        await btcb.connect(whale).transfer(buyback.address, BTCB_IN);
        await runBuyback(buyback, PRIME_LIQUIDITY_PROVIDER, USDC, usdc, BTCB, BTCB_IN, [BTCB, WBNB, USDC]);
      });

      it("BTCBPrimeBuyback: USDT -> BTCB via PancakeSwap forwards to PrimeLiquidityProvider", async () => {
        const buyback = await deployBuyback(PRIME_LIQUIDITY_PROVIDER, BTCB, false);
        await buyback.setAllowedRouter(PANCAKE_V2_ROUTER, true);
        await grantAcm(buyback.address, EXECUTE_BUYBACK_SIG, deployerAddr);

        const usdtIn = await acquireUsdt(buyback.address, parseUnits("0.02", 18));
        expect(usdtIn).to.be.gt(0);

        await runBuyback(buyback, PRIME_LIQUIDITY_PROVIDER, BTCB, btcb, USDT, usdtIn, [USDT, WBNB, BTCB]);
      });

      it("ETHPrimeBuyback: BTCB -> ETH via PancakeSwap forwards to PrimeLiquidityProvider", async () => {
        const eth = await hre.ethers.getContractAt(ERC20_ABI, ETH);
        const buyback = await deployBuyback(PRIME_LIQUIDITY_PROVIDER, ETH, false);
        await buyback.setAllowedRouter(PANCAKE_V2_ROUTER, true);
        await grantAcm(buyback.address, EXECUTE_BUYBACK_SIG, deployerAddr);

        await btcb.connect(whale).transfer(buyback.address, BTCB_IN);
        await runBuyback(buyback, PRIME_LIQUIDITY_PROVIDER, ETH, eth, BTCB, BTCB_IN, [BTCB, WBNB, ETH]);
      });

      it("XVSBuyback: BTCB -> XVS via PancakeSwap forwards to XVSVaultTreasury", async () => {
        const xvs = await hre.ethers.getContractAt(ERC20_ABI, XVS);
        const buyback = await deployBuyback(XVS_VAULT_TREASURY, XVS, false);
        await buyback.setAllowedRouter(PANCAKE_V2_ROUTER, true);
        await grantAcm(buyback.address, EXECUTE_BUYBACK_SIG, deployerAddr);

        await btcb.connect(whale).transfer(buyback.address, BTCB_IN);
        await runBuyback(buyback, XVS_VAULT_TREASURY, XVS, xvs, BTCB, BTCB_IN, [BTCB, WBNB, XVS]);
      });

      it("TreasuryBuyback: BTCB -> USDT via PancakeSwap forwards to VTreasury", async () => {
        const buyback = await deployBuyback(V_TREASURY, USDT, false);
        await buyback.setAllowedRouter(PANCAKE_V2_ROUTER, true);
        await grantAcm(buyback.address, EXECUTE_BUYBACK_SIG, deployerAddr);

        await btcb.connect(whale).transfer(buyback.address, BTCB_IN);
        await runBuyback(buyback, V_TREASURY, USDT, usdt, BTCB, BTCB_IN, [BTCB, WBNB, USDT]);
      });
    });
  });
});
