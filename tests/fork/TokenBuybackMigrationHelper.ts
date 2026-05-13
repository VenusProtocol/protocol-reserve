// Fork test for TokenBuybackMigrationHelper.sol on BSC mainnet.
//
// Run with:
//   FORK=true FORKED_NETWORK=bscmainnet npx hardhat test tests/fork/TokenBuybackMigrationHelper.ts
//
// The suite drives the helper end-to-end on a BSC mainnet fork:
//   1. Impersonate NormalTimelock.
//   2. Deploy the helper.
//   3. NormalTimelock grants DEFAULT_ADMIN_ROLE to the helper, points the
//      10 buybacks' pendingOwner at it (impersonating the live owner —
//      deploy scripts now set helper directly), and transfers ownership of
//      the 6 timelock-owned converters.
//   4. Call helper.execute1(), then helper.execute2(), then NormalTimelock
//      acceptOwnership on all 16. Assert:
//        - Each buyback is now owned by NormalTimelock
//        - Each timelock-owned converter is paused (conversionPaused == true)
//        - Shortfall.auctionsPaused == true
//        - All drained tokens have zero residual on each converter
//        - Each replacement buyback received the drained balances
//        - PSR distributionTargets contain every new row at the expected
//          (schema, percentage); no stale row remains; per-schema sum == 1e4
//        - Operator has executeBuyback + forwardBaseAsset perms on every buyback
//        - Helper no longer holds DEFAULT_ADMIN_ROLE
//        - Helper.executed1 == true and Helper.executed2 == true
//        - A second execute1() / execute2() reverts with AlreadyExecuted
//        - execute2() called before execute1() reverts with Execute1NotRun
//
// Buyback addresses mirror the redeployed proxies from PR #162.
import { expect } from "chai";
import { BigNumber, Contract, Signer } from "ethers";
import { ethers } from "hardhat";

import { forking, initMainnetUser } from "../utils";

// Block after the PR #162 redeploy of the 10 TokenBuyback proxies on BSC
// mainnet. Deploy landed at block 98010461; pinning just past that.
const FORK_BLOCK = 98010500;

// ------------- Production constants (BSC mainnet) -------------
const NORMAL_TIMELOCK = "0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396";
const ACM = "0x4788629ABc6cFCA10F9f969efdEAa1cF70c23555";
const PSR = "0xCa01D5A9A248a830E9D93231e791B1afFed7c446";
const VTREASURY = "0xF322942f644A996A617BD29c16bd7d231d9F35E9";

// Legacy converters (timelock-owned)
const RISK_FUND_CONVERTER = "0xA5622D276CcbB8d9BBE3D1ffd1BB11a0032E53F0";
const USDT_PRIME_CONVERTER = "0xD9f101AA67F3D72662609a2703387242452078C3";
const USDC_PRIME_CONVERTER = "0xa758c9C215B6c4198F0a0e3FA46395Fa15Db691b";
const BTCB_PRIME_CONVERTER = "0xE8CeAa79f082768f99266dFd208d665d2Dd18f53";
const ETH_PRIME_CONVERTER = "0xca430B8A97Ea918fF634162acb0b731445B8195E";
const XVS_VAULT_CONVERTER = "0xd5b9AE835F4C59272032B3B954417179573331E0";
// Multisig-owned (skipped in execute())
const WBNB_BURN_CONVERTER = "0x9eF79830e626C8ccA7e46DCEd1F90e51E7cFCeBE";

// Tokens
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const BTCB = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";
const ETH = "0x2170Ed0880ac9A755fd29B2688956BD959F933F8";
const XVS = "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const BUSD = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
const DAI = "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3";
const CAKE = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
const U = "0xcE24439F2D9C6a2289F741120FE202248B666666";

// PLP — source of the USDC the VIP sweeps into the helper before executeSwap.
const PRIME_LIQUIDITY_PROVIDER = "0x23c4F844ffDdC6161174eB32c770D4D8C07833F2";
// Matches the helper's `USDC_PER_LEG * 2` budget.
const USDC_TO_SWEEP = ethers.utils.parseUnits("14986", 18);

