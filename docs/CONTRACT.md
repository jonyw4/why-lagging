# Contract for implementers

Read the four RFCs in `docs/rfcs/`. Shared types live in `src/shared/types.ts`.

## Ports

- API: `127.0.0.1:8787`
- Vite: `5177` with proxy `/api` → `8787`

## Engine files (do not touch `src/ui`)

- `src/server/index.ts` — Bun.serve
- `src/server/capabilities.ts`
- `src/server/diagnose.ts`
- `src/server/monitor.ts`
- `src/server/probes/ping.ts`
- `src/server/probes/dns.ts`
- `src/server/probes/config.ts`
- `src/server/probes/throughput.ts`
- `src/server/probes/bufferbloat.ts`
- `src/server/probes/path.ts`
- `src/server/probes/wifi.ts`
- `src/server/probes/network-quality.ts`
- `src/server/analysis/thresholds.ts`
- `src/server/analysis/advice.ts`
- `src/server/analysis/score.ts`
- `tests/unit/*.test.ts`

## UI files (do not touch `src/server`)

- `src/ui/index.html`
- `src/ui/vite.config.ts`
- `src/ui/tsconfig.json`
- `src/ui/src/main.ts`
- `src/ui/src/App.vue`
- `src/ui/src/styles.css`
- `src/ui/src/router.ts`
- `src/ui/src/pages/HomePage.vue`
- `src/ui/src/pages/DiagnosePage.vue`
- `src/ui/src/pages/LivePage.vue`
- `src/ui/src/composables/useDiagnose.ts`
- `src/ui/src/composables/useMonitor.ts`
- `src/ui/src/lib/labels.ts`

Copy: 100% pt-BR. Theme: RFC-004 (GitHub dark + IBM Plex). No Cafofo tokens.
