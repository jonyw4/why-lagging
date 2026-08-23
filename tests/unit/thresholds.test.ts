import { describe, expect, it } from "vitest";
import {
	classifyBufferbloat,
	classifyDns,
	classifyHigherIsBetter,
	classifyJitter,
	classifyLossExternal,
	classifyLossGateway,
	classifyLowerIsBetter,
	classifyRpm,
	classifyRssi,
	classifyRttExternal,
	classifyRttGateway,
	classifySnr,
	classifyThroughput,
	worstSeverity,
} from "../../src/server/analysis/thresholds.ts";

describe("classifyLowerIsBetter", () => {
	it("marks values below the good bound as good", () => {
		expect(classifyLowerIsBetter(9.9, 10, 50)).toBe("good");
	});

	it("marks the inclusive warn range", () => {
		expect(classifyLowerIsBetter(10, 10, 50)).toBe("warn");
		expect(classifyLowerIsBetter(50, 10, 50)).toBe("warn");
	});

	it("marks values above the warn bound as bad", () => {
		expect(classifyLowerIsBetter(50.1, 10, 50)).toBe("bad");
	});
});

describe("classifyHigherIsBetter", () => {
	it("marks values above the good bound as good", () => {
		expect(classifyHigherIsBetter(-59, -60, -70)).toBe("good");
	});

	it("marks the inclusive warn range", () => {
		expect(classifyHigherIsBetter(-60, -60, -70)).toBe("warn");
		expect(classifyHigherIsBetter(-70, -60, -70)).toBe("warn");
	});

	it("marks values below the warn bound as bad", () => {
		expect(classifyHigherIsBetter(-71, -60, -70)).toBe("bad");
	});
});

describe("RFC-002 metric helpers", () => {
	it("classifies gateway RTT", () => {
		expect(classifyRttGateway(4)).toBe("good");
		expect(classifyRttGateway(25)).toBe("warn");
		expect(classifyRttGateway(80)).toBe("bad");
	});

	it("treats any gateway loss as bad", () => {
		expect(classifyLossGateway(0)).toBe("good");
		expect(classifyLossGateway(0.1)).toBe("bad");
	});

	it("classifies external RTT and loss", () => {
		expect(classifyRttExternal(20)).toBe("good");
		expect(classifyRttExternal(50)).toBe("warn");
		expect(classifyRttExternal(90)).toBe("bad");
		expect(classifyLossExternal(0.5)).toBe("good");
		expect(classifyLossExternal(1.5)).toBe("warn");
		expect(classifyLossExternal(3)).toBe("bad");
	});

	it("classifies jitter, DNS, RSSI, SNR, bufferbloat and RPM", () => {
		expect(classifyJitter(2)).toBe("good");
		expect(classifyJitter(12)).toBe("warn");
		expect(classifyJitter(40)).toBe("bad");
		expect(classifyDns(20)).toBe("good");
		expect(classifyDns(60)).toBe("warn");
		expect(classifyDns(140)).toBe("bad");
		expect(classifyRssi(-40)).toBe("good");
		expect(classifyRssi(-65)).toBe("warn");
		expect(classifyRssi(-80)).toBe("bad");
		expect(classifySnr(30)).toBe("good");
		expect(classifySnr(20)).toBe("warn");
		expect(classifySnr(10)).toBe("bad");
		expect(classifyBufferbloat(10)).toBe("good");
		expect(classifyBufferbloat(50)).toBe("warn");
		expect(classifyBufferbloat(150)).toBe("bad");
		expect(classifyRpm(1400)).toBe("good");
		expect(classifyRpm(400)).toBe("warn");
		expect(classifyRpm(80)).toBe("bad");
		expect(classifyThroughput(80)).toBe("good");
		expect(classifyThroughput(20)).toBe("warn");
		expect(classifyThroughput(5)).toBe("bad");
	});

	it("picks the worst known severity", () => {
		expect(worstSeverity("good", "warn", "unknown")).toBe("warn");
		expect(worstSeverity("good", "bad")).toBe("bad");
		expect(worstSeverity("unknown", "unknown")).toBe("unknown");
	});
});