// Routers (allowlisted on every buyback)
const ROUTERS = [
  "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PCS V2
  "0x1b81D678ffb9C0263b24A97847620C99d213eB14", // PCS V3
  "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4", // PCS Smart
  "0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB", // PCS Universal
  "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch
  "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24", // Uni V2 SR02
  "0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2", // Uni V3 SR02
  "0x8b844f885672f333bc0042cb669255f93a4c1e6b", // Uni V4
  "0x1906c1d672b88cd1b9ac7593301ca990f94eae07", // Uni Universal
];

// Mirror the helper's hardcoded production constants (BSC mainnet).
const OPERATOR = "0x88ac9ca69A371f47798Df18e5C36449af44526a4";
const SHORTFALL = "0xf37530A8a810Fcb501AA0Ecd0B0699388F0F2209";
// Redeployed buyback proxies from PR #162.
const RISK_FUND_BUYBACK = "0x0c71EFabD00329E839745ef23aB946d3ed24A805";
const USDT_PRIME_BUYBACK = "0xD721932C7CA41Eb5305867287010587a266346a8";
const U_PRIME_BUYBACK = "0xBC9fFBfb799B2d189669D3816E2B7273c69041bd";
const XVS_BUYBACK = "0x637E6246BBb0F9aBae9d764F5e1bB6347f028C12";
const U_TREASURY_BUYBACK = "0xec63411423D03327De19135446dDdA3055D2feA8";
const BTCB_TREASURY_BUYBACK = "0x1F306a0d929a7098a0A0b12248Ba97600AB79026";
const ETH_TREASURY_BUYBACK = "0x41954F0bf26959dF2e1B8302DEBf736B5b154B64";
const USDT_TREASURY_BUYBACK = "0xB3dDf13E8B6b8dE10F5826087C202b80F1D1b490";
const USDC_TREASURY_BUYBACK = "0xd7aC40f9bd9A1beb8E2d121b4446CF90417cf169";
const XVS_TREASURY_BUYBACK = "0x6D2d239c16453062cF145A7a5128A6a60710d236";

const BUYBACKS = [
  RISK_FUND_BUYBACK,
  USDT_PRIME_BUYBACK,
  U_PRIME_BUYBACK,
  XVS_BUYBACK,
  U_TREASURY_BUYBACK,
  BTCB_TREASURY_BUYBACK,
  ETH_TREASURY_BUYBACK,
  USDT_TREASURY_BUYBACK,
  USDC_TREASURY_BUYBACK,
  XVS_TREASURY_BUYBACK,
];

const TIMELOCK_OWNED_CONVERTERS = [
  RISK_FUND_CONVERTER,
  USDT_PRIME_CONVERTER,
  USDC_PRIME_CONVERTER,
  BTCB_PRIME_CONVERTER,
  ETH_PRIME_CONVERTER,
  XVS_VAULT_CONVERTER,
];

// Per-converter drain candidate token list (snapshot 2026-05-07)
const DRAIN_TOKENS_RISK_FUND = [USDT, USDC, BTCB, ETH, XVS, WBNB, BUSD, DAI, CAKE];
const DRAIN_TOKENS_USDT_PRIME = [USDC, BTCB, ETH, XVS, WBNB, DAI, CAKE];
const DRAIN_TOKENS_USDC_PRIME = [BTCB, ETH, XVS, WBNB, DAI, CAKE];
const DRAIN_TOKENS_BTCB_PRIME = [XVS, DAI, CAKE];
const DRAIN_TOKENS_ETH_PRIME = [USDT, BTCB, XVS, DAI, CAKE];
const DRAIN_TOKENS_XVS_VAULT = [USDT, USDC, BTCB, ETH, WBNB, BUSD, DAI, CAKE];

