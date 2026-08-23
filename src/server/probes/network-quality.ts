import type { ProbeMetrics } from "../../shared/types.ts";
import { asErrorMessage, commandExists, runCommand } from "./exec.ts";

export interface NetworkQualityResult {
	rpm: number | null;
	downloadMbps: number | null;
	uploadMbps: number | null;
	raw: Record<string, unknown> | null;
}

function asFiniteNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
		return Number(value);
	}
	return null;
}

function bitsToMbps(bitsPerSecond: number | null): number | null {
	if (bitsPerSecond == null) return null;
	return bitsPerSecond / 1_000_000;
}

export function parseNetworkQualityJson(text: string): NetworkQualityResult {
	const trimmed = text.trim();
	if (!trimmed) {
		return { rpm: null, downloadMbps: null, uploadMbps: null, raw: null };
	}
	let raw: Record<string, unknown>;
	try {
		raw = JSON.parse(trimmed) as Record<string, unknown>;
	} catch {
		return { rpm: null, downloadMbps: null, uploadMbps: null, raw: null };
	}

	const rpm =
		asFiniteNumber(raw.rpm) ??
		asFiniteNumber(raw.responsiveness) ??
		asFiniteNumber(raw.download_responsiveness) ??
		asFiniteNumber(raw.ul_responsiveness);

	const downloadBits =
		asFiniteNumber(raw.dl_throughput) ??
		asFiniteNumber(raw.download_throughput) ??
		asFiniteNumber(raw.dlThroughput);
	const uploadBits =
		asFiniteNumber(raw.ul_throughput) ??
		asFiniteNumber(raw.upload_throughput) ??
		asFiniteNumber(raw.ulThroughput);

	return {
		rpm,
		downloadMbps: bitsToMbps(downloadBits),
		uploadMbps: bitsToMbps(uploadBits),
		raw,
	};
}

export async function runNetworkQuality(): Promise<NetworkQualityResult | null> {
	if (process.platform !== "darwin") return null;
	const exists = await commandExists("networkQuality");
	if (!exists) return null;
	const result = await runCommand("networkQuality", ["-c"], { timeoutMs: 20_000 });
	const parsed = parseNetworkQualityJson(result.stdout || result.stderr);
	if (parsed.rpm == null && parsed.downloadMbps == null) return null;
	return parsed;
}

export async function probeNetworkQuality(): Promise<ProbeMetrics> {
	try {
		const result = await runNetworkQuality();
		if (!result) {
			return {
				id: "perf.networkQuality",
				available: false,
				source: "networkQuality",
				metrics: {},
			};
		}
		return {
			id: "perf.networkQuality",
			available: true,
			source: "networkQuality",
			metrics: {
				rpm: result.rpm,
				downloadMbps: result.downloadMbps,
				uploadMbps: result.uploadMbps,
			},
		};
	} catch (error) {
		return {
			id: "perf.networkQuality",
			available: false,
			source: "networkQuality",
			metrics: {},
			error: asErrorMessage(error),
		};
	}
}
