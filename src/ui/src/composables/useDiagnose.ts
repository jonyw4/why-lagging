import { ref } from "vue";
import type { DiagnosticReport } from "@shared/types";

const PROGRESS_LINES = [
	"Conectando ao motor local…",
	"Medindo o pulso até o roteador…",
	"Comparando com a internet lá fora…",
	"Consultando o DNS…",
	"Verificando a configuração da máquina…",
	"Montando o laudo em português…",
];

export function useDiagnose() {
	const report = ref<DiagnosticReport | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);
	const progress = ref("");

	let progressTimer: ReturnType<typeof setInterval> | null = null;

	function clearProgress() {
		if (progressTimer) {
			clearInterval(progressTimer);
			progressTimer = null;
		}
		progress.value = "";
	}

	function startProgress() {
		let index = 0;
		progress.value = PROGRESS_LINES[0] ?? "";
		progressTimer = setInterval(() => {
			index = (index + 1) % PROGRESS_LINES.length;
			progress.value = PROGRESS_LINES[index] ?? "";
		}, 2200);
	}

	async function run(): Promise<void> {
		loading.value = true;
		error.value = null;
		report.value = null;
		startProgress();

		try {
			const response = await fetch("/api/diagnose", { method: "POST" });
			if (!response.ok) {
				error.value =
					"O motor local não conseguiu terminar o exame. Espere um instante e tente de novo.";
				return;
			}
			report.value = (await response.json()) as DiagnosticReport;
		} catch {
			error.value =
				"Não conseguimos falar com o motor local. Confira se a API está no ar e tente de novo.";
		} finally {
			clearProgress();
			loading.value = false;
		}
	}

	return { run, report, loading, error, progress };
}
