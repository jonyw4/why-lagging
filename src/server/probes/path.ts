import type { ProbeMetrics } from "../../shared/types.ts";
import { asErrorMessage, commandExists, runCommand } from "./exec.ts";

export interface TracerouteHop {
	ttl: number;
	ip: string | null;
	rttMs: number | null;
}

const HOP_RE = /^\s*(\d+)\s+(\S+)(?:\s+([\d.]+)\s*ms)?/;

export function parseTraceroute(stdout: string): TracerouteHop[] {
	const hops: TracerouteHop[] = [];
	for (const raw of stdout.split("\n")) {
		const line = raw.trim();
		if (!line || line.toLowerCase().startsWith("traceroute")) continue;
		const star = /^\s*(\d+)\s+\*/.exec(line);
		if (star) {
			hops.push({ ttl: Number(star[1]), ip: null, rttMs: null });
			continue;
		}
		const match = HOP_RE.exec(line);
		if (!match) continue;
		const ip = match[2] === "*" ? null : match[2];
		const rttMs = match[3] != null ? Number(match[3]) : null;
		hops.push({
			ttl: Number(match[1]),
			ip: ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip : ip,
			rttMs,
		});
	}
	return hops;
}

export async function probePath(): Promise<ProbeMetrics> {
	try {
		const exists = await commandExists("traceroute");
		if (!exists) {
			return {
				id: "isp.path",
				available: false,
				source: "traceroute",
				metrics: {},
				error: "missing-traceroute",
			};
		}

		const result = await runCommand(
			"traceroute",
			["-n", "-w", "1", "-q", "1", "-m", "8", "1.1.1.1"],
			{ timeoutMs: 10_000 },
		);
		const hops = parseTraceroute(result.stdout || result.stderr);
		if (hops.length === 0) {
			return {
				id: "isp.path",
				available: false,
				source: "traceroute",
				metrics: {},
				error: result.timedOut ? "timeout" : "no-hops",
			};
		}

		const reached = hops.some((h) => h.ip === "1.1.1.1");
		return {
			id: "isp.path",
			available: true,
			source: "traceroute",
			metrics: {
				hopCount: hops.length,
				reached: reached ? 1 : 0,
				hops: hops
					.map((h) => `${h.ttl}:${h.ip ?? "*"}:${h.rttMs ?? "-"}`)
					.join(" | "),
			},
		};
	} catch (error) {
		return {
			id: "isp.path",
			available: false,
			source: "traceroute",
			metrics: {},
			error: asErrorMessage(error),
		};
	}
}
