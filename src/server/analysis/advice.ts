import type { Finding, ProbeMetrics, Severity } from "../../shared/types.ts";
import {
	THRESHOLDS,
	classifyBufferbloat,
	classifyDns,
	classifyJitter,
	classifyLossExternal,
	classifyLossGateway,
	classifyRpm,
	classifyRssi,
	classifyRttExternal,
	classifyRttGateway,
	classifySnr,
	classifyThroughput,
	worstSeverity,
} from "./thresholds.ts";

const FINDING_IDS = [
	"config.addressing",
	"perf.gateway",
	"perf.external",
	"dns.resolution",
	"perf.throughput",
	"perf.bufferbloat",
	"isp.path",
	"wifi.signal",
] as const;

function num(metrics: Record<string, number | string | null>, key: string): number | null {
	const value = metrics[key];
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) {
		return Number(value);
	}
	return null;
}

function str(metrics: Record<string, number | string | null>, key: string): string | null {
	const value = metrics[key];
	if (typeof value === "string" && value.length > 0) return value;
	return null;
}

function byId(probes: ProbeMetrics[], id: string): ProbeMetrics | undefined {
	return probes.find((probe) => probe.id === id);
}

function unknownFinding(
	id: Finding["id"],
	category: Finding["category"],
	title: string,
	summary: string,
	tips: string[],
): Finding {
	return {
		id,
		category,
		title,
		severity: "unknown",
		summary,
		metrics: {},
		tips,
	};
}

function configFinding(probe: ProbeMetrics | undefined): Finding {
	if (!probe?.available) {
		return unknownFinding(
			"config.addressing",
			"config",
			"Configuração local não medida",
			"Não foi possível ler IP, gateway ou DNS desta máquina.",
			["Confira se há uma interface de rede ativa."],
		);
	}

	const ipv4 = str(probe.metrics, "ipv4");
	const gateway = str(probe.metrics, "gateway");
	const apipa = num(probe.metrics, "apipa") === 1 || (ipv4 != null && ipv4.startsWith("169.254."));

	if (apipa) {
		return {
			id: "config.addressing",
			category: "config",
			title: "Endereço APIPA — DHCP falhou",
			severity: "bad",
			summary:
				"O computador recebeu um endereço 169.254.x.x. O DHCP não atribuiu um IP válido.",
			metrics: probe.metrics,
			tips: [
				"Reinicie o roteador e, em seguida, o computador.",
				"Verifique o cabo de rede ou a conexão Wi-Fi.",
				"Confirme se o DHCP está ativo no roteador.",
			],
		};
	}

	if (!gateway) {
		return {
			id: "config.addressing",
			category: "config",
			title: "Sem gateway padrão",
			severity: "bad",
			summary: "Não foi encontrado um gateway padrão. Sem rota, a internet não sai da rede local.",
			metrics: probe.metrics,
			tips: [
				"Verifique o cabo ou o Wi-Fi.",
				"Confirme se o DHCP está funcionando.",
				"Reinicie o roteador se o problema continuar.",
			],
		};
	}

	return {
		id: "config.addressing",
		category: "config",
		title: "Endereçamento local ok",
		severity: "good",
		summary: `IP ${ipv4 ?? "desconhecido"} com gateway ${gateway}.`,
		metrics: probe.metrics,
		tips: [],
	};
}

function jitterTips(stddevMs: number | null, tips: string[]): void {
	if (stddevMs != null && stddevMs > THRESHOLDS.jitterWarnMs) {
		tips.push("Jitter alto prejudica chamadas e jogos — evite Wi-Fi congestionado ou teste no cabo.");
	}
}

function looksLikeFilteredGatewayIcmp(
	gateway: ProbeMetrics,
	external: ProbeMetrics | undefined,
	throughput: ProbeMetrics | undefined,
	config: ProbeMetrics | undefined,
): boolean {
	const lossPct = num(gateway.metrics, "lossPct") ?? 0;
	if (lossPct < 100) return false;
	const ipv4 = config ? str(config.metrics, "ipv4") : null;
	const apipa = config ? num(config.metrics, "apipa") === 1 : false;
	if (!ipv4 || apipa || ipv4.startsWith("169.254.")) return false;
	const extLoss = external?.available ? (num(external.metrics, "lossPct") ?? 100) : 100;
	const mbps = throughput?.available ? num(throughput.metrics, "mbps") : null;
	return extLoss <= THRESHOLDS.externalLossGoodPct && mbps != null && mbps > 1;
}

