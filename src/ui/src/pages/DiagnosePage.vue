<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useDiagnose } from "../composables/useDiagnose";
import {
	categoryLabel,
	formatMetricValue,
	metricLabel,
	scoreLabel,
	scoreTone,
	severityLabel,
} from "../lib/labels";

const { run, report, loading, error, progress } = useDiagnose();

const tone = computed(() => (report.value ? scoreTone(report.value.overall.score) : "unknown"));
const label = computed(() => {
	if (!report.value) return "";
	return report.value.overall.label || scoreLabel(report.value.overall.score);
});

function metricEntries(metrics: Record<string, number | string | null>) {
	return Object.entries(metrics)
		.map(([key, value]) => {
			const formatted = formatMetricValue(key, value);
			return formatted ? { key, label: metricLabel(key), value: formatted } : null;
		})
		.filter((row): row is { key: string; label: string; value: string } => row !== null);
}
</script>

<template>
	<main class="page">
		<div class="toolbar">
			<RouterLink to="/" class="back-link">← Voltar</RouterLink>
			<button v-if="report && !loading" type="button" class="primary" @click="run">
				Rodar de novo
			</button>
		</div>

		<section v-if="!report && !loading && !error" class="panel">
			<h1 class="page-title">Exame da conexão</h1>
			<p class="lede">
				Vamos medir roteador, DNS, caminho até a internet e — no Mac — o sinal Wi-Fi. Leva
				alguns segundos. Nada é alterado no sistema.
			</p>
			<button type="button" class="primary" @click="run">Começar diagnóstico</button>
		</section>

		<section v-if="loading" class="panel progress-block" aria-live="polite">
			<span class="pulse" aria-hidden="true" />
			<h1 class="page-title">Examinando…</h1>
			<p class="lede">{{ progress }}</p>
		</section>

		<div v-if="error" class="banner">
			<p>{{ error }}</p>
			<button type="button" @click="run">Tentar de novo</button>
		</div>

		<template v-if="report">
			<section class="panel score-hero">
				<div :class="['score-num', `sev-${tone}`]">{{ report.overall.score }}</div>
				<div>
					<p :class="['score-label', `sev-${tone}`]">{{ label }}</p>
					<p class="score-summary">{{ report.overall.summary }}</p>
				</div>
			</section>

			<section class="findings" aria-label="Achados">
				<article
					v-for="finding in report.findings"
					:key="finding.id"
					:class="['finding', finding.severity]"
				>
					<div class="finding-head">
						<span class="badge">{{ categoryLabel(finding.category) }}</span>
						<strong :class="`sev-${finding.severity}`">{{
							severityLabel(finding.severity)
						}}</strong>
					</div>
					<h3>{{ finding.title }}</h3>
					<p class="summary">{{ finding.summary }}</p>
					<dl v-if="metricEntries(finding.metrics).length" class="metrics">
						<template v-for="row in metricEntries(finding.metrics)" :key="row.key">
							<dt>{{ row.label }}</dt>
							<dd>{{ row.value }}</dd>
						</template>
					</dl>
					<ol v-if="finding.tips.length" class="tips">
						<li v-for="(tip, index) in finding.tips" :key="index">{{ tip }}</li>
					</ol>
				</article>
			</section>
		</template>
	</main>
</template>
