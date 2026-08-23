# RFC-002: Diagnóstico snapshot + laudo com dicas

**Status:** Accepted  
**Created:** 2026-08-23  
**Type:** Feature  
**Product:** Internet Diag  
**Related:** [RFC-001](./001-program-internet-diag.md)

---

## Summary

O usuário clica **Rodar diagnóstico**. O servidor executa uma bateria de probes (gratuitos), classifica cada categoria com limiares da pesquisa e devolve um laudo completo em português, com o que está ruim e o que fazer.

## Goal

Uma execução pontual produz um `DiagnosticReport` interpretável por humano, sem exigir conhecimento de CLI.

## Non-goals

- Stream contínuo (RFC-003).
- UI (RFC-004) — este RFC só define o contrato e o motor.
- Mutar DNS, MTU ou Wi-Fi.

## Motivation

As ferramentas nativas do Mac medem bem, mas não interpretam. O gap da pesquisa: ninguém cruza latência idle vs carregada, DNS, loss e config e devolve um plano de ação.

## Use cases

| ID | Use Case | Type | Trigger |
|----|----------|------|---------|
| F1 | Rodar diagnóstico completo | Command | `POST /api/diagnose` |
| F2 | Listar capacidades da máquina | Query | `GET /api/capabilities` |

## BDD scenarios

| Id | Scenario | Covers |
|----|----------|--------|
| S1 | Snapshot feliz: probes portáteis rodam e o laudo tem `overall` + `findings` + `tips` | F1 |
| S2 | Probe ausente (ex.: sem `networkQuality`) vira finding `unknown`, não 500 | F1 |
| S3 | DNS lento vs 1.1.1.1 gera dica para trocar o resolver | F1 |
| S4 | Loss no gateway > 0% aponta Wi-Fi/cabo, não ISP | F1 |
| S5 | Loss só no hop externo aponta caminho/ISP | F1 |
| S6 | Capabilities declara plataforma e probes disponíveis | F2 |

## Domain

### Tipos

```ts
type Severity = "good" | "warn" | "bad" | "unknown";
type Category = "wifi" | "dns" | "isp" | "perf" | "config" | "hw";

interface Finding {
  id: string;
  category: Category;
  title: string;
  severity: Severity;
  summary: string;
  metrics: Record<string, number | string | null>;
  tips: string[];
}

interface DiagnosticReport {
  id: string;
  startedAt: string;
  finishedAt: string;
  platform: string;
  overall: { score: number; label: string; summary: string };
  findings: Finding[];
  capabilities: string[];
}
```

### Categorias medidas no MVP

| Finding id | O que mede | Ferramenta gratuita |
|------------|------------|---------------------|
| `config.addressing` | IP, gateway, APIPA 169.254 | `os` / `ip` / `ifconfig` |
| `perf.gateway` | ping gateway (loss, rtt, jitter) | `ping` |
| `perf.external` | ping 1.1.1.1 e 8.8.8.8 | `ping` |
| `dns.resolution` | query time sistema vs 1.1.1.1 vs 8.8.8.8 | Node `dns` / `dig` |
| `perf.throughput` | download HTTP cronometrado | fetch |
| `perf.bufferbloat` | RTT idle vs sob carga; RPM se Mac | ping+download / `networkQuality` |
| `isp.path` | hops + perda (se traceroute existir) | `traceroute` |
| `wifi.signal` | RSSI / noise (só Mac) | `airport` / `wdutil` |

### Limiares (pesquisa)

| Métrica | good | warn | bad |
|---------|------|------|-----|
| RTT gateway | < 10 ms | 10–50 ms | > 50 ms |
| Loss gateway | 0% | — | > 0% |
| RTT externo | < 30 ms | 30–80 ms | > 80 ms |
| Loss externo | 0–1% | 1–2% | > 2% |
| Jitter (stddev) | < 5 ms | 5–30 ms | > 30 ms |
| DNS query | < 30 ms | 30–100 ms | > 100 ms |
| RSSI | > −60 dBm | −70 a −60 | < −70 dBm |
| SNR | > 25 dB | 15–25 | < 15 dB |
| Bufferbloat ΔRTT | < 30 ms | 30–100 ms | > 100 ms |
| RPM (`networkQuality`) | > 1000 | 200–1000 | < 200 |
| IP APIPA | — | — | 169.254.x.x |

### Regras de dicas (exemplos)

- Gateway com loss → cabo/Wi-Fi; aproximar do roteador; testar Ethernet.
- Externo ruim e gateway bom → ISP/caminho; coletar traceroute e ligar no provedor.
- DNS sistema >> 1.1.1.1 → configurar 1.1.1.1 / 8.8.8.8 no roteador (instrução, sem aplicar).
- Bufferbloat ruim → ativar SQM/QoS no roteador; limitar upload a ~90% do real.
- RSSI baixo → reposicionar AP; preferir 5 GHz; evitar micro-ondas no 2.4.
- Throughput baixo + bufferbloat ok → plano/contingência; comparar horário.
- Sem default gateway → checar DHCP / cabo.

Score overall 0–100: média ponderada (perf 35, dns 15, config 15, isp 20, wifi 15). `unknown` não puxa a nota para baixo.

## Surface

`POST /api/diagnose` → `200 DiagnosticReport`  
`GET /api/capabilities` → `{ platform, probes: { id, available, source }[] }`

Timeouts: ping 8s, DNS 5s, download 12s, traceroute 10s, networkQuality 20s. Promise.allSettled.

## Tests

Vitest no motor de limiares e nas regras de dicas (fixtures sintéticos). Probes de rede: mock de spawn/`dns`. Um teste de integração leve em `POST /api/diagnose` com probes mockados.

## Implementation notes

Arquivos:

- `src/shared/types.ts`
- `src/server/probes/*`
- `src/server/analysis/thresholds.ts`
- `src/server/analysis/advice.ts`
- `src/server/analysis/score.ts`
- `src/server/diagnose.ts`
- `tests/unit/advice.test.ts`, `tests/unit/score.test.ts`
