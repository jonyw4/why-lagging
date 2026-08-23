import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

export interface CommandResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
	timedOut: boolean;
}

export async function runCommand(
	command: string,
	args: string[],
	opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<CommandResult> {
	const timeoutMs = opts.timeoutMs ?? 8000;

	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		let settled = false;

		const child = spawn(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		const finish = (exitCode: number | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			opts.signal?.removeEventListener("abort", onAbort);
			resolve({ stdout, stderr, exitCode, timedOut });
		};

		const onAbort = () => {
			timedOut = true;
			try {
				child.kill("SIGTERM");
			} catch {
				/* already gone */
			}
			setTimeout(() => {
				try {
					child.kill("SIGKILL");
				} catch {
					/* already gone */
				}
			}, 400);
		};

		const timer = setTimeout(onAbort, timeoutMs);

		opts.signal?.addEventListener("abort", onAbort, { once: true });
		if (opts.signal?.aborted) onAbort();

		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString("utf8");
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString("utf8");
		});
		child.on("error", () => finish(null));
		child.on("close", (code) => finish(code));
	});
}

export async function commandExists(name: string): Promise<boolean> {
	if (typeof Bun !== "undefined" && typeof Bun.which === "function") {
		return Bun.which(name) !== null;
	}
	const result = await runCommand("which", [name], { timeoutMs: 2000 });
	return result.exitCode === 0 && result.stdout.trim().length > 0;
}

export async function fileExecutable(path: string): Promise<boolean> {
	try {
		await access(path, constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal?.aborted) {
			resolve();
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});
}

export function asErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
