import type { PingStats, ProbeMetrics } from "../../shared/types.ts";
import { asErrorMessage, runCommand } from "./exec.ts";

const EMPTY: PingStats = {
	sent: 0,
	lost: 0,
	lossPct: 0,
	minMs: null,
	avgMs: null,
	maxMs: null,
	stddevMs: null,
};

const TRANSMITTED_RE =
	/(\d+)\s+packets transmitted,\s+(\d+)\s+(?:packets\s+)?received,\s+([\d.]+)\s*%\s+packet loss/i;

const RTT_RE =
	/(?:rtt|round-trip)\s+min\/avg\/max\/(?:mdev|stddev)\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/i;

export function parsePingStdout(stdout: string): PingStats {
	const transmitted = TRANSMITTED_RE.exec(stdout);
	const rtt = RTT_RE.exec(stdout);

	if (!transmitted && !rtt) {
		return { ...EMPTY };
	}

	const sent = transmitted ? Number(transmitted[1]) : 0;
	const received = transmitted ? Number(transmitted[2]) : 0;
	const lossPct = transmitted ? Number(transmitted[3]) : sent > 0 ? 100 : 0;
	const lost = transmitted ? Math.max(0, sent - received) : 0;

	return {
		sent,
		lost,
		lossPct,
		minMs: rtt ? Number(rtt[1]) : null,
		avgMs: rtt ? Number(rtt[2]) : null,
		maxMs: rtt ? Number(rtt[3]) : null,
		stddevMs: rtt ? Number(rtt[4]) : null,
	};
}

export function emptyPingStats(sent = 0): PingStats {
	return {
		sent,
		lost: sent,
		lossPct: sent > 0 ? 100 : 0,
		minMs: null,
		avgMs: null,
		maxMs: null,
		stddevMs: null,
	};
}

export async function pingStats(
	host: string,
	count = 8,
	timeoutMs = 8000,
	signal?: AbortSignal,
): Promise<PingStats> {
	try {
		const result = await runCommand("ping", ["-c", String(count), "-i", "0.2", host], {
			timeoutMs,
			signal,
		});
		const text = `${result.stdout}\n${result.stderr}`;
		const parsed = parsePingStdout(text);
		if (parsed.sent === 0) {
			return emptyPingStats(count);
		}
		return parsed;
	} catch {
		return emptyPingStats(count);
	}
}

export async function pingOnce(
	host: string,
	signal?: AbortSignal,
): Promise<{ rttMs: number | null; ok: boolean }> {
	try {
		const stats = await pingStats(host, 1, 2000, signal);
		const ok = stats.lost === 0 && stats.avgMs != null;
		return { rttMs: stats.avgMs, ok };
	} catch {
		return { rttMs: null, ok: false };
	}
}

function statsToMetrics(host: string, stats: PingStats): Record<string, number | string | null> {
	return {
		host,
		sent: stats.sent,
		lost: stats.lost,
		lossPct: stats.lossPct,
		minMs: stats.minMs,
		avgMs: stats.avgMs,
		maxMs: stats.maxMs,
		stddevMs: stats.stddevMs,
	};
}

export async function probeGateway(gateway: string | null): Promise<ProbeMetrics> {
	if (!gateway) {
		return {
			id: "perf.gateway",
			available: false,
			source: "ping",
			metrics: { host: null, lossPct: null, avgMs: null, stddevMs: null },
			error: "no-gateway",
		};
	}
	try {
		const stats = await pingStats(gateway, 8, 8000);
		return {
			id: "perf.gateway",
			available: stats.sent > 0,
			source: "ping",
			metrics: statsToMetrics(gateway, stats),
		};
	} catch (error) {
		return {
			id: "perf.gateway",
			available: false,
			source: "ping",
			metrics: { host: gateway },
			error: asErrorMessage(error),
		};
	}
}

export async function probeExternal(): Promise<ProbeMetrics> {
	try {
		const [cloudflare, google] = await Promise.all([
			pingStats("1.1.1.1", 8, 8000),
			pingStats("8.8.8.8", 8, 8000),
		]);
		const lossPct = Math.max(cloudflare.lossPct, google.lossPct);
		const avgs = [cloudflare.avgMs, google.avgMs].filter((v): v is number => v != null);
		const jitters = [cloudflare.stddevMs, google.stddevMs].filter((v): v is number => v != null);
		return {
			id: "perf.external",
			available: cloudflare.sent > 0 || google.sent > 0,
			source: "ping",
			metrics: {
				host: "1.1.1.1,8.8.8.8",
				lossPct,
				avgMs: avgs.length ? Math.max(...avgs) : null,
				stddevMs: jitters.length ? Math.max(...jitters) : null,
				cfLossPct: cloudflare.lossPct,
				cfAvgMs: cloudflare.avgMs,
				cfStddevMs: cloudflare.stddevMs,
				googleLossPct: google.lossPct,
				googleAvgMs: google.avgMs,
				googleStddevMs: google.stddevMs,
			},
		};
	} catch (error) {
		return {
			id: "perf.external",
			available: false,
			source: "ping",
			metrics: {},
			error: asErrorMessage(error),
		};
	}
}
