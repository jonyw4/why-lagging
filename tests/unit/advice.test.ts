import { describe, expect, it } from "vitest";
import { findingsFromProbes } from "../../src/server/analysis/advice.ts";
import type { ProbeMetrics } from "../../src/shared/types.ts";

function probe(
	id: string,
	metrics: Record<string, number | string | null>,
	available = true,
): ProbeMetrics {
	return { id, available, source: "test", metrics };
}

function finding(id: string, probes: ProbeMetrics[]) {
	const match = findingsFromProbes(probes).find((item) => item.id === id);
	if (!match) throw new Error(`missing finding ${id}`);
	return match;
}

function blob(item: { summary: string; tips: string[]; title: string }): string {
	return `${item.title} ${item.summary} ${item.tips.join(" ")}`;
}

describe("findingsFromProbes", () => {
	it("S3: DNS lento vs 1.1.1.1 sugere trocar o resolvedor no roteador", () => {
		const dns = finding("dns.resolution", [
			probe("dns.resolution", { systemMs: 180, cloudflareMs: 18, googleMs: 22 }),
		]);
		expect(dns.severity).toMatch(/warn|bad/);
		expect(blob(dns)).toMatch(/1\.1\.1\.1/);
		expect(blob(dns)).toMatch(/8\.8\.8\.8/);
		expect(blob(dns)).toMatch(/roteador/i);
		expect(blob(dns)).not.toMatch(/aplicamos a mudança|aplicado automaticamente/);
	});

	it("S4: loss no gateway aponta Wi-Fi/cabo, não ISP", () => {
		const gateway = finding("perf.gateway", [
			probe("perf.gateway", { lossPct: 12, avgMs: 8, stddevMs: 2, host: "192.168.1.1" }),
			probe("perf.external", { lossPct: 0, avgMs: 20, stddevMs: 2 }),
		]);
		expect(gateway.severity).toBe("bad");
		expect(blob(gateway)).toMatch(/local|Wi-Fi|cabo/i);
		expect(blob(gateway)).toMatch(/não do provedor|não ISP|não do ISP/i);
	});

	it("S5: gateway ok + externo ruim aponta ISP/caminho", () => {
		const external = finding("perf.external", [
			probe("perf.gateway", { lossPct: 0, avgMs: 5, stddevMs: 1, host: "192.168.1.1" }),
			probe("perf.external", { lossPct: 8, avgMs: 120, stddevMs: 40 }),
		]);
		expect(external.severity).toMatch(/warn|bad/);
		expect(blob(external)).toMatch(/ISP|provedor|caminho/i);
	});

	it("APIPA: DHCP falhou e pede reinício do roteador", () => {
		const config = finding("config.addressing", [
			probe("config.addressing", {
				ipv4: "169.254.12.34",
				gateway: null,
				apipa: 1,
				dnsServers: null,
			}),
		]);
		expect(config.severity).toBe("bad");
		expect(blob(config)).toMatch(/DHCP/i);
		expect(blob(config)).toMatch(/roteador/i);
		expect(blob(config)).toMatch(/169\.254/);
	});

	it("sem gateway sugere checar DHCP/cabo", () => {
		const config = finding("config.addressing", [
			probe("config.addressing", { ipv4: "192.168.1.10", gateway: null, apipa: 0 }),
		]);
		expect(config.severity).toBe("bad");
		expect(blob(config)).toMatch(/DHCP|cabo/i);
	});

	it("bufferbloat Δ > 100 recomenda SQM/QoS e upload a 90%", () => {
		const bloat = finding("perf.bufferbloat", [
			probe("perf.bufferbloat", { deltaMs: 180, idleAvgMs: 12, loadedAvgMs: 192 }),
		]);
		expect(bloat.severity).toBe("bad");
		expect(blob(bloat)).toMatch(/SQM|QoS/i);
		expect(blob(bloat)).toMatch(/90%/);
	});

	it("RSSI < -70 recomenda aproximar do AP e 5 GHz", () => {
		const wifi = finding("wifi.signal", [
			probe("wifi.signal", { rssiDbm: -82, noiseDbm: -95, snrDb: 13 }),
		]);
		expect(wifi.severity).toBe("bad");
		expect(blob(wifi)).toMatch(/Aproxime|ponto de acesso/i);
		expect(blob(wifi)).toMatch(/5 GHz/);
	});

	it("jitter > 30 avisa sobre calls/games", () => {
		const gateway = finding("perf.gateway", [
			probe("perf.gateway", { lossPct: 0, avgMs: 8, stddevMs: 42 }),
		]);
		expect(blob(gateway)).toMatch(/chamadas|jogos/i);
	});

	it("emits unknown findings when probes are missing", () => {
		const report = findingsFromProbes([]);
		expect(report).toHaveLength(8);
		expect(report.every((item) => item.severity === "unknown")).toBe(true);
	});

	it("100% loss no gateway com internet ok é ICMP filtrado, não Wi-Fi", () => {
		const gateway = finding("perf.gateway", [
			probe("config.addressing", { ipv4: "172.30.0.2", gateway: "172.30.0.1", apipa: 0 }),
			probe("perf.gateway", { lossPct: 100, avgMs: null, host: "172.30.0.1" }),
			probe("perf.external", { lossPct: 0, avgMs: 8, stddevMs: 1 }),
			probe("perf.throughput", { mbps: 200, confidence: "high" }),
		]);
		expect(gateway.severity).toBe("warn");
		expect(blob(gateway)).toMatch(/ICMP filtrado/i);
		expect(blob(gateway)).not.toMatch(/Aproxime-se do roteador/);
	});
});
