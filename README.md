# Why Lagging

App local para diagnosticar a internet (foco Mac, fallbacks em Linux): um **diagnóstico que você roda** e um **monitor em tempo real**, com laudo em português e dicas do que fazer.

## RFCs (4)

| RFC | Arquivo |
|-----|---------|
| Programa + stack | [`docs/rfcs/001-program-internet-diag.md`](docs/rfcs/001-program-internet-diag.md) |
| Snapshot + dicas | [`docs/rfcs/002-feature-snapshot-diagnostic.md`](docs/rfcs/002-feature-snapshot-diagnostic.md) |
| Tempo real | [`docs/rfcs/003-feature-realtime-monitor.md`](docs/rfcs/003-feature-realtime-monitor.md) |
| UI | [`docs/rfcs/004-feature-friendly-ui.md`](docs/rfcs/004-feature-friendly-ui.md) |

## Stack

Bun + TypeScript (API em `127.0.0.1:8787`) · Vue 3 + Vite (UI em `:5177`) · Vitest.

Só ferramentas **gratuitas**: `ping`, DNS nativo, HTTP throughput, `traceroute` se existir, `networkQuality` / `airport` no Mac.

No Linux (CI / sandbox), instale `iputils-ping` e, se quiser o caminho, `traceroute`. Sem `ping`, o laudo continua — os findings de latência ficam `unknown` com dica.

## Comandos

```bash
bun install
bun run dev          # API + UI
bun test             # motor de análise
bun run build        # UI → dist/ + typecheck
```

Abra http://127.0.0.1:5177
