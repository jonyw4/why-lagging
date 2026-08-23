# RFC-003: Monitor em tempo real

**Status:** Accepted  
**Created:** 2026-08-23  
**Type:** Feature  
**Product:** Internet Diag  
**Related:** [RFC-001](./001-program-internet-diag.md), [RFC-002](./002-feature-snapshot-diagnostic.md)

---

## Summary

Além do snapshot, o app mantém um pulso contínuo: latência, loss e (no Mac) sinal Wi-Fi, empurrados por SSE para a UI.

## Goal

O usuário vê a conexão “respirar” ao vivo — útil para caminhar pela casa, ligar o micro-ondas ou perceber drops intermitentes que um teste de 20s não pega.

## Non-goals

- Persistência / CSV de horas (gap da pesquisa; pós-MVP).
- Alertas push.
- Substituir o snapshot: o live **não** gera laudo completo nem dicas longas.

## Motivation

`airport -I` + `watch`, ping contínuo e Wireless Diagnostics → Performance já fazem isso no Mac, mas sem UI única. O live fecha o gap “preciso ver agora”, o snapshot fecha o gap “me explica o que está errado”.

## Use cases

| ID | Use Case | Type | Trigger |
|----|----------|------|---------|
| F3 | Assinar pulso ao vivo | Query (SSE) | `GET /api/monitor` |

## BDD scenarios

| Id | Scenario | Covers |
|----|----------|--------|
| S7 | Cliente SSE recebe um `sample` pelo menos a cada 2s | F3 |
| S8 | Sample inclui rtt/loss para `gateway` e `external` quando o ping funciona | F3 |
| S9 | Sem Wi-Fi nativo, `wifi` vem `null` e o stream continua | F3 |
| S10 | Cliente desconecta → o loop do servidor para (sem leak) | F3 |

## Domain

```ts
interface MonitorSample {
  at: string;
  gateway: { rttMs: number | null; ok: boolean };
  external: { rttMs: number | null; ok: boolean };
  wifi: { rssiDbm: number | null; noiseDbm: number | null } | null;
}
```

Cadência: 1 sample / segundo (ping de 1 pacote). Burst de loss = `ok: false`.

## Surface

`GET /api/monitor`

```
Content-Type: text/event-stream
event: sample
data: { ...MonitorSample }
```

Heartbeat `event: ping` a cada 15s. Bind localhost.

## Consistency & failure

- Ping falho não encerra o SSE.
- Máximo 1 subscriber “quente” no MVP (segundo cliente compartilha o mesmo loop ou abre o seu — aceitável).
- Sem backpressure: se o cliente atrasar, samples intermediários podem ser dropados.

## Tests

- Parser/formatador de sample (unit).
- Servidor SSE: conectar, receber ≥1 evento, abortar (integração).

## Implementation notes

- Reusar o probe de ping do RFC-002 (função `pingOnce`).
- Wi-Fi: mesma adapter Darwin; no Linux `wifi: null`.
- UI do sparkline é RFC-004.
