import type { ProbeMetrics } from "../../shared/types.ts";
import { asErrorMessage } from "./exec.ts";
import { pingStats } from "./ping.ts";
import { downloadBytes } from "./throughput.ts";
import { runNetworkQuality } from "./network-quality.ts";

export async function probeBufferbloat(): Promise<ProbeMetrics> {
	try {
		const idle = await pingStats("1.1.1.1", 5, 8000);
		const [loaded, download, nq] = await Promise.all([
			pingStats("1.1.1.1", 8, 8000),
			downloadBytes(5_000_000, 12_000),
			runNetworkQuality(),
		]);

		const idleAvg = idle.avgMs;
		const loadedAvg = loaded.avgMs;
		const deltaMs =
			idleAvg != null && loadedAvg != null ? Math.max(0, loadedAvg - idleAvg) : null;

		const available = deltaMs != null || nq != null;
		if (!available) {
			return {
				id: "perf.bufferbloat",
				available: false,
				source: "ping+download",
				metrics: {},
				error: "no-samples",
			};
		}

		const source = nq ? "networkQuality+ping" : "ping+download";
		return {
			id: "perf.bufferbloat",
			available: true,
			source,
			metrics: {
				idleAvgMs: idleAvg,
				loadedAvgMs: loadedAvg,
				deltaMs: deltaMs != null ? Number(deltaMs.toFixed(2)) : null,
				loadedLossPct: loaded.lossPct,
				downloadMbps: download ? Number(download.mbps.toFixed(2)) : (nq?.downloadMbps ?? null),
				rpm: nq?.rpm ?? null,
				nqDownloadMbps: nq?.downloadMbps ?? null,
				nqUploadMbps: nq?.uploadMbps ?? null,
			},
		};
	} catch (error) {
		return {
			id: "perf.bufferbloat",
			available: false,
			source: "ping+download",
			metrics: {},
			error: asErrorMessage(error),
		};
	}
}
