import type { Severity } from "../../shared/types.ts";

/** Limiares da pesquisa (RFC-002). */
export const THRESHOLDS = {
	gatewayRttGoodMs: 10,
	gatewayRttWarnMs: 50,
	externalRttGoodMs: 30,
	externalRttWarnMs: 80,
	externalLossGoodPct: 1,
	externalLossWarnPct: 2,
	jitterGoodMs: 5,
	jitterWarnMs: 30,
	dnsGoodMs: 30,
	dnsWarnMs: 100,
	rssiGoodDbm: -60,
	rssiWarnDbm: -70,
	snrGoodDb: 25,
	snrWarnDb: 15,
	bufferbloatGoodMs: 30,
	bufferbloatWarnMs: 100,
	rpmGood: 1000,
	rpmWarn: 200,
	throughputGoodMbps: 50,
	throughputWarnMbps: 10,
} as const;

/** Menor é melhor: < goodMax → good; ≤ warnMax → warn; senão bad. */
export function classifyLowerIsBetter(
	value: number,
	goodMax: number,
	warnMax: number,
): Severity {
	if (value < goodMax) return "good";
	if (value <= warnMax) return "warn";
	return "bad";
}

/** Maior é melhor: > goodMin → good; ≥ warnMin → warn; senão bad. */
export function classifyHigherIsBetter(
	value: number,
	goodMin: number,
	warnMin: number,
): Severity {
	if (value > goodMin) return "good";
	if (value >= warnMin) return "warn";
	return "bad";
}

export function classifyRttGateway(ms: number): Severity {
	return classifyLowerIsBetter(ms, THRESHOLDS.gatewayRttGoodMs, THRESHOLDS.gatewayRttWarnMs);
}

export function classifyLossGateway(pct: number): Severity {
	return pct > 0 ? "bad" : "good";
}

export function classifyRttExternal(ms: number): Severity {
	return classifyLowerIsBetter(ms, THRESHOLDS.externalRttGoodMs, THRESHOLDS.externalRttWarnMs);
}

export function classifyLossExternal(pct: number): Severity {
	if (pct <= THRESHOLDS.externalLossGoodPct) return "good";
	if (pct <= THRESHOLDS.externalLossWarnPct) return "warn";
	return "bad";
}

export function classifyJitter(ms: number): Severity {
	return classifyLowerIsBetter(ms, THRESHOLDS.jitterGoodMs, THRESHOLDS.jitterWarnMs);
}

export function classifyDns(ms: number): Severity {
	return classifyLowerIsBetter(ms, THRESHOLDS.dnsGoodMs, THRESHOLDS.dnsWarnMs);
}

export function classifyRssi(dbm: number): Severity {
	return classifyHigherIsBetter(dbm, THRESHOLDS.rssiGoodDbm, THRESHOLDS.rssiWarnDbm);
}

export function classifySnr(db: number): Severity {
	return classifyHigherIsBetter(db, THRESHOLDS.snrGoodDb, THRESHOLDS.snrWarnDb);
}

export function classifyBufferbloat(deltaMs: number): Severity {
	return classifyLowerIsBetter(
		deltaMs,
		THRESHOLDS.bufferbloatGoodMs,
		THRESHOLDS.bufferbloatWarnMs,
	);
}

export function classifyRpm(rpm: number): Severity {
	return classifyHigherIsBetter(rpm, THRESHOLDS.rpmGood, THRESHOLDS.rpmWarn);
}

export function classifyThroughput(mbps: number): Severity {
	return classifyHigherIsBetter(
		mbps,
		THRESHOLDS.throughputGoodMbps,
		THRESHOLDS.throughputWarnMbps,
	);
}

const RANK: Record<Severity, number> = {
	bad: 0,
	warn: 1,
	unknown: 2,
	good: 3,
};

export function worstSeverity(...severities: Severity[]): Severity {
	const known = severities.filter((s) => s !== "unknown");
	if (known.length === 0) return "unknown";
	return known.reduce((worst, next) => (RANK[next] < RANK[worst] ? next : worst));
}