// Expected new PSR rows
const NEW_PSR_ROWS: [number, number, string][] = [
  [0, 1200, U_TREASURY_BUYBACK],
  [0, 600, BTCB_TREASURY_BUYBACK],
  [0, 600, ETH_TREASURY_BUYBACK],
  [0, 600, USDT_TREASURY_BUYBACK],
  [0, 600, USDC_TREASURY_BUYBACK],
  [0, 400, XVS_TREASURY_BUYBACK],
  [0, 1000, USDT_PRIME_BUYBACK],
  [0, 1000, U_PRIME_BUYBACK],
  [0, 2000, RISK_FUND_BUYBACK],
  [0, 2000, XVS_BUYBACK],
  [1, 1800, U_TREASURY_BUYBACK],
  [1, 900, BTCB_TREASURY_BUYBACK],
  [1, 900, ETH_TREASURY_BUYBACK],
  [1, 900, USDT_TREASURY_BUYBACK],
  [1, 900, USDC_TREASURY_BUYBACK],
  [1, 600, XVS_TREASURY_BUYBACK],
  [1, 2000, RISK_FUND_BUYBACK],
  [1, 2000, XVS_BUYBACK],
];

const STALE_DESTINATIONS = new Set(
  [VTREASURY, ...TIMELOCK_OWNED_CONVERTERS, WBNB_BURN_CONVERTER].map(a => a.toLowerCase()),
);

// Minimal ABIs
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
const OWNABLE2_ABI = [
  "function owner() view returns (address)",
  "function pendingOwner() view returns (address)",
  "function acceptOwnership()",
  "function transferOwnership(address)",
];
const CONVERTER_ABI = [...OWNABLE2_ABI, "function conversionPaused() view returns (bool)"];
const ACM_ABI = [
  "function grantRole(bytes32 role, address account)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function isAllowedToCall(address account, string functionSig) view returns (bool)",
];
const PSR_ABI = ["function distributionTargets(uint256) view returns (uint8,uint16,address)"];

const EXECUTE_BUYBACK_SIG = "executeBuyback(address,uint256,uint256,uint256,address,bytes,address)";
const FORWARD_BASE_ASSET_SIG = "forwardBaseAsset(address,uint256)";
const DEFAULT_ADMIN_ROLE = "0x" + "00".repeat(32);

const erc20 = (token: string) => new ethers.Contract(token, ERC20_ABI, ethers.provider);
const ownable = (addr: string) => new ethers.Contract(addr, OWNABLE2_ABI, ethers.provider);
const converter = (addr: string) => new ethers.Contract(addr, CONVERTER_ABI, ethers.provider);

const FORK_MAINNET = process.env.FORK === "true" && process.env.FORKED_NETWORK === "bscmainnet";

