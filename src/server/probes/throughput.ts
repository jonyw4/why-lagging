import type { ProbeMetrics } from "../../shared/types.ts";
import { asErrorMessage } from "./exec.ts";

const PRIMARY_URL = "https://speed.cloudflare.com/__down?bytes=2000000";
const FALLBACK_URL = "https://cloudflare.com/cdn-cgi/trace";
const DEFAULT_TIMEOUT_MS = 12_000;

export interface DownloadResult {
	bytes: number;
	elapsedMs: number;
	mbps: number;
	url: string;
	confidence: "high" | "low";
}

function mbpsFrom(bytes: number, elapsedMs: number): number {
	if (elapsedMs <= 0) return 0;
	return (bytes * 8) / (elapsedMs / 1000) / 1_000_000;
}

export async function downloadUrl(
	url: string,
	timeoutMs: number,
	confidence: "high" | "low",
): Promise<DownloadResult> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const started = performance.now();
	try {
		const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const buffer = await response.arrayBuffer();
		const elapsedMs = performance.now() - started;
		const bytes = buffer.byteLength;
		return {
			bytes,
			elapsedMs,
			mbps: mbpsFrom(bytes, elapsedMs),
			url,
			confidence,
		};
	} finally {
		clearTimeout(timer);
	}
}

export async function downloadBytes(
	bytes: number,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<DownloadResult | null> {
	const url = `https://speed.cloudflare.com/__down?bytes=${bytes}`;
	try {
		return await downloadUrl(url, timeoutMs, "high");
	} catch {
		return null;
	}
}

export async function measureThroughput(): Promise<DownloadResult | null> {
	try {
		return await downloadUrl(PRIMARY_URL, DEFAULT_TIMEOUT_MS, "high");
	} catch {
		try {
			return await downloadUrl(FALLBACK_URL, 5000, "low");
		} catch {
			return null;
		}
	}
}

export async function probeThroughput(): Promise<ProbeMetrics> {
	try {
		const result = await measureThroughput();
		if (!result) {
			return {
				id: "perf.throughput",
				available: false,
				source: "fetch",
				metrics: {},
				error: "download-failed",
			};
		}
		return {
			id: "perf.throughput",
			available: true,
			source: result.confidence === "low" ? "fetch-fallback" : "fetch",
			metrics: {
				mbps: Number(result.mbps.toFixed(2)),
				bytes: result.bytes,
				elapsedMs: Number(result.elapsedMs.toFixed(1)),
				confidence: result.confidence,
				url: result.url,
			},
		};
	} catch (error) {
		return {
			id: "perf.throughput",
			available: false,
			source: "fetch",
			metrics: {},
			error: asErrorMessage(error),
		};
	}
}
