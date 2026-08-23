# RFC-001: Programa — Internet Diag (side project)

**Status:** Accepted  
**Created:** 2026-08-23  
**Type:** Program  
**Product:** Internet Diag  
**Related:** [RFC-002](./002-feature-snapshot-diagnostic.md), [RFC-003](./003-feature-realtime-monitor.md), [RFC-004](./004-feature-friendly-ui.md)

---

## Summary

Novo produto **standalone** para diagnosticar a internet do usuário no Mac (com fallbacks portáteis em Linux). Não faz parte do Cafofo OS: sem módulos de grocery, sem MCP, sem Prisma, sem tokens retro, sem imports de `apps/`.

Este RFC define o recorte do produto, a stack e os limites. Os comportamentos vêm nos RFCs 002–004.

## Goal

Entregar um app local com UI amigável que mede a qualidade da conexão (snapshot + tempo real) e devolve um laudo completo com dicas acionáveis, usando apenas ferramentas **gratuitas** — nativas do macOS quando existirem, senão equivalentes portáteis.

## Non-goals

- Qualquer integração com Cafofo (backend, webapp, Butler, MCP, Postgres).
- Apps pagos (WiFi Explorer, PingPlotter Pro, NetSpot Survey).
- Alterar configuração do sistema automaticamente (`networksetup`, flush DNS com sudo, troca de canal do roteador).
- Detecção automática definitiva de throttling de ISP (exige VPN paga + interpretação humana).
- Heatmap Wi-Fi / site survey.
- iPhone (iOS bloqueia scan de canais).
- Persistência em banco; histórico longo fica fora do MVP.

## Motivation

Pesquisas em `ferramentas-verificadas` e `diagnostico-internet` mostram que o Mac já tem as peças (ping, dig, traceroute, `networkQuality`, Wireless Diagnostics / `airport`, `scutil`), mas elas são CLI, escondidas ou isoladas. Não existe um all-in-one gratuito que rode o diagnóstico, interprete limiares e explique o que fazer.

## Stack (própria — não herda o monorepo)

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Runtime | Bun + TypeScript | Processo local único, spawn de CLI, HTTP |
| API | HTTP JSON + SSE | Snapshot via POST; tempo real via stream |
| UI | Vue 3 + Vite + TypeScript | SPA amigável, hot reload |
| CSS | CSS nativo (tokens próprios) | Visual escuro tipo laboratório, sem Tailwind do Cafofo |
| Testes | Vitest | Motor de análise é determinístico |
| Empacote | `internet-diag/` na raiz do workspace, **fora** de `apps/*` | Não entra no workspace Bun do Cafofo |

Pasta-alvo: `/internet-diag`. Pode ser extraída para um repositório próprio sem mudanças.

## Arquitetura

```
┌─────────────────────────────────────────┐
│  Vue SPA (RFC-004)                      │
│  snapshot UI  ·  live monitor  ·  tips  │
└───────────────┬─────────────────────────┘
                │ HTTP + SSE
┌───────────────▼─────────────────────────┐
│  Bun local server                       │
│  /api/diagnose  /api/monitor  /api/caps │
└───────────────┬─────────────────────────┘
                │
     ┌──────────▼──────────┐
     │ Probe adapters      │
     │ portable │ darwin   │
     └──────────┬──────────┘
                │
     ┌──────────▼──────────┐
     │ Advice engine       │
     │ thresholds + tips   │
     └─────────────────────┘
```

### Probe adapters

| Probe | Fonte gratuita | Portable (Linux/CI) | Darwin (Mac) |
|-------|----------------|---------------------|--------------|
| Config local (IP, gateway, DNS) | `ifconfig` / `ip`, `route`, `scutil --dns` | Node `os` + parse de `ip`/`route` | `scutil`, `route`, `ifconfig` |
| Latência / loss / jitter | `ping` nativo | `ping -c` | `ping` |
| DNS | `dig` / Node `dns` | Node `dns.promises` | `dig` se existir, senão Node |
| Throughput | HTTP download de arquivo público | fetch timed | idem |
| Bufferbloat / RPM | `networkQuality` (Apple/IETF RPM) | latência sob carga (ping + download) | `networkQuality -c` se disponível |
| Caminho | `traceroute` / `mtr` | `traceroute` se instalado | `traceroute` nativo |
| Wi-Fi RSSI / noise | `airport` / `wdutil` | indisponível → `unknown` | best-effort, nunca falha o laudo |

Princípio: **degradação graciosa**. Probe ausente vira finding `unknown` com dica de como medir no Mac, não erro fatal.

## Superfície HTTP

| Método | Path | RFC |
|--------|------|-----|
| `GET` | `/api/health` | 001 |
| `GET` | `/api/capabilities` | 001 |
| `POST` | `/api/diagnose` | 002 |
| `GET` | `/api/monitor` (SSE) | 003 |
| `GET` | `/` e assets | 004 |

Sem autenticação: bind em `127.0.0.1` apenas.

## RFCs deste programa (4)

| RFC | Tipo | O que entrega |
|-----|------|---------------|
| **001** | Program | Este documento: stack, limites, pasta isolada |
| **002** | Feature | Diagnóstico snapshot + laudo + dicas |
| **003** | Feature | Monitor em tempo real (SSE) |
| **004** | Feature | UI amigável (home, laudo, live) |

Ordem de implementação: 001 (scaffold) → 002 (motor) → 003 (stream) → 004 (UI). 002 e 003 compartilham probes; 004 só consome HTTP.

## Consistency & failure

- Servidor local; se um probe estourar timeout, o restante segue.
- Timeouts curtos (3–12s por probe) para o snapshot caber em ~30s.
- Sem migração de dados.

## Implementation notes

- Zero imports de `@cafofo/*` ou `apps/**`.
- Portas: API `8787`, Vite `5177` (evita 3000/5173 do Cafofo).
- `bun run dev` sobe API + UI.
- Testes do motor não exigem Mac nem Docker.

## Self-check

- [x] Produto isolado do Cafofo
- [x] Stack própria documentada
- [x] Quatro RFCs nomeados
- [x] Sem schema / MCP / grocery
