# RFC-004: UI amigável do diagnóstico

**Status:** Accepted  
**Created:** 2026-08-23  
**Type:** Feature  
**Product:** Internet Diag  
**Related:** [RFC-001](./001-program-internet-diag.md), [RFC-002](./002-feature-snapshot-diagnostic.md), [RFC-003](./003-feature-realtime-monitor.md)

---

## Summary

SPA em português, visual de laboratório escuro (IBM Plex / GitHub dark — **não** o tema NES do Cafofo). Duas entradas claras: **Rodar diagnóstico** e **Monitor ao vivo**. O laudo mostra nota, findings por categoria e dicas numeradas.

## Goal

Qualquer pessoa em casa entende o resultado e o próximo passo, sem abrir o Terminal.

## Non-goals

- i18n além de pt-BR no MVP.
- Conta, login, sync.
- Aplicar correções no SO.
- Storybook / design system Cafofo.

## Motivation

Network Utility saiu no Monterey. O que restou é CLI. A UI é o produto.

## Use cases

| ID | Use Case | Type | Trigger |
|----|----------|------|---------|
| F4 | Ver home e escolher modo | Query | `GET /` |
| F5 | Acompanhar progresso do snapshot e ler laudo | Command | UI → RFC-002 |
| F6 | Ver pulso ao vivo com sparklines | Query | UI → RFC-003 |

## BDD / telas

| Id | Tela | Comportamento |
|----|------|----------------|
| S11 | Home | Título, 2 cards (Diagnóstico / Ao vivo), capabilities em texto discreto |
| S12 | Snapshot running | Progresso por probe; não trava a página |
| S13 | Laudo | Score grande, resumo, cards por finding (cor = severity), lista de dicas |
| S14 | Live | RTT gateway/externo atualizando; sparkline; aviso se Wi-Fi indisponível |
| S15 | Erro de API | Banner amigável + retry, sem stack trace |

Wireframe (home):

```
┌──────────────────────────────────────────┐
│  Internet Diag                           │
│  Entenda sua conexão em linguagem clara  │
│                                          │
│  ┌─────────────┐  ┌─────────────┐        │
│  │ Diagnóstico │  │  Ao vivo    │        │
│  │ Roda e      │  │ Pulso de    │        │
│  │ explica     │  │ latência    │        │
│  └─────────────┘  └─────────────┘        │
│                                          │
│  Mac · ping · dns · networkQuality?      │
└──────────────────────────────────────────┘
```

Wireframe (laudo):

```
┌──────────────────────────────────────────┐
│  ← Voltar          Nota 78 · Boa         │
│  Resumo em 2 linhas                      │
│  ┌ perf ┐ ┌ dns ┐ ┌ config ┐ …           │
│  │ ⚠    │ │ ✓   │ │ ✓      │             │
│  └──────┘ └─────┘ └────────┘             │
│  Dicas                                   │
│  1. …                                    │
│  2. …                                    │
└──────────────────────────────────────────┘
```

## Visual

- Fundo `#0d1117`, surface `#161b22`, texto `#e6edf3`, muted `#8b949e`.
- Severidade: good `#7ee787`, warn `#ffa657`, bad `#ff7b72`, unknown `#79c0ff`.
- Fonte: IBM Plex Sans + IBM Plex Mono (Google Fonts).
- Toque ≥ 44px nos botões. Foco visível.

## Surface (UI)

Rotas client-side: `/`, `/diagnose`, `/live`.  
Vite proxy `/api` → `127.0.0.1:8787`.

## Tests

- Vitest do formatador de score/label.
- Smoke: `bun run build` da UI.
- Manual: home → diagnostic → live (neste ambiente Linux, probes portáteis).

## Implementation notes

- `src/ui/` Vite app; `src/server` serve `dist/` em produção.
- Sem Pinia se o estado couber em composables (`useDiagnose`, `useMonitor`).
- Copy 100% pt-BR.
