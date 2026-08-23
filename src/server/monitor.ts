import type { MonitorSample } from "../shared/types.ts";
import { readLocalConfig } from "./probes/config.ts";
import { sleep } from "./probes/exec.ts";
import { pingOnce } from "./probes/ping.ts";
import { probeWifi } from "./probes/wifi.ts";

function metricNumber(
	metrics: Record<string, number | string | null>,
	key: string,
): number | null {
	const value = metrics[key];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function sampleWifi(): Promise<MonitorSample["wifi"]> {
	if (process.platform !== "darwin") return null;
	try {
		const probe = await probeWifi();
		if (!probe.available) return null;
		return {
			rssiDbm: metricNumber(probe.metrics, "rssiDbm"),
			noiseDbm: metricNumber(probe.metrics, "noiseDbm"),
		};
	} catch {
		return null;
	}
}

export async function collectMonitorSample(signal?: AbortSignal): Promise<MonitorSample> {
	let gatewayHost: string | null = null;
	try {
		gatewayHost = (await readLocalConfig()).gateway;
	} catch {
		gatewayHost = null;
	}

	const [gateway, external, wifi] = await Promise.all([
		gatewayHost ? pingOnce(gatewayHost, signal) : Promise.resolve({ rttMs: null, ok: false }),
		pingOnce("1.1.1.1", signal),
		sampleWifi(),
	]);

	return {
		at: new Date().toISOString(),
		gateway,
		external,
		wifi,
	};
}

export async function* monitorLoop(signal: AbortSignal): AsyncGenerator<MonitorSample> {
	while (!signal.aborted) {
		const started = Date.now();
		try {
			yield await collectMonitorSample(signal);
		} catch {
			yield {
				at: new Date().toISOString(),
				gateway: { rttMs: null, ok: false },
				external: { rttMs: null, ok: false },
				wifi: null,
			};
		}
		if (signal.aborted) return;
		const wait = Math.max(0, 1000 - (Date.now() - started));
		await sleep(wait, signal);
	}
}