function gatewayFinding(
	probe: ProbeMetrics | undefined,
	external: ProbeMetrics | undefined,
	throughput: ProbeMetrics | undefined,
	config: ProbeMetrics | undefined,
): Finding {
	if (!probe?.available) {
		const noGateway = probe?.error === "no-gateway";
		return unknownFinding(
			"perf.gateway",
			"perf",
			noGateway ? "Ping do gateway indisponível" : "Latência até o gateway não medida",
			noGateway
				? "Sem gateway, o ping local não roda."
				: "O ping até o roteador não pôde ser executado.",
			noGateway
				? ["Verifique DHCP e o cabo/Wi-Fi."]
				: ["Confirme se o comando ping está disponível."],
		);
	}

	const lossPct = num(probe.metrics, "lossPct") ?? 0;
	const avgMs = num(probe.metrics, "avgMs");
	const stddevMs = num(probe.metrics, "stddevMs");
	const parts: Severity[] = [classifyLossGateway(lossPct)];
	if (avgMs != null) parts.push(classifyRttGateway(avgMs));
	if (stddevMs != null) parts.push(classifyJitter(stddevMs));
	let severity = worstSeverity(...parts);

	const icmpFiltered = looksLikeFilteredGatewayIcmp(probe, external, throughput, config);
	if (icmpFiltered) {
		severity = "warn";
	}

	const tips: string[] = [];
	if (icmpFiltered) {
		tips.push(
			"O gateway não responde ping, mas a internet está saindo — ICMP até o roteador costuma ser filtrado em nuvem, CGNAT ou redes corporativas.",
		);
		tips.push("Se páginas carregam e o ping externo está ok, ignore este alarme.");
	} else if (lossPct > 0) {
		tips.push(
			"Há perda até o roteador: o problema é local (Wi-Fi ou cabo), não do provedor (ISP).",
		);
		tips.push("Aproxime-se do roteador ou use cabo Ethernet.");
		tips.push("Evite obstáculos e interferência (micro-ondas, Bluetooth).");
	}
	if (!icmpFiltered && avgMs != null && avgMs > THRESHOLDS.gatewayRttGoodMs) {
		tips.push("Latência alta até o gateway também aponta Wi-Fi/cabo ou o próprio roteador.");
	}
	if (!icmpFiltered) jitterTips(stddevMs, tips);

	const summary = icmpFiltered
		? `O gateway não respondeu a ${lossPct}% dos pings, mas DNS/vazão/externo estão ok — ICMP filtrado, não queda local.`
		: lossPct > 0
			? `Perda de ${lossPct}% até o gateway. Isso é problema local (Wi-Fi/cabo), não ISP.`
			: `Gateway com RTT médio ${avgMs ?? "—"} ms e jitter ${stddevMs ?? "—"} ms.`;

	return {
		id: "perf.gateway",
		category: "perf",
		title: icmpFiltered
			? "Gateway não responde ping (ICMP filtrado)"
			: lossPct > 0
				? "Perda de pacotes até o gateway"
				: "Latência até o gateway",
		severity,
		summary,
		metrics: probe.metrics,
		tips,
	};
}

function isGatewayHealthy(gateway: ProbeMetrics | undefined): boolean {
	if (!gateway?.available) return false;
	const lossPct = num(gateway.metrics, "lossPct");
	const avgMs = num(gateway.metrics, "avgMs");
	if (lossPct == null || lossPct > 0) return false;
	if (avgMs != null && classifyRttGateway(avgMs) === "bad") return false;
	return true;
}

function externalFinding(
	probe: ProbeMetrics | undefined,
	gateway: ProbeMetrics | undefined,
): Finding {
	if (!probe?.available) {
		return unknownFinding(
			"perf.external",
			"perf",
			"Latência externa não medida",
			"O ping até 1.1.1.1 / 8.8.8.8 não pôde ser executado.",
			["Confirme se o comando ping está disponível e se há rota de saída."],
		);
	}

	const lossPct = num(probe.metrics, "lossPct") ?? 0;
	const avgMs = num(probe.metrics, "avgMs");
	const stddevMs = num(probe.metrics, "stddevMs");
	const parts: Severity[] = [classifyLossExternal(lossPct)];
	if (avgMs != null) parts.push(classifyRttExternal(avgMs));
	if (stddevMs != null) parts.push(classifyJitter(stddevMs));
	const severity = worstSeverity(...parts);
	const externalBad = severity === "bad" || severity === "warn";
	const localOk = isGatewayHealthy(gateway);

	const tips: string[] = [];
	if (localOk && externalBad) {
		tips.push(
			"O gateway local está ok, mas o destino externo falha — o problema é do ISP ou do caminho.",
		);
		tips.push("Anote o horário e o traceroute e ligue para o provedor.");
		tips.push("Teste de novo em outro horário para ver se é contenção.");
	} else if (lossPct > THRESHOLDS.externalLossGoodPct) {
		tips.push("Há perda no hop externo. Se o gateway estiver limpo, fale com o provedor.");
	}
	jitterTips(stddevMs, tips);

	const summary =
		localOk && externalBad
			? `Gateway ok, mas o caminho externo está ruim (perda ${lossPct}%, RTT ${avgMs ?? "—"} ms). ISP/caminho.`
			: `Externo com perda ${lossPct}% e RTT médio ${avgMs ?? "—"} ms.`;

	return {
		id: "perf.external",
		category: "perf",
		title: localOk && externalBad ? "Caminho externo instável" : "Latência externa",
		severity,
		summary,
		metrics: probe.metrics,
		tips,
	};
}

