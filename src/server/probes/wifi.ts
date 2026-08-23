import type { ProbeMetrics } from "../../shared/types.ts";
import { asErrorMessage, commandExists, fileExecutable, runCommand } from "./exec.ts";

export const AIRPORT_PATHS = [
	"/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport",
	"/System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport",
];

export async function findAirport(): Promise<string | null> {
	if (typeof Bun !== "undefined" && typeof Bun.which === "function") {
		const which = Bun.which("airport");
		if (which) return which;
	}
	for (const path of AIRPORT_PATHS) {
		if (await fileExecutable(path)) return path;
	}
	return null;
}

export function parseAirport(text: string): { rssiDbm: number | null; noiseDbm: number | null } {
	const rssi = /agrCtlRSSI:\s*(-?\d+)/.exec(text);
	const noise = /agrCtlNoise:\s*(-?\d+)/.exec(text);
	return {
		rssiDbm: rssi ? Number(rssi[1]) : null,
		noiseDbm: noise ? Number(noise[1]) : null,
	};
}

export function parseWdutil(text: string): { rssiDbm: number | null; noiseDbm: number | null } {
	const rssi = /^\s*RSSI\s*:\s*(-?\d+)/im.exec(text);
	const noise = /^\s*Noise\s*:\s*(-?\d+)/im.exec(text);
	return {
		rssiDbm: rssi ? Number(rssi[1]) : null,
		noiseDbm: noise ? Number(noise[1]) : null,
	};
}

async function readDarwinWifi(): Promise<{
	rssiDbm: number | null;
	noiseDbm: number | null;
	source: string;
} | null> {
	const airport = await findAirport();
	if (airport) {
		const result = await runCommand(airport, ["-I"], { timeoutMs: 4000 });
		const parsed = parseAirport(result.stdout || result.stderr);
		if (parsed.rssiDbm != null) {
			return { ...parsed, source: "airport" };
		}
	}

	if (await commandExists("wdutil")) {
		const result = await runCommand("wdutil", ["info"], { timeoutMs: 5000 });
		const parsed = parseWdutil(result.stdout || result.stderr);
		if (parsed.rssiDbm != null || parsed.noiseDbm != null) {
			return { ...parsed, source: "wdutil" };
		}
	}

	return null;
}

export async function probeWifi(): Promise<ProbeMetrics> {
	if (process.platform !== "darwin") {
		return {
			id: "wifi.signal",
			available: false,
			source: "unavailable",
			metrics: {},
			error: "darwin-only",
		};
	}

	try {
		const reading = await readDarwinWifi();
		if (!reading) {
			return {
				id: "wifi.signal",
				available: false,
				source: "airport|wdutil",
				metrics: {},
				error: "no-wifi-data",
			};
		}
		const snrDb =
			reading.rssiDbm != null && reading.noiseDbm != null
				? reading.rssiDbm - reading.noiseDbm
				: null;
		return {
			id: "wifi.signal",
			available: true,
			source: reading.source,
			metrics: {
				rssiDbm: reading.rssiDbm,
				noiseDbm: reading.noiseDbm,
				snrDb,
			},
		};
	} catch (error) {
		return {
			id: "wifi.signal",
			available: false,
			source: "airport|wdutil",
			metrics: {},
			error: asErrorMessage(error),
		};
	}
}
