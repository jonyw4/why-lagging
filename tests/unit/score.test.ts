import { describe, expect, it } from "vitest";
import { scoreFindings, severityToScore } from "../../src/server/analysis/score.ts";
import type { Finding } from "../../src/shared/types.ts";

function finding(
	partial: Pick<Finding, "id" | "category" | "severity"> & Partial<Finding>,
): Finding {
	return {
		title: partial.id,
		summary: "",
		metrics: {},
		tips: [],
		...partial,
	};
}

const ALL_GOOD: Finding[] = [
	finding({ id: "config.addressing", category: "config", severity: "good" }),
	finding({ id: "perf.gateway", category: "perf", severity: "good" }),
	finding({ id: "perf.external", category: "perf", severity: "good" }),
	finding({ id: "dns.resolution", category: "dns", severity: "good" }),
	finding({ id: "isp.path", category: "isp", severity: "good" }),
	finding({ id: "wifi.signal", category: "wifi", severity: "good" }),
];

const ALL_BAD: Finding[] = ALL_GOOD.map((item) => ({ ...item, severity: "bad" as const }));

describe("severityToScore", () => {
	it("ignores unknown", () => {
		expect(severityToScore("unknown")).toBeNull();
	});

	it("maps known severities", () => {
		expect(severityToScore("good")).toBe(100);
		expect(severityToScore("warn")).toBe(60);
		expect(severityToScore("bad")).toBe(20);
	});
});

describe("scoreFindings", () => {
	it("scores all-good findings as Excelente", () => {
		const overall = scoreFindings(ALL_GOOD);
		expect(overall.score).toBeGreaterThanOrEqual(85);
		expect(overall.label).toBe("Excelente");
	});

	it("scores all-bad findings as Ruim", () => {
		const overall = scoreFindings(ALL_BAD);
		expect(overall.score).toBeLessThan(45);
		expect(overall.label).toBe("Ruim");
	});

	it("does not let unknown findings pull the score down", () => {
		const mixed: Finding[] = [
			...ALL_GOOD.filter((item) => item.category !== "wifi" && item.category !== "isp"),
			finding({ id: "wifi.signal", category: "wifi", severity: "unknown" }),
			finding({ id: "isp.path", category: "isp", severity: "unknown" }),
		];
		const withUnknown = scoreFindings(mixed);
		const withoutUnknown = scoreFindings(
			ALL_GOOD.filter((item) => item.category !== "wifi" && item.category !== "isp"),
		);
		expect(withUnknown.score).toBe(withoutUnknown.score);
		expect(withUnknown.score).toBeGreaterThanOrEqual(85);
	});

	it("returns a high vacuous score when everything is unknown", () => {
		const overall = scoreFindings(
			ALL_GOOD.map((item) => ({ ...item, severity: "unknown" as const })),
		);
		expect(overall.score).toBe(100);
	});

	it("caps Excelente when any finding is bad", () => {
		const mixed = [
			...ALL_GOOD.slice(0, -1),
			finding({ id: "perf.gateway", category: "perf", severity: "bad" }),
		];
		const overall = scoreFindings(mixed);
		expect(overall.score).toBeLessThanOrEqual(69);
		expect(overall.label).not.toBe("Excelente");
		expect(overall.label).not.toBe("Boa");
	});
});