function dnsSystemMuchWorse(systemMs: number, cloudflareMs: number): boolean {
	if (systemMs < THRESHOLDS.dnsGoodMs) return false;
	return systemMs >= cloudflareMs * 2 && systemMs - cloudflareMs >= 30;
}

function dnsFinding(probe: ProbeMetrics | undefined): Finding {
	if (!probe?.available) {
		return unknownFinding(
			"dns.resolution",
			"dns",
			"DNS não medido",
			"As consultas DNS não puderam ser concluídas.",
			["Tente de novo. Se persistir, o resolvedor local pode estar inacessível."],
		);
	}

	const systemMs = num(probe.metrics, "systemMs");
	const cloudflareMs = num(probe.metrics, "cloudflareMs");
	const googleMs = num(probe.metrics, "googleMs");
	const sample = systemMs ?? cloudflareMs ?? googleMs;
	const severity = sample != null ? classifyDns(sample) : "unknown";
	const tips: string[] = [];

	if (systemMs != null && cloudflareMs != null && dnsSystemMuchWorse(systemMs, cloudflareMs)) {
		tips.push(
			"Configure 1.1.1.1 e 8.8.8.8 no roteador (instrução — este app não aplica a mudança).",
		);
		tips.push("Evite alterar o DNS no computador se toda a casa usa o roteador.");
	}

	const summary =
		systemMs != null && cloudflareMs != null && dnsSystemMuchWorse(systemMs, cloudflareMs)
			? `O DNS do sistema (${systemMs.toFixed(0)} ms) está bem mais lento que 1.1.1.1 (${cloudflareMs.toFixed(0)} ms).`
			: `Consulta do sistema em ${systemMs?.toFixed(0) ?? "—"} ms; 1.1.1.1 em ${cloudflareMs?.toFixed(0) ?? "—"} ms.`;

	return {
		id: "dns.resolution",
		category: "dns",
		title:
			systemMs != null && cloudflareMs != null && dnsSystemMuchWorse(systemMs, cloudflareMs)
				? "DNS do sistema mais lento que 1.1.1.1"
				: "Resolução DNS",
		severity,
		summary,
		metrics: probe.metrics,
		tips,
	};
}

function throughputFinding(
	probe: ProbeMetrics | undefined,
	bufferbloat: ProbeMetrics | undefined,
): Finding {
	if (!probe?.available) {
		return unknownFinding(
			"perf.throughput",
			"perf",
			"Vazão não medida",
			"O download de teste não pôde ser concluído.",
			["Verifique se há bloqueio de saída HTTPS ou tente de novo."],
		);
	}

	const mbps = num(probe.metrics, "mbps");
	const confidence = str(probe.metrics, "confidence");
	const severity =
		confidence === "low"
			? "unknown"
			: mbps != null
				? classifyThroughput(mbps)
				: "unknown";

	const tips: string[] = [];
	const deltaMs = bufferbloat ? num(bufferbloat.metrics, "deltaMs") : null;
	const bloatOk = deltaMs != null && classifyBufferbloat(deltaMs) === "good";
	if (severity === "bad" && bloatOk) {
		tips.push(
			"A vazão está baixa e o bufferbloat está ok — pode ser o plano ou contenção no horário.",
		);
		tips.push("Compare com outro horário e com o valor contratado.");
	} else if (confidence === "low") {
		tips.push("A medição usou um arquivo minúsculo (baixa confiança). Rode o diagnóstico de novo.");
	}

	return {
		id: "perf.throughput",
		category: "perf",
		title: "Vazão de download",
		severity,
		summary:
			mbps != null
				? `Download medido em ${mbps.toFixed(1)} Mbps (${confidence === "low" ? "baixa confiança" : "teste ~2 MB"}).`
				: "Sem amostra de vazão.",
		metrics: probe.metrics,
		tips,
	};
}

