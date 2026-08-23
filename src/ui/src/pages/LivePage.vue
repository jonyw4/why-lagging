<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { RouterLink } from "vue-router";
import { useMonitor } from "../composables/useMonitor";

const { start, stop, samples, latest, error, connected } = useMonitor();

onMounted(start);
onUnmounted(stop);

const WIDTH = 720;
const HEIGHT = 140;
const PAD = 10;

function seriesPoints(pick: (sample: (typeof samples.value)[number]) => number | null): string {
	const values = samples.value.map(pick);
	const finite = values.filter((value): value is number => value !== null);
	if (finite.length < 2) return "";

	const max = Math.max(40, ...finite);
	const min = 0;
	const span = Math.max(1, max - min);
	const last = Math.max(1, samples.value.length - 1);

	return values
		.map((value, index) => {
			if (value === null) return null;
			const x = PAD + ((WIDTH - PAD * 2) * index) / last;
			const y = HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.filter((point): point is string => point !== null)
		.join(" ");
}

const gatewayLine = computed(() => seriesPoints((sample) => sample.gateway.rttMs));
const externalLine = computed(() => seriesPoints((sample) => sample.external.rttMs));

function rttText(rttMs: number | null, ok: boolean): string {
	if (!ok || rttMs === null) return "—";
	return `${rttMs < 10 ? rttMs.toFixed(1) : Math.round(rttMs)} ms`;
}

function statusText(ok: boolean): string {
	return ok ? "ok" : "falhou";
}

const wifiText = computed(() => {
	const wifi = latest.value?.wifi ?? null;
	if (!wifi) return "Wi-Fi nativo indisponível neste sistema";
	const rssi = wifi.rssiDbm === null ? "—" : `${wifi.rssiDbm} dBm`;
	const noise = wifi.noiseDbm === null ? null : `${wifi.noiseDbm} dBm`;
	return noise ? `RSSI ${rssi} · ruído ${noise}` : `RSSI ${rssi}`;
});
</script>

<template>
	<main class="page">
		<div class="toolbar">
			<RouterLink to="/" class="back-link">← Voltar</RouterLink>
		</div>

		<h1 class="page-title">Monitor ao vivo</h1>
		<p class="lede">
			Um pulso por segundo até o roteador e até a internet. Sem laudo — só o desenho da
			latência, para ver drops na hora.
		</p>

		<div v-if="error" class="banner warn spaced">
			<p>{{ error }}</p>
		</div>

		<section v-if="!latest" class="panel progress-block" aria-live="polite">
			<span class="pulse" aria-hidden="true" />
			<p class="empty">{{ connected ? "Aguardando o primeiro pulso…" : "Ligando o monitor…" }}</p>
		</section>

		<template v-else>
			<div class="live-grid">
				<article class="panel stat">
					<h2>Gateway</h2>
					<div class="stat-row">
						<div
							:class="['stat-value', latest.gateway.ok ? 'sev-good' : 'sev-bad']"
						>
							{{ rttText(latest.gateway.rttMs, latest.gateway.ok) }}
						</div>
						<strong :class="latest.gateway.ok ? 'sev-good' : 'sev-bad'">{{
							statusText(latest.gateway.ok)
						}}</strong>
					</div>
				</article>
				<article class="panel stat">
					<h2>Externo</h2>
					<div class="stat-row">
						<div
							:class="['stat-value', latest.external.ok ? 'sev-good' : 'sev-bad']"
						>
							{{ rttText(latest.external.rttMs, latest.external.ok) }}
						</div>
						<strong :class="latest.external.ok ? 'sev-good' : 'sev-bad'">{{
							statusText(latest.external.ok)
						}}</strong>
					</div>
				</article>
			</div>

			<section class="panel spark-wrap">
				<h2 class="section-kicker">Últimos 40 pulsos</h2>
				<svg
					class="spark"
					:viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
					role="img"
					aria-label="Sparkline de latência do gateway e do destino externo"
				>
					<polyline
						fill="none"
						stroke="#7ee787"
						stroke-width="2.5"
						stroke-linejoin="round"
						stroke-linecap="round"
						:points="gatewayLine"
					/>
					<polyline
						fill="none"
						stroke="#79c0ff"
						stroke-width="2.5"
						stroke-linejoin="round"
						stroke-linecap="round"
						:points="externalLine"
					/>
				</svg>
				<div class="spark-legend">
					<span><i class="swatch" style="background: #7ee787" /> gateway</span>
					<span><i class="swatch" style="background: #79c0ff" /> externo</span>
				</div>
			</section>

			<p class="caps-foot">{{ wifiText }}</p>
		</template>
	</main>
</template>
