import { computed, ref } from "vue";
import type { MonitorSample } from "@shared/types";

const MAX_SAMPLES = 40;

export function useMonitor() {
	const samples = ref<MonitorSample[]>([]);
	const latest = computed(() => samples.value.at(-1) ?? null);
	const error = ref<string | null>(null);
	const connected = ref(false);

	let source: EventSource | null = null;

	function start(): void {
		stop();
		error.value = null;
		connected.value = false;

		const es = new EventSource("/api/monitor");
		source = es;

		es.addEventListener("sample", (event) => {
			try {
				const sample = JSON.parse((event as MessageEvent).data) as MonitorSample;
				samples.value = [...samples.value, sample].slice(-MAX_SAMPLES);
				connected.value = true;
				error.value = null;
			} catch {
				// ignore a malformed tick; the next sample will refresh the pulse
			}
		});

		es.onerror = () => {
			connected.value = false;
			error.value = "A conexão com o monitor caiu. Reconectando…";
		};
	}

	function stop(): void {
		source?.close();
		source = null;
		connected.value = false;
	}

	return { start, stop, samples, latest, error, connected };
}
