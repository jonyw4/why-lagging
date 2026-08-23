<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import type { CapabilitiesResponse } from "@shared/types";
import { platformLabel } from "../lib/labels";

const capsLine = ref("");

onMounted(async () => {
	try {
		const response = await fetch("/api/capabilities");
		if (!response.ok) return;
		const data = (await response.json()) as CapabilitiesResponse;
		const probes = data.probes
			.filter((probe) => probe.available)
			.map((probe) => probe.id)
			.join(" · ");
		capsLine.value = probes
			? `${platformLabel(data.platform)} · ${probes}`
			: platformLabel(data.platform);
	} catch {
		capsLine.value = "";
	}
});
</script>

<template>
	<main class="page hero">
		<h1>Entenda sua conexão em linguagem clara</h1>
		<p class="lede">
			Um exame completo quando a internet está estranha — e um pulso ao vivo para ver drops na
			hora.
		</p>

		<div class="card-grid">
			<RouterLink to="/diagnose" class="mode-card diagnose">
				<span class="mode-kicker">Snapshot</span>
				<h2>Rodar diagnóstico</h2>
				<p>
					Roda uma bateria de testes e devolve um laudo: o que está ruim, o que está bem e o
					que fazer agora.
				</p>
				<span class="mode-go">Começar exame →</span>
			</RouterLink>

			<RouterLink to="/live" class="mode-card live">
				<span class="mode-kicker">Tempo real</span>
				<h2>Monitor ao vivo</h2>
				<p>
					Acompanha a latência segundo a segundo. Bom para caminhar pela casa e ver o sinal
					cair.
				</p>
				<span class="mode-go">Ver pulso →</span>
			</RouterLink>
		</div>

		<p v-if="capsLine" class="caps-foot">{{ capsLine }}</p>
	</main>
</template>
