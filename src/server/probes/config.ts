import { networkInterfaces } from "node:os";
import { readFile } from "node:fs/promises";
import type { ProbeMetrics } from "../../shared/types.ts";
import { asErrorMessage, runCommand } from "./exec.ts";

export interface LocalConfig {
	ipv4: string | null;
	iface: string | null;
	gateway: string | null;
	dnsServers: string[];
	apipa: boolean;
}

export function isApipa(ip: string): boolean {
	return ip.startsWith("169.254.");
}

export function pickIpv4(): { address: string; iface: string } | null {
	const ifaces = networkInterfaces();
	for (const [name, addrs] of Object.entries(ifaces)) {
		for (const addr of addrs ?? []) {
			const family = addr.family as string | number;
			if ((family === "IPv4" || family === 4) && !addr.internal) {
				return { address: addr.address, iface: name };
			}
		}
	}
	return null;
}

export function parseLinuxDefaultRoute(text: string): string | null {
	for (const line of text.split("\n")) {
		if (!/\bdefault\b/.test(line) && !line.startsWith("0.0.0.0")) continue;
		const via = /\bvia\s+(\d+\.\d+\.\d+\.\d+)/.exec(line);
		if (via) return via[1];
		const gw = /\bgateway\s+(\d+\.\d+\.\d+\.\d+)/.exec(line);
		if (gw) return gw[1];
	}
	return null;
}

export function parseDarwinRoute(text: string): string | null {
	const match = /^\s*gateway:\s+(\S+)/im.exec(text);
	if (!match) return null;
	const value = match[1];
	if (/^\d+\.\d+\.\d+\.\d+$/.test(value)) return value;
	return value || null;
}

export function parseResolvConf(text: string): string[] {
	const servers: string[] = [];
	for (const line of text.split("\n")) {
		const match = /^\s*nameserver\s+(\S+)/.exec(line);
		if (match && !servers.includes(match[1])) servers.push(match[1]);
	}
	return servers;
}

export function parseScutilDns(text: string): string[] {
	const servers: string[] = [];
	for (const line of text.split("\n")) {
		const match = /nameserver\[\d+\]\s*:\s*(\S+)/.exec(line);
		if (match && !servers.includes(match[1])) servers.push(match[1]);
	}
	return servers;
}

async function detectGateway(): Promise<string | null> {
	if (process.platform === "linux") {
		const primary = await runCommand("ip", ["route", "show", "default"], { timeoutMs: 3000 });
		const parsed = parseLinuxDefaultRoute(primary.stdout);
		if (parsed) return parsed;
		const fallback = await runCommand("ip", ["route"], { timeoutMs: 3000 });
		return parseLinuxDefaultRoute(fallback.stdout);
	}

	if (process.platform === "darwin") {
		const primary = await runCommand("route", ["-n", "get", "default"], { timeoutMs: 3000 });
		const parsed = parseDarwinRoute(primary.stdout);
		if (parsed) return parsed;
		const fallback = await runCommand("ip", ["route"], { timeoutMs: 3000 });
		return parseLinuxDefaultRoute(fallback.stdout);
	}

	const fallback = await runCommand("ip", ["route"], { timeoutMs: 3000 });
	return parseLinuxDefaultRoute(`${fallback.stdout}\n${fallback.stderr}`);
}

async function detectDnsServers(): Promise<string[]> {
	if (process.platform === "darwin") {
		const scutil = await runCommand("scutil", ["--dns"], { timeoutMs: 4000 });
		const fromScutil = parseScutilDns(scutil.stdout);
		if (fromScutil.length > 0) return fromScutil;
	}
	try {
		const text = await readFile("/etc/resolv.conf", "utf8");
		return parseResolvConf(text);
	} catch {
		return [];
	}
}

export async function readLocalConfig(): Promise<LocalConfig> {
	const ipv4 = pickIpv4();
	const [gateway, dnsServers] = await Promise.all([detectGateway(), detectDnsServers()]);
	const address = ipv4?.address ?? null;
	return {
		ipv4: address,
		iface: ipv4?.iface ?? null,
		gateway,
		dnsServers,
		apipa: address ? isApipa(address) : false,
	};
}

export async function probeConfig(): Promise<ProbeMetrics> {
	try {
		const config = await readLocalConfig();
		return {
			id: "config.addressing",
			available: true,
			source: "os.networkInterfaces",
			metrics: {
				ipv4: config.ipv4,
				iface: config.iface,
				gateway: config.gateway,
				dnsServers: config.dnsServers.join(", ") || null,
				apipa: config.apipa ? 1 : 0,
			},
		};
	} catch (error) {
		return {
			id: "config.addressing",
			available: false,
			source: "os.networkInterfaces",
			metrics: {},
			error: asErrorMessage(error),
		};
	}
}
