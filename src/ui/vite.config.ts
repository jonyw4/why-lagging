import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const uiRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	root: uiRoot,
	plugins: [vue()],
	resolve: {
		alias: {
			"@shared": fileURLToPath(new URL("../shared", import.meta.url)),
		},
	},
	server: {
		port: 5177,
		host: "127.0.0.1",
		strictPort: true,
		proxy: {
			"/api": {
				target: "http://127.0.0.1:8787",
				changeOrigin: true,
			},
		},
	},
	build: {
		outDir: "/workspace/internet-diag/dist",
		emptyOutDir: true,
	},
});
