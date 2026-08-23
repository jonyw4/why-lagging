import type { Category, Finding, Severity } from "../../shared/types.ts";

const WEIGHTS: Record<Category, number> = {
	perf: 35,
	dns: 15,
	config: 15,
	isp: 20,
	wifi: 15,
	hw: 0,
};

export function severityToScore(severity: Severity): number | null {
	if (severity === "unknown") return null;
	if (severity === "good") return 100;
	if (severity === "warn") return 60;
	return 20;
}

export function labelForScore(score: number): "Excelente" | "Boa" | "Regular" | "Ruim" {
	if (score >= 85) return "Excelente";
	if (score >= 70) return "Boa";
	if (score >= 45) return "Regular";
	return "Ruim";
}

export function summaryForLabel(label: ReturnType<typeof labelForScore>): string {
	if (label === "Excelente") return "A conexão está saudável no que foi medido.";
	if (label === "Boa") return "A conexão está boa, com pontos a melhorar.";
	if (label === "Regular") return "Há problemas que valem a pena corrigir.";
	return "A conexão está ruim; siga as dicas do laudo.";
}

function average(values: number[]): number | null {
	if (values.length === 0) return null;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function scoreFindings(findings: Finding[]): {
	score: number;
	label: string;
	summary: string;
} {
	const byCategory = new Map<Category, number[]>();

	for (const finding of findings) {
		const points = severityToScore(finding.severity);
		if (points == null) continue;
		const bucket = byCategory.get(finding.category) ?? [];
		bucket.push(points);
		byCategory.set(finding.category, bucket);
	}

	let weighted = 0;
	let weightSum = 0;
	for (const [category, values] of byCategory) {
		const mean = average(values);
		if (mean == null) continue;
		const weight = WEIGHTS[category];
		if (weight <= 0) continue;
		weighted += mean * weight;
		weightSum += weight;
	}

	let score = weightSum === 0 ? 100 : Math.round(weighted / weightSum);
	const hasBad = findings.some((finding) => finding.severity === "bad");
	const hasWarn = findings.some((finding) => finding.severity === "warn");
	if (hasBad) score = Math.min(score, 69);
	else if (hasWarn) score = Math.min(score, 84);

	const label = labelForScore(score);
	const worst = findings.filter((finding) => finding.severity === "bad" || finding.severity === "warn");
	const summary =
		worst.length > 0
			? worst.map((finding) => finding.summary).join(" ")
			: summaryForLabel(label);
	return { score, label, summary };
}