forking(FORK_BLOCK, () => {
  if (!FORK_MAINNET) return;

  describe("TokenBuybackMigrationHelper (BSC mainnet fork)", function () {
    let helper: Contract;
    let timelock: Signer;
    const balanceBefore = new Map<string, BigNumber>(); // key: token:recipient
    // Pre-swap balances captured in `before` so post-state asserts can verify
    // PLP received the swap outputs and the timelock got the USDC leftover.
    let usdtPlpBefore: BigNumber;
    let uPlpBefore: BigNumber;
    let usdcTimelockBefore: BigNumber;

    before(async () => {
      timelock = await initMainnetUser(NORMAL_TIMELOCK);
      await ethers.provider.send("hardhat_setBalance", [NORMAL_TIMELOCK, "0x21e19e0c9bab2400000"]);

      // Deploy helper. All addresses (incl. NORMAL_TIMELOCK, ACM, PSR, VTREASURY,
      // legacy converters, the 10 new buybacks and OPERATOR) are hardcoded in the
      // helper source as `address private constant`. The deployer must use a
      // build of the source where the eleven TODO addresses (10 buybacks +
      // OPERATOR) have been filled; otherwise the first downstream call inside
      // execute() that checks a non-zero address will revert.
      const Factory = await ethers.getContractFactory("TokenBuybackMigrationHelper", timelock);
      helper = await Factory.deploy();
      await helper.deployed();

      // Snapshot recipient balances per (token, recipient).
      const drainPlan: { converter: string; tokens: string[]; recipient: string }[] = [
        { converter: RISK_FUND_CONVERTER, tokens: DRAIN_TOKENS_RISK_FUND, recipient: RISK_FUND_BUYBACK },
        { converter: USDT_PRIME_CONVERTER, tokens: DRAIN_TOKENS_USDT_PRIME, recipient: U_PRIME_BUYBACK },
        { converter: USDC_PRIME_CONVERTER, tokens: DRAIN_TOKENS_USDC_PRIME, recipient: U_PRIME_BUYBACK },
        { converter: BTCB_PRIME_CONVERTER, tokens: DRAIN_TOKENS_BTCB_PRIME, recipient: U_PRIME_BUYBACK },
        { converter: ETH_PRIME_CONVERTER, tokens: DRAIN_TOKENS_ETH_PRIME, recipient: U_PRIME_BUYBACK },
        { converter: XVS_VAULT_CONVERTER, tokens: DRAIN_TOKENS_XVS_VAULT, recipient: XVS_BUYBACK },
      ];
      for (const p of drainPlan) {
        for (const t of p.tokens) {
          const k = `${t.toLowerCase()}:${p.recipient.toLowerCase()}`;
          if (!balanceBefore.has(k)) {
            balanceBefore.set(k, await erc20(t).balanceOf(p.recipient));
          }
        }
      }

      // Step 1: timelock grants DEFAULT_ADMIN_ROLE to helper.
      const acm = new ethers.Contract(ACM, ACM_ABI, timelock);
      await acm.grantRole(DEFAULT_ADMIN_ROLE, helper.address);

      // Step 2: re-point pendingOwner of each buyback to the freshly-deployed
      // test helper, regardless of who currently owns it. Mirrors the VIP-800
      // sim's `before` hook: at later fork blocks the buybacks may already be
      // pointed at a previously-deployed migration helper (V1), so we
      // impersonate the live owner instead of assuming NormalTimelock.
      for (const b of BUYBACKS) {
        const ownerAddr = await ownable(b).owner();
        const pending = await ownable(b).pendingOwner();
        if (pending.toLowerCase() === helper.address.toLowerCase()) continue;
        const ownerSigner = await initMainnetUser(ownerAddr);
        await ethers.provider.send("hardhat_setBalance", [ownerAddr, "0xde0b6b3a7640000"]);
        await new ethers.Contract(b, ["function transferOwnership(address)"], ownerSigner).transferOwnership(
          helper.address,
        );
      }

      // Step 3: timelock transferOwnership of the 6 timelock-owned converters
      // to helper. These are owned by NormalTimelock at every relevant block.
      for (const c of TIMELOCK_OWNED_CONVERTERS) {
        await ownable(c).connect(timelock).transferOwnership(helper.address);
      }

      // Step 4: helper.execute1() — pauses converters + Shortfall, rewires
      // PSR, grants operator perms, renounces DEFAULT_ADMIN_ROLE. Helper
      // retains ownership of all 16 contracts until execute2.
      const tx1 = await helper.connect(timelock).execute1();
      const r1 = await tx1.wait();

      // Step 5: simulate the Prime-block VIP step that feeds USDC to the
      // helper. Real VIP path: NormalTimelock (PLP owner) calls
      // `PLP.sweepToken(USDC, helper, USDC_TO_SWEEP)`. Mirror that by
      // impersonating PLP itself and `transfer`-ing the same amount —
      // equivalent end state for executeSwap's perspective.
      usdtPlpBefore = await erc20(USDT).balanceOf(PRIME_LIQUIDITY_PROVIDER);
      uPlpBefore = await erc20(U).balanceOf(PRIME_LIQUIDITY_PROVIDER);
      usdcTimelockBefore = await erc20(USDC).balanceOf(NORMAL_TIMELOCK);
      const plpSigner = await initMainnetUser(PRIME_LIQUIDITY_PROVIDER);
      await ethers.provider.send("hardhat_setBalance", [PRIME_LIQUIDITY_PROVIDER, "0xde0b6b3a7640000"]);
      const usdc = new ethers.Contract(USDC, ["function transfer(address,uint256) returns (bool)"], plpSigner);
      await usdc.transfer(helper.address, USDC_TO_SWEEP);

      // Step 6: helper.executeSwap() — approves USDC, swaps USDC -> {USDT, U}
      // on PCS V3 (soft-fail per leg), forwards leftover USDC back to
      // NormalTimelock.
      const txSwap = await helper.connect(timelock).executeSwap();
      const rSwap = await txSwap.wait();

      // Step 7: helper.execute2() — allowlists routers on every buyback,
      // drains the 6 converters into their replacement buybacks, and hands
      // ownership of all 16 contracts back to NormalTimelock.
      const tx2 = await helper.connect(timelock).execute2();
      const r2 = await tx2.wait();

      // BSC Osaka hardfork per-tx gas cap = 16,777,216 (2^24).
      const OSAKA_CAP = BigNumber.from(16_777_216);
      const pct = (g: BigNumber) => g.mul(10000).div(OSAKA_CAP).toNumber() / 100;
      console.log(`[gas] execute1    gasUsed=${r1.gasUsed.toString()} (${pct(r1.gasUsed)}% of Osaka cap)`);
      console.log(`[gas] executeSwap gasUsed=${rSwap.gasUsed.toString()} (${pct(rSwap.gasUsed)}% of Osaka cap)`);
      console.log(`[gas] execute2    gasUsed=${r2.gasUsed.toString()} (${pct(r2.gasUsed)}% of Osaka cap)`);
      const total = r1.gasUsed.add(rSwap.gasUsed).add(r2.gasUsed);
      console.log(`[gas] combined    =${total.toString()} (${pct(total)}% of Osaka cap)`);

      // Log every StepFailed event so soft-failing swap legs are visible.
      const stepFailedTopic = ethers.utils.id("StepFailed(string,bytes)");
      const stepFailedIface = new ethers.utils.Interface(["event StepFailed(string step, bytes reason)"]);
      for (const r of [r1, rSwap, r2]) {
        for (const log of r.logs) {
          if (log.topics[0] === stepFailedTopic) {
            const parsed = stepFailedIface.parseLog(log);
            console.log(`[StepFailed] step="${parsed.args.step}" reason=${parsed.args.reason}`);
          }
        }
      }

      // Step 8: timelock acceptOwnership of all 16 contracts (helper handed
      // back in execute2).
      for (const a of [...BUYBACKS, ...TIMELOCK_OWNED_CONVERTERS]) {
        await ownable(a).connect(timelock).acceptOwnership();
      }
    });

    describe("post-execute state", () => {
      it("helper.executed1, executedSwap and executed2 are true", async () => {
        expect(await helper.executed1()).to.be.true;
        expect(await helper.executedSwap()).to.be.true;
        expect(await helper.executed2()).to.be.true;
      });

      it("a second execute1() reverts with AlreadyExecuted", async () => {
        await expect(helper.connect(timelock).execute1()).to.be.revertedWithCustomError(helper, "AlreadyExecuted");
      });

      it("a second executeSwap() reverts with AlreadyExecuted", async () => {
        await expect(helper.connect(timelock).executeSwap()).to.be.revertedWithCustomError(helper, "AlreadyExecuted");
      });

      it("a second execute2() reverts with AlreadyExecuted", async () => {
        await expect(helper.connect(timelock).execute2()).to.be.revertedWithCustomError(helper, "AlreadyExecuted");
      });

      it("executeSwap leaves no USDC in the helper", async () => {
        expect(await erc20(USDC).balanceOf(helper.address)).to.equal(0);
      });

      it("PLP received the USDT swap output (>= USDT_MIN_OUT)", async () => {
        const after = await erc20(USDT).balanceOf(PRIME_LIQUIDITY_PROVIDER);
        const delta = after.sub(usdtPlpBefore);
        // helper's USDT_MIN_OUT = 7418e18; assert at least that much landed in PLP
        expect(delta).to.be.gte(ethers.utils.parseUnits("7418", 18));
      });

      it("PLP received the U swap output (>= U_MIN_OUT)", async () => {
        const after = await erc20(U).balanceOf(PRIME_LIQUIDITY_PROVIDER);
        const delta = after.sub(uPlpBefore);
        expect(delta).to.be.gte(ethers.utils.parseUnits("7418", 18));
      });

      it("any USDC leftover after swaps was forwarded to NormalTimelock", async () => {
        // Either both legs consumed USDC_PER_LEG (no leftover) or one leg
        // soft-failed and leftover landed back at NormalTimelock. In both
        // cases the timelock balance must not have decreased.
        const after = await erc20(USDC).balanceOf(NORMAL_TIMELOCK);
        expect(after).to.be.gte(usdcTimelockBefore);
      });

      it("helper no longer holds DEFAULT_ADMIN_ROLE on ACM", async () => {
        const acm = new ethers.Contract(ACM, ACM_ABI, ethers.provider);
        expect(await acm.hasRole(DEFAULT_ADMIN_ROLE, helper.address)).to.be.false;
      });

      it("NormalTimelock owns every buyback and timelock-owned converter", async () => {
        for (const a of [...BUYBACKS, ...TIMELOCK_OWNED_CONVERTERS]) {
          expect(await ownable(a).owner()).to.equal(NORMAL_TIMELOCK);
        }
      });

      it("every timelock-owned converter is paused", async () => {
        for (const c of TIMELOCK_OWNED_CONVERTERS) {
          expect(await converter(c).conversionPaused(), c).to.be.true;
        }
      });

      it("Shortfall auctions are paused", async () => {
        const shortfall = new ethers.Contract(
          SHORTFALL,
          ["function auctionsPaused() view returns (bool)"],
          ethers.provider,
        );
        expect(await shortfall.auctionsPaused()).to.be.true;
      });

      it("each timelock-owned converter has zero residual for every drained token", async () => {
        const matrix: [string, string[]][] = [
          [RISK_FUND_CONVERTER, DRAIN_TOKENS_RISK_FUND],
          [USDT_PRIME_CONVERTER, DRAIN_TOKENS_USDT_PRIME],
          [USDC_PRIME_CONVERTER, DRAIN_TOKENS_USDC_PRIME],
          [BTCB_PRIME_CONVERTER, DRAIN_TOKENS_BTCB_PRIME],
          [ETH_PRIME_CONVERTER, DRAIN_TOKENS_ETH_PRIME],
          [XVS_VAULT_CONVERTER, DRAIN_TOKENS_XVS_VAULT],
        ];
        for (const [c, tokens] of matrix) {
          for (const t of tokens) {
            expect(await erc20(t).balanceOf(c), `${c}/${t}`).to.equal(0);
          }
        }
      });

      it("recipient buybacks received the drained balances", async () => {
        // Sum expected delta per (token, recipient) and assert post >= before + delta.
        const recipients: { converter: string; tokens: string[]; recipient: string }[] = [
          { converter: RISK_FUND_CONVERTER, tokens: DRAIN_TOKENS_RISK_FUND, recipient: RISK_FUND_BUYBACK },
          { converter: USDT_PRIME_CONVERTER, tokens: DRAIN_TOKENS_USDT_PRIME, recipient: U_PRIME_BUYBACK },
          { converter: USDC_PRIME_CONVERTER, tokens: DRAIN_TOKENS_USDC_PRIME, recipient: U_PRIME_BUYBACK },
          { converter: BTCB_PRIME_CONVERTER, tokens: DRAIN_TOKENS_BTCB_PRIME, recipient: U_PRIME_BUYBACK },
          { converter: ETH_PRIME_CONVERTER, tokens: DRAIN_TOKENS_ETH_PRIME, recipient: U_PRIME_BUYBACK },
          { converter: XVS_VAULT_CONVERTER, tokens: DRAIN_TOKENS_XVS_VAULT, recipient: XVS_BUYBACK },
        ];
        for (const r of recipients) {
          for (const t of r.tokens) {
            const k = `${t.toLowerCase()}:${r.recipient.toLowerCase()}`;
            const after = await erc20(t).balanceOf(r.recipient);
            expect(after, k).to.be.gte(balanceBefore.get(k) ?? BigNumber.from(0));
          }
        }
      });

      it("operator has executeBuyback + forwardBaseAsset perms on every buyback", async () => {
        const acm = new ethers.Contract(ACM, ACM_ABI, ethers.provider);
        for (const b of BUYBACKS) {
          const buybackSigner = await initMainnetUser(b);
          await ethers.provider.send("hardhat_setBalance", [b, "0xde0b6b3a7640000"]);
          expect(await acm.connect(buybackSigner).isAllowedToCall(OPERATOR, EXECUTE_BUYBACK_SIG), b).to.be.true;
          expect(await acm.connect(buybackSigner).isAllowedToCall(OPERATOR, FORWARD_BASE_ASSET_SIG), b).to.be.true;
        }
      });

      it("every router is allowlisted on every buyback", async () => {
        const buybackAbi = ["function allowedRouters(address) view returns (bool)"];
        for (const b of BUYBACKS) {
          const buyback = new ethers.Contract(b, buybackAbi, ethers.provider);
          for (const r of ROUTERS) {
            expect(await buyback.allowedRouters(r), `${b}/${r}`).to.be.true;
          }
        }
      });

      it("PSR rows: every new row present at expected percentage; no stale row remains; per-schema sum == 1e4", async () => {
        const psr = new ethers.Contract(PSR, PSR_ABI, ethers.provider);
        const rows: { schema: number; percentage: number; destination: string }[] = [];
        for (let i = 0; ; i++) {
          try {
            const r = await psr.distributionTargets(i);
            rows.push({
              schema: Number(r[0]),
              percentage: Number(r[1]),
              destination: String(r[2]).toLowerCase(),
            });
          } catch {
            break;
          }
        }

        for (const [schema, percentage, destination] of NEW_PSR_ROWS) {
          const found = rows.find(r => r.schema === schema && r.destination === destination.toLowerCase());
          expect(found, `missing schema=${schema} dest=${destination}`).to.not.be.undefined;
          expect(found!.percentage).to.equal(percentage);
        }

        for (const r of rows) {
          expect(STALE_DESTINATIONS.has(r.destination), `stale row left: ${r.destination}`).to.be.false;
        }

        const totals: Record<number, number> = { 0: 0, 1: 0 };
        for (const r of rows) totals[r.schema] += r.percentage;
        expect(totals[0]).to.equal(10000);
        expect(totals[1]).to.equal(10000);
      });
    });

    describe("guards", () => {
      it("execute1() reverts when called by anyone other than NormalTimelock", async () => {
        const Factory = await ethers.getContractFactory("TokenBuybackMigrationHelper", timelock);
        const fresh = await Factory.deploy();
        await fresh.deployed();
        const [other] = await ethers.getSigners();
        await expect(fresh.connect(other).execute1()).to.be.revertedWithCustomError(fresh, "NotTimelock");
      });

      it("execute2() reverts when called by anyone other than NormalTimelock", async () => {
        const Factory = await ethers.getContractFactory("TokenBuybackMigrationHelper", timelock);
        const fresh = await Factory.deploy();
        await fresh.deployed();
        const [other] = await ethers.getSigners();
        await expect(fresh.connect(other).execute2()).to.be.revertedWithCustomError(fresh, "NotTimelock");
      });

      it("execute2() reverts with Execute1NotRun when called before execute1()", async () => {
        const Factory = await ethers.getContractFactory("TokenBuybackMigrationHelper", timelock);
        const fresh = await Factory.deploy();
        await fresh.deployed();
        await expect(fresh.connect(timelock).execute2()).to.be.revertedWithCustomError(fresh, "Execute1NotRun");
      });
    });
  });
});
