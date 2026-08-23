import type { DiagnosticReport, ProbeMetrics } from "../shared/types.ts";
import { findingsFromProbes } from "./analysis/advice.ts";
import { scoreFindings } from "./analysis/score.ts";
import { getCapabilities } from "./capabilities.ts";
import { probeBufferbloat } from "./probes/bufferbloat.ts";
import { probeConfig, readLocalConfig } from "./probes/config.ts";
import { probeDns } from "./probes/dns.ts";
import { asErrorMessage } from "./probes/exec.ts";
import { probeExternal, probeGateway } from "./probes/ping.ts";
import { probePath } from "./probes/path.ts";
import { probeThroughput } from "./probes/throughput.ts";
import { probeWifi } from "./probes/wifi.ts";

const PROBE_IDS = [
	"config.addressing",
	"perf.gateway",
	"perf.external",
	"dns.resolution",
	"perf.throughput",
	"perf.bufferbloat",
	"isp.path",
	"wifi.signal",
] as const;

function failedProbe(id: string, error: unknown): ProbeMetrics {
	return {
		id,
		available: false,
		source: "error",
		metrics: {},
		error: asErrorMessage(error),
	};
}

async function safeProbe(id: string, run: () => Promise<ProbeMetrics>): Promise<ProbeMetrics> {
	try {
		return await run();
	} catch (error) {
		return failedProbe(id, error);
	}
}

export async function diagnose(): Promise<DiagnosticReport> {
	const startedAt = new Date().toISOString();

	let gateway: string | null = null;
	try {
		gateway = (await readLocalConfig()).gateway;
	} catch {
		gateway = null;
	}

	const jobs: Array<() => Promise<ProbeMetrics>> = [
		() => safeProbe("config.addressing", probeConfig),
		() => safeProbe("perf.gateway", () => probeGateway(gateway)),
		() => safeProbe("perf.external", probeExternal),
		() => safeProbe("dns.resolution", probeDns),
		() => safeProbe("perf.throughput", probeThroughput),
		() => safeProbe("perf.bufferbloat", probeBufferbloat),
		() => safeProbe("isp.path", probePath),
		() => safeProbe("wifi.signal", probeWifi),
	];

	const settled = await Promise.allSettled(jobs.map((job) => job()));
	const probes: ProbeMetrics[] = settled.map((result, index) => {
		if (result.status === "fulfilled") return result.value;
		return failedProbe(PROBE_IDS[index], result.reason);
	});

	const findings = findingsFromProbes(probes);
	const overall = scoreFindings(findings);
	const capabilities = await getCapabilities();

	return {
		id: crypto.randomUUID(),
		startedAt,
		finishedAt: new Date().toISOString(),
		platform: process.platform,
		overall,
		findings,
		capabilities: capabilities.probes.filter((probe) => probe.available).map((probe) => probe.id),
	};
}
