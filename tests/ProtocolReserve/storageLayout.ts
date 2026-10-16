import { expect } from "chai";
import { artifacts } from "hardhat";

/**
 * `ProtocolShareReserve` runs behind a transparent proxy holding live income accounting. It is a leaf
 * contract with no trailing gap, so new state is appended after `distributionTargets` and nothing
 * above it may move. The compiler does not catch a reorder, so these tests pin the layout it emits.
 */
const PSR = "contracts/ProtocolReserve/ProtocolShareReserve.sol:ProtocolShareReserve";

interface Entry {
  label: string;
  slot: number;
  offset: number;
  type: string;
}

async function readLayout(fullyQualifiedName: string): Promise<Entry[]> {
  const [sourceName, contractName] = fullyQualifiedName.split(":");
  const buildInfo = await artifacts.getBuildInfo(fullyQualifiedName);
  if (!buildInfo) {
    throw new Error(`no build info for ${fullyQualifiedName}; compile first`);
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const output = (buildInfo.output.contracts as any)[sourceName][contractName];
  const layout = output.storageLayout;
  if (!layout) {
    throw new Error(`no storageLayout for ${fullyQualifiedName}; is @openzeppelin/hardhat-upgrades still loaded?`);
  }

  return layout.storage.map((item: any) => ({
    label: item.label,
    slot: Number(item.slot),
    offset: item.offset,
    type: layout.types[item.type].label,
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

function variable(entries: Entry[], label: string): Entry {
  const found = entries.find(e => e.label === label);
  if (!found) {
    throw new Error(`ProtocolShareReserve no longer declares \`${label}\``);
  }
  return found;
}

describe("ProtocolShareReserve: storage layout", () => {
  let entries: Entry[];

  before(async () => {
    entries = await readLayout(PSR);
  });

  // The slots the live proxies already hold data in. Any change here is a broken upgrade.
  const deployed: [string, number, string][] = [
    ["poolRegistry", 301, "address"],
    [
      "assetsReserves",
      302,
      "mapping(address => mapping(address => mapping(enum ProtocolShareReserve.Schema => uint256)))",
    ],
    ["totalAssetReserve", 303, "mapping(address => uint256)"],
    ["distributionTargets", 304, "struct ProtocolShareReserve.DistributionConfig[]"],
  ];

  for (const [label, slot, type] of deployed) {
    it(`keeps \`${label}\` at slot ${slot}`, () => {
      const entry = variable(entries, label);
      expect(entry.slot, `${label} moved slot`).to.equal(slot);
      expect(entry.offset, `${label} moved within its slot`).to.equal(0);
      expect(entry.type, `${label} changed type`).to.equal(type);
    });
  }

  it("appends the pool registry set after the deployed state", () => {
    expect(variable(entries, "additionalPoolRegistries").slot).to.equal(305);
    expect(variable(entries, "isAdditionalPoolRegistry").slot).to.equal(306);
  });

  it("declares nothing between slot 0 and `poolRegistry` other than the inherited bases", () => {
    // These belong to AccessControlledV8 / ReentrancyGuard / MaxLoopsLimitHelper. A new name here
    // means a base was inserted or reordered, which shifts every slot above it.
    const belowPoolRegistry = entries.filter(e => e.slot < 301).map(e => e.label);
    expect(belowPoolRegistry).to.deep.equal([
      "_initialized",
      "_initializing",
      "__gap",
      "_owner",
      "__gap",
      "_pendingOwner",
      "__gap",
      "_accessControlManager",
      "__gap",
      "_status",
      "__gap",
      "maxLoopsLimit",
      "__gap",
    ]);
  });
});
