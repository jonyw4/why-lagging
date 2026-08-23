import type { Category, Severity } from "@shared/types";

const SEVERITY_LABELS: Record<Severity, string> = {
	good: "Bom",
	warn: "Atenção",
	bad: "Ruim",
	unknown: "Indisponível",
};

const CATEGORY_LABELS: Record<Category, string> = {
	wifi: "Wi-Fi",
	dns: "DNS",
	isp: "Provedor",
	perf: "Desempenho",
	config: "Configuração",
	hw: "Hardware",
};

const METRIC_LABELS: Record<string, string> = {
	rttMs: "RTT",
	avgMs: "Média",
	minMs: "Mín.",
	maxMs: "Máx.",
	stddevMs: "Jitter",
	lossPct: "Perda",
	sent: "Enviados",
	lost: "Perdidos",
	rssiDbm: "RSSI",
	noiseDbm: "Ruído",
	snrDb: "SNR",
	queryMs: "Consulta",
	downloadMbps: "Download",
	deltaRttMs: "Δ RTT",
	rpm: "RPM",
};

export function severityLabel(severity: Severity): string {
	return SEVERITY_LABELS[severity];
}

export function categoryLabel(category: Category): string {
	return CATEGORY_LABELS[category];
}

export function scoreLabel(score: number): string {
	if (score >= 85) return "Excelente";
	if (score >= 70) return "Boa";
	if (score >= 50) return "Regular";
	return "Ruim";
}

export function scoreTone(score: number): Severity {
	if (score >= 70) return "good";
	if (score >= 50) return "warn";
	return "bad";
}

export function platformLabel(platform: string): string {
	switch (platform) {
		case "darwin":
			return "Mac";
		case "linux":
			return "Linux";
		case "win32":
			return "Windows";
		default:
			return platform;
	}
}

export function metricLabel(key: string): string {
	if (METRIC_LABELS[key]) return METRIC_LABELS[key];
	return key
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/_/g, " ")
		.replace(/\bms\b/i, "ms")
		.replace(/\bpct\b/i, "%");
}

export function formatMetricValue(key: string, value: number | string | null): string | null {
	if (value === null) return null;
	if (typeof value === "string") return value;

	const lower = key.toLowerCase();
	if (lower.includes("pct") || lower.includes("loss")) {
		return `${trimNumber(value)}%`;
	}
	if (lower.endsWith("ms") || lower.includes("rtt") || lower.includes("query")) {
		return `${trimNumber(value)} ms`;
	}
	if (lower.includes("dbm")) {
		return `${trimNumber(value)} dBm`;
	}
	if (lower.includes("mbps")) {
		return `${trimNumber(value)} Mbps`;
	}
	if (lower.endsWith("db")) {
		return `${trimNumber(value)} dB`;
	}
	return trimNumber(value);
}

function trimNumber(value: number): string {
	if (Number.isInteger(value)) return String(value);
	return value.toFixed(Math.abs(value) >= 10 ? 1 : 2);
}
