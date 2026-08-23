import { existsSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { getCapabilities } from "./capabilities.ts";
import { diagnose } from "./diagnose.ts";
import { monitorLoop } from "./monitor.ts";

const HOST = "127.0.0.1";
const PORT = 8787;

const CORS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...CORS,
		},
	});
}

function distRoot(): string | null {
	const path = resolve(import.meta.dir, "../../dist");
	try {
		if (existsSync(path) && statSync(path).isDirectory()) return path;
	} catch {
		/* ignore */
	}
	return null;
}

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".woff2": "font/woff2",
};

function serveStatic(pathname: string): Response {
	const root = distRoot();
	if (!root) {
		return json({ error: "not found" }, 404);
	}

	const relative = pathname === "/" ? "/index.html" : pathname;
	const requested = resolve(root, `.${relative}`);
	if (requested !== root && !requested.startsWith(`${root}/`)) {
		return json({ error: "not found" }, 404);
	}

	const file = Bun.file(requested);
	if (file.size > 0 || existsSync(requested)) {
		const type = MIME[extname(requested)] ?? file.type;
		return new Response(file, { headers: { "Content-Type": type, ...CORS } });
	}

	const index = Bun.file(resolve(root, "index.html"));
	if (existsSync(resolve(root, "index.html"))) {
		return new Response(index, {
			headers: { "Content-Type": "text/html; charset=utf-8", ...CORS },
		});
	}

	return json({ error: "not found" }, 404);
}

function sseMonitor(request: Request): Response {
	const encoder = new TextEncoder();
	let heartbeat: ReturnType<typeof setInterval> | undefined;

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: string, data: string) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
			};

			heartbeat = setInterval(() => {
				if (request.signal.aborted) return;
				try {
					send("ping", "{}");
				} catch {
					/* closed */
				}
			}, 15_000);

			const onAbort = () => {
				if (heartbeat) clearInterval(heartbeat);
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			};

			request.signal.addEventListener("abort", onAbort, { once: true });
			if (request.signal.aborted) {
				onAbort();
				return;
			}

			try {
				for await (const sample of monitorLoop(request.signal)) {
					if (request.signal.aborted) break;
					send("sample", JSON.stringify(sample));
				}
			} finally {
				if (heartbeat) clearInterval(heartbeat);
				request.signal.removeEventListener("abort", onAbort);
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			}
		},
		cancel() {
			if (heartbeat) clearInterval(heartbeat);
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream; charset=utf-8",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			...CORS,
		},
	});
}

const server = Bun.serve({
	hostname: HOST,
	port: PORT,
	async fetch(request) {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS });
		}

		if (url.pathname === "/api/health" && request.method === "GET") {
			return json({ ok: true });
		}

		if (url.pathname === "/api/capabilities" && request.method === "GET") {
			return json(await getCapabilities());
		}

		if (url.pathname === "/api/diagnose" && request.method === "POST") {
			return json(await diagnose());
		}

		if (url.pathname === "/api/monitor" && request.method === "GET") {
			return sseMonitor(request);
		}

		if (url.pathname.startsWith("/api/")) {
			return json({ error: "not found" }, 404);
		}

		if (request.method === "GET") {
			return serveStatic(url.pathname);
		}

		return json({ error: "method not allowed" }, 405);
	},
});

console.error(`internet-diag listening on http://${HOST}:${server.port}`);
