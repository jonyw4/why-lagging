import { Resolver } from "node:dns/promises";
import type { ProbeMetrics } from "../../shared/types.ts";
import { asErrorMessage } from "./exec.ts";

const HOSTS = ["google.com", "cloudflare.com"] as const;
const DNS_TIMEOUT_MS = 5000;

async function timedResolve(
	hostname: string,
	servers: string[] | null,
): Promise<{ ms: number | null; error?: string }> {
	const resolver = new Resolver();
	if (servers) resolver.setServers(servers);

	const work = (async () => {
		const started = performance.now();
		await resolver.resolve4(hostname);
		return performance.now() - started;
	})();

	const timeout = new Promise<never>((_, reject) => {
		setTimeout(() => reject(new Error("timeout")), DNS_TIMEOUT_MS);
	});

	try {
		const ms = await Promise.race([work, timeout]);
		return { ms };
	} catch (error) {
		return { ms: null, error: asErrorMessage(error) };
	}
}

function bestMs(values: Array<number | null>): number | null {
	const ok = values.filter((v): v is number => v != null);
	if (ok.length === 0) return null;
	return Math.min(...ok);
}

export async function probeDns(): Promise<ProbeMetrics> {
	try {
		const [sysGoogle, sysCf, cfGoogle, cfCf, gGoogle, gCf] = await Promise.all([
			timedResolve(HOSTS[0], null),
			timedResolve(HOSTS[1], null),
			timedResolve(HOSTS[0], ["1.1.1.1"]),
			timedResolve(HOSTS[1], ["1.1.1.1"]),
			timedResolve(HOSTS[0], ["8.8.8.8"]),
			timedResolve(HOSTS[1], ["8.8.8.8"]),
		]);

		const systemMs = bestMs([sysGoogle.ms, sysCf.ms]);
		const cloudflareMs = bestMs([cfGoogle.ms, cfCf.ms]);
		const googleMs = bestMs([gGoogle.ms, gCf.ms]);
		const errors = [sysGoogle, sysCf, cfGoogle, cfCf, gGoogle, gCf]
			.map((r) => r.error)
			.filter((e): e is string => Boolean(e));

		return {
			id: "dns.resolution",
			available: systemMs != null || cloudflareMs != null || googleMs != null,
			source: "dns.promises",
			metrics: {
				systemMs,
				cloudflareMs,
				googleMs,
				systemGoogleMs: sysGoogle.ms,
				systemCloudflareHostMs: sysCf.ms,
			},
			error: errors.length > 0 ? errors[0] : undefined,
		};
	} catch (error) {
		return {
			id: "dns.resolution",
			available: false,
			source: "dns.promises",
			metrics: {},
			error: asErrorMessage(error),
		};
	}
}
