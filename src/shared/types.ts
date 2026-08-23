export type Severity = "good" | "warn" | "bad" | "unknown";

export type Category = "wifi" | "dns" | "isp" | "perf" | "config" | "hw";

export interface Finding {
	id: string;
	category: Category;
	title: string;
	severity: Severity;
	summary: string;
	metrics: Record<string, number | string | null>;
	tips: string[];
}

export interface DiagnosticReport {
	id: string;
	startedAt: string;
	finishedAt: string;
	platform: string;
	overall: { score: number; label: string; summary: string };
	findings: Finding[];
	capabilities: string[];
}

export interface ProbeCapability {
	id: string;
	available: boolean;
	source: string;
}

export interface CapabilitiesResponse {
	platform: NodeJS.Platform;
	probes: ProbeCapability[];
}

export interface MonitorSample {
	at: string;
	gateway: { rttMs: number | null; ok: boolean };
	external: { rttMs: number | null; ok: boolean };
	wifi: { rssiDbm: number | null; noiseDbm: number | null } | null;
}

export interface ProbeMetrics {
	id: string;
	available: boolean;
	source: string;
	metrics: Record<string, number | string | null>;
	error?: string;
}

export interface PingStats {
	sent: number;
	lost: number;
	lossPct: number;
	minMs: number | null;
	avgMs: number | null;
	maxMs: number | null;
	stddevMs: number | null;
}
