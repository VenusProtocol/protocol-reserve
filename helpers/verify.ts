import { Deployment } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const SKIP_NETWORKS = new Set(["hardhat", "localhost"]);

export async function verifyDeployment(hre: HardhatRuntimeEnvironment, name: string): Promise<void> {
  if (SKIP_NETWORKS.has(hre.network.name) || !hre.network.live) return;
  if (!process.env.ETHERSCAN_API_KEY) {
    console.log(`[verify] skipping ${name} — ETHERSCAN_API_KEY not set`);
    return;
  }

  const proxy: Deployment | null = await hre.deployments.getOrNull(`${name}_Proxy`);
  const impl: Deployment | null = await hre.deployments.getOrNull(`${name}_Implementation`);
  const main: Deployment = await hre.deployments.get(name);

  const targets: { label: string; address: string; args: unknown[] }[] = [];
  if (impl) targets.push({ label: `${name}_Implementation`, address: impl.address, args: impl.args ?? [] });
  if (proxy) targets.push({ label: `${name}_Proxy`, address: proxy.address, args: proxy.args ?? [] });
  if (!impl && !proxy) targets.push({ label: name, address: main.address, args: main.args ?? [] });

  for (const t of targets) {
    try {
      await hre.run("verify:verify", { address: t.address, constructorArguments: t.args });
      console.log(`[verify] ${t.label} verified at ${t.address}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already verified/i.test(msg)) {
        console.log(`[verify] ${t.label} already verified at ${t.address}`);
      } else {
        console.warn(`[verify] failed for ${t.label} at ${t.address}: ${msg}`);
      }
    }
  }
}

export async function verifyDeployments(hre: HardhatRuntimeEnvironment, names: string[]): Promise<void> {
  for (const n of names) {
    await verifyDeployment(hre, n);
  }
}
