import type { CapabilitiesResponse, ProbeCapability } from "../shared/types.ts";
import { commandExists } from "./probes/exec.ts";
import { findAirport } from "./probes/wifi.ts";

export async function getCapabilities(): Promise<CapabilitiesResponse> {
	const platform = process.platform;
	const [ping, traceroute, networkQuality, airport, wdutil] = await Promise.all([
		commandExists("ping"),
		commandExists("traceroute"),
		platform === "darwin" ? commandExists("networkQuality") : Promise.resolve(false),
		platform === "darwin" ? findAirport().then((path) => path !== null) : Promise.resolve(false),
		platform === "darwin" ? commandExists("wdutil") : Promise.resolve(false),
	]);

	const probes: ProbeCapability[] = [
		{ id: "config.addressing", available: true, source: "os.networkInterfaces" },
		{ id: "perf.gateway", available: ping, source: "ping" },
		{ id: "perf.external", available: ping, source: "ping" },
		{ id: "dns.resolution", available: true, source: "dns.promises" },
		{ id: "perf.throughput", available: true, source: "fetch" },
		{
			id: "perf.bufferbloat",
			available: ping,
			source: networkQuality ? "networkQuality+ping" : "ping+download",
		},
		{ id: "isp.path", available: traceroute, source: "traceroute" },
		{
			id: "wifi.signal",
			available: airport || wdutil,
			source: airport ? "airport" : wdutil ? "wdutil" : "unavailable",
		},
	];

	return { platform, probes };
}