function bufferbloatFinding(probe: ProbeMetrics | undefined): Finding {
	if (!probe?.available) {
		return unknownFinding(
			"perf.bufferbloat",
			"perf",
			"Bufferbloat não medido",
			"Não foi possível comparar a latência ociosa com a latência sob carga.",
			["No Mac, networkQuality -c também estima RPM se o binário existir."],
		);
	}

	const deltaMs = num(probe.metrics, "deltaMs");
	const rpm = num(probe.metrics, "rpm");
	const parts: Severity[] = [];
	if (deltaMs != null) parts.push(classifyBufferbloat(deltaMs));
	if (rpm != null) parts.push(classifyRpm(rpm));
	const severity = worstSeverity(...parts);
	const tips: string[] = [];

	if (deltaMs != null && deltaMs > THRESHOLDS.bufferbloatWarnMs) {
		tips.push("Ative SQM ou QoS no roteador.");
		tips.push("Limite o upload a cerca de 90% da velocidade real.");
	}

	const summary =
		deltaMs != null && deltaMs > THRESHOLDS.bufferbloatWarnMs
			? `A latência sobe ${deltaMs.toFixed(0)} ms sob carga (bufferbloat alto).`
			: `ΔRTT ${deltaMs?.toFixed(0) ?? "—"} ms${rpm != null ? `; RPM ${rpm.toFixed(0)}` : ""}.`;

	return {
		id: "perf.bufferbloat",
		category: "perf",
		title: deltaMs != null && deltaMs > THRESHOLDS.bufferbloatWarnMs ? "Bufferbloat alto" : "Bufferbloat",
		severity,
		summary,
		metrics: probe.metrics,
		tips,
	};
}

function pathFinding(probe: ProbeMetrics | undefined): Finding {
	if (!probe?.available) {
		return unknownFinding(
			"isp.path",
			"isp",
			"Caminho (traceroute) indisponível",
			"O traceroute não está instalado ou não devolveu hops.",
			["No Linux, instale traceroute se quiser ver o caminho até 1.1.1.1."],
		);
	}

	const hopCount = num(probe.metrics, "hopCount") ?? 0;
	const reached = num(probe.metrics, "reached") === 1;
	return {
		id: "isp.path",
		category: "isp",
		title: "Caminho até 1.1.1.1",
		severity: reached || hopCount > 0 ? "good" : "warn",
		summary: reached
			? `Traceroute alcançou 1.1.1.1 em ${hopCount} saltos.`
			: `Traceroute registrou ${hopCount} saltos (destino não confirmado).`,
		metrics: probe.metrics,
		tips: [],
	};
}

function wifiFinding(probe: ProbeMetrics | undefined): Finding {
	if (!probe?.available) {
		return unknownFinding(
			"wifi.signal",
			"wifi",
			"Sinal Wi-Fi não medido",
			"Esta máquina não expõe RSSI (típico no Linux) ou o adaptador Darwin falhou.",
			["No Mac, o app tenta airport e depois wdutil info."],
		);
	}

	const rssiDbm = num(probe.metrics, "rssiDbm");
	const snrDb = num(probe.metrics, "snrDb");
	const parts: Severity[] = [];
	if (rssiDbm != null) parts.push(classifyRssi(rssiDbm));
	if (snrDb != null) parts.push(classifySnr(snrDb));
	const severity = worstSeverity(...parts);
	const tips: string[] = [];

	if (rssiDbm != null && rssiDbm < THRESHOLDS.rssiWarnDbm) {
		tips.push("Aproxime-se do ponto de acesso.");
		tips.push("Prefira a rede 5 GHz.");
		tips.push("Evite micro-ondas perto do roteador no 2.4 GHz.");
	}

	return {
		id: "wifi.signal",
		category: "wifi",
		title: rssiDbm != null && rssiDbm < THRESHOLDS.rssiWarnDbm ? "Sinal Wi-Fi fraco" : "Sinal Wi-Fi",
		severity,
		summary:
			rssiDbm != null
				? `RSSI ${rssiDbm} dBm${snrDb != null ? `; SNR ${snrDb} dB` : ""}.`
				: "Amostra Wi-Fi sem RSSI.",
		metrics: probe.metrics,
		tips,
	};
}

export function findingsFromProbes(probes: ProbeMetrics[]): Finding[] {
	const config = byId(probes, "config.addressing");
	const gateway = byId(probes, "perf.gateway");
	const external = byId(probes, "perf.external");
	const dns = byId(probes, "dns.resolution");
	const throughput = byId(probes, "perf.throughput");
	const bufferbloat = byId(probes, "perf.bufferbloat");
	const path = byId(probes, "isp.path");
	const wifi = byId(probes, "wifi.signal");

	const findings: Finding[] = [
		configFinding(config),
		gatewayFinding(gateway, external, throughput, config),
		externalFinding(external, gateway),
		dnsFinding(dns),
		throughputFinding(throughput, bufferbloat),
		bufferbloatFinding(bufferbloat),
		pathFinding(path),
		wifiFinding(wifi),
	];

	void FINDING_IDS;
	return findings;
}
