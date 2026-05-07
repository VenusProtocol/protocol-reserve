// Fork test scaffold for TokenBuybackMigrationHelper.sol
//
// This file is a DRAFT — it lives next to the helper source under `draft/` and
// is meant to be moved into venus-periphery's `tests/hardhat/Fork/` directory
// alongside the helper before it is run. It is not picked up by the vips repo's
// hardhat test runner.
//
// Once moved, run with:
//   FORKED_NETWORK=bscmainnet npx hardhat test tests/hardhat/Fork/TokenBuybackMigrationHelper.ts
//
// The suite drives the helper end-to-end on a BSC mainnet fork:
//   1. Impersonate NormalTimelock.
//   2. Deploy the helper with the production constructor args (constants below).
//   3. Have NormalTimelock grant DEFAULT_ADMIN_ROLE to the helper, accept and
//      transfer ownership of the 10 buybacks, transfer ownership of the 6
//      timelock-owned converters.
//   4. Call helper.execute() and assert the post-conditions:
//        - Each buyback is now owned by NormalTimelock
//        - Each timelock-owned converter is paused (conversionPaused == true)
//        - All drained tokens have zero residual on each converter
//        - Each replacement buyback received the drained balances
//        - PSR distributionTargets contain every new row at the expected
//          (schema, percentage); no stale row remains; per-schema sum == 1e4
//        - Operator has executeBuyback + forwardBaseAsset perms on every buyback
//        - Helper no longer holds DEFAULT_ADMIN_ROLE
//        - Helper.executed == true
//        - A second execute() reverts with AlreadyExecuted
//
// All addresses below mirror the snapshot read on 2026-05-07 from the BSC
// mainnet archive node and the deploy-time values planned for the new
// TokenBuyback proxies and helper. Buyback / OPERATOR / NEW_RISK_FUND_V2_IMPL
// are TODO until feat/VPD-1087 is deployed.
import { expect } from "chai";
import { BigNumber, Contract, Signer } from "ethers";
import { ethers } from "hardhat";

import { forking, initMainnetUser } from "../utils";

// Block at or after VPD-1087's TokenBuyback proxies are deployed on BSC mainnet.
// Update post-deploy.
const FORK_BLOCK = 0;

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

// TODOs filled post-deploy on feat/VPD-1087
const OPERATOR = ethers.constants.AddressZero;
const RISK_FUND_BUYBACK = ethers.constants.AddressZero;
const USDT_PRIME_BUYBACK = ethers.constants.AddressZero;
const U_PRIME_BUYBACK = ethers.constants.AddressZero;
const XVS_BUYBACK = ethers.constants.AddressZero;
const U_TREASURY_BUYBACK = ethers.constants.AddressZero;
const BTCB_TREASURY_BUYBACK = ethers.constants.AddressZero;
const ETH_TREASURY_BUYBACK = ethers.constants.AddressZero;
const USDT_TREASURY_BUYBACK = ethers.constants.AddressZero;
const USDC_TREASURY_BUYBACK = ethers.constants.AddressZero;
const XVS_TREASURY_BUYBACK = ethers.constants.AddressZero;

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
  "function isAllowedToCall(address,address,string) view returns (bool)",
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

      // Step 2: timelock acceptOwnership on each buyback (deploy script set
      // pendingOwner = NormalTimelock).
      for (const b of BUYBACKS) {
        await ownable(b).connect(timelock).acceptOwnership();
      }

      // Step 3: timelock transferOwnership of buybacks + converters to helper.
      for (const b of BUYBACKS) {
        await ownable(b).connect(timelock).transferOwnership(helper.address);
      }
      for (const c of TIMELOCK_OWNED_CONVERTERS) {
        await ownable(c).connect(timelock).transferOwnership(helper.address);
      }

      // Step 4: helper.execute() — atomic migration. No parameters; every drain
      // tuple and router address is hardcoded inside the helper source.
      await helper.connect(timelock).execute();

      // Step 5: timelock acceptOwnership of all 16 contracts (helper handed back).
      for (const a of [...BUYBACKS, ...TIMELOCK_OWNED_CONVERTERS]) {
        await ownable(a).connect(timelock).acceptOwnership();
      }
    });

    describe("post-execute state", () => {
      it("helper.executed is true", async () => {
        expect(await helper.executed()).to.be.true;
      });

      it("a second execute() reverts with AlreadyExecuted", async () => {
        await expect(helper.connect(timelock).execute()).to.be.revertedWithCustomError(helper, "AlreadyExecuted");
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
          expect(await acm.isAllowedToCall(OPERATOR, b, EXECUTE_BUYBACK_SIG), b).to.be.true;
          expect(await acm.isAllowedToCall(OPERATOR, b, FORWARD_BASE_ASSET_SIG), b).to.be.true;
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
      it("execute() reverts when called by anyone other than NormalTimelock", async () => {
        // Fresh deployment to test the guard cleanly.
        const Factory = await ethers.getContractFactory("TokenBuybackMigrationHelper", timelock);
        const fresh = await Factory.deploy();
        await fresh.deployed();
        const [other] = await ethers.getSigners();
        await expect(fresh.connect(other).execute()).to.be.revertedWithCustomError(fresh, "NotTimelock");
      });
    });
  });
});
