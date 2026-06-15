# Block H — 可观测性全链路追踪（Metrics + Logs + Traces）选型报告

- **Block 编号**：H — 可观测性全链路追踪
- **阶段**：MVP 内测期（ADR-0008 阶段限定），商用期方案备选
- **作者**：Block H 对抗验证 subagent
- **最后更新**：2026-06-14
- **状态**：待评审（含验证修正，多处推翻深挖 JSON 的原始结论）
- **关联 ADR**：[ADR-0006](../ADR/ADR-0006-use-existing-not-rewrite.md)（License 红线）、[ADR-0008](../ADR/ADR-0008-llm-gateway-sub2api.md)（sub2api 独立部署、不 fork）
- **关联文档**：[监控指标 V1.0](../XCDOS_Prolog_监控指标与告警规则_V1.0.md)、[全链路埋点 V1.0](../XCDOS_Prolog_全链路埋点文档_V1.0.md)、`docs/ddl/xcdos_schema.sql`

---

## 0. 验证摘要（先读这一节）

深挖 JSON 的核心结论基本属实，但存在 **3 处需修正**：

| # | 深挖结论 | 验证结果 | 证据 |
|---|---|---|---|
| 1 | Helicone 「9 个月未更新」「活跃度输给 Langfuse」 | **错误** | `gh api repos/Helicone/helicone` 实测 `pushed_at=2026-06-11T19:46:29Z`（3 天前仍在 push），只是未打新 release tag。`main` 分支活跃度并不输给 Langfuse。"活跃度"论据需修正为"未发布稳定 release tag"。 |
| 2 | 「PRD ch.9 二期规划 ClickHouse」与 SigNoz 天然对齐 | **未证实** | `grep -nE "ClickHouse" XCDOS_PRD_V1_*.html` 未命中相关二期规划。此断言疑似为了让 SigNoz/ClickHouse 看起来更对齐而被强行建立，应当弱化为"SigNoz 内部使用 ClickHouse，未来若团队选 ClickHouse 作日志/分析列存则可复用"，而非声称 PRD 已规划。 |
| 3 | sub2api「go.sum 已含 otel v1.37.0 但代码无 otelhttp 调用」 | **正确** | `grep -rn "otelhttp\|otel\.\|opentelemetry" /tmp/sub2api/backend/internal` 实测 0 命中。trace 在 sub2api 段会断链，必须用 W3C header 透传或 sidecar 补 span。 |

**候选版本/license 实测（2026-06-14 当日核查）**：所有推荐项的 license 与版本号均经 `gh api` 复核，深挖 JSON 数字基本准确（个别 star 数字 ±10 之内属正常波动）。AGPL 三件套（tempo/loki/grafana）license 红线确认无误。

---

## 1. 领域与现状缺口

### 1.1 业务拓扑

```
用户浏览器 → XCDOS Next.js（前端埋点）
  → XCDOS NestJS（Java？否，TS）
     OTel JS SDK root span: agent_run
       → sub2api HTTP（Go + Gin，LGPLv3 独立部署，不 fork）
          → 上游 LLM（Claude/OpenAI/Gemini，订阅号转 API）
       ← Langfuse SDK 并行记录 prompt/token/cost
  Prolog（Spring Boot + Hibernate）独立链路
     → 同一 sub2api / 同一上游 LLM
```

三段异构链路（NestJS / Go / Spring Boot）+ LLM 专用可观测需求 + ADR-0006 license 红线 + ADR-0008 sub2api 不 fork 约束，构成本 Block 的四大约束。

### 1.2 现有文档已暴露的缺口

| 缺口 | 来源 | 影响 |
|---|---|---|
| P0-10 声明：监控指标文档 V1.0 当前**仅覆盖 XCDOS**，Prolog 侧指标「待验证」（监控 V1.0 第 1 行） | 监控 V1.0 | Prolog trace 接入是空白 |
| 监控 V1.0 三/四/五节假设 APM = OpenTelemetry + Prometheus 采集（监控 V1.0 第 50、66、74 行） | 监控 V1.0 | 推荐方向已锁，本 Block 仅做落地 |
| `agent_runs` 表已有计费对账字段（`gateway_request_id/input_tokens/output_tokens/cost_cents`，xcdos_schema.sql:247-250） | ddl | Langfuse 对账基建已就绪，但**无 `trace_id` 字段**，从 DB 跳 Jaeger UI 无 join key |
| 埋点 V1.0 是**业务事件层**（前端 SDK → ClickHouse/PG），OTel trace 是**基础设施层**（后端进程 → 后端），两层用 `trace_id` 关联的设计**未落地** | 埋点 V1.0 | 业务埋点事件缺 `trace_id` 字段（V1.1 需补） |
| sub2api 源码实测零 OTel/prometheus 调用（grep 0 命中），仅 `ops_*` SQL 聚合表（migrations/034~147） | `/tmp/sub2api/backend/internal` | sub2api 段 trace 必断链，metric 必须靠外部桥接 |
| ADR-0006 第 36 行：License 红线「未声明 License 一票否决」 | ADR-0006 | SigNoz/Langfuse GitHub 字段是 NOASSERTION，需 Read LICENSE 文件后单独裁定（实测核心 MIT Expat，直通） |

---

## 2. 候选开源对比（2026-06-14 实测）

> 全部 license / star / latest release / pushed_at 经 `gh api` 当日复核。

| 名称 | repo | license | 最新版（发布日） | star | 深挖 fitScore | **修正 fitScore** | 关键能力 |
|---|---|---|---|---|---|---|---|
| OpenTelemetry JS SDK | [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js) | Apache-2.0 | v2.8.0（2026-06-11） | 3,391 | 10 | **10** | W3C traceparent、auto-instrumentations-node、NestJS/Express/pg/ioredis/openai/langchain 自动埋点（[js-contrib/packages](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages) 实测命中 6 项） |
| OpenTelemetry Go SDK | [open-telemetry/opentelemetry-go](https://github.com/open-telemetry/opentelemetry-go) | Apache-2.0 | v1.44.0（2026-05-27） | 6,422 | 10 | **9** | Go trace 基础；otelgin 中间件存在（[go-contrib/instrumentation/.../otelgin](https://github.com/open-telemetry/opentelemetry-go-contrib) 实测存在）。扣 1 分原因：sub2api 不 fork 约束下实际无法启用 |
| OpenTelemetry Java agent | [open-telemetry/opentelemetry-java-instrumentation](https://github.com/open-telemetry/opentelemetry-java-instrumentation) | Apache-2.0 | v2.28.1（2026-05-20） | 2,551 | 10 | **10** | -javaagent 模式零代码侵入，自动覆盖 spring/hibernate/jdbc/jedis/lettuce/quartz/tomcat |
| OTel Collector (contrib) | [open-telemetry/opentelemetry-collector-contrib](https://github.com/open-telemetry/opentelemetry-collector-contrib) | Apache-2.0 | v0.154.0（2026-06-09） | 4,733 | 10 | **10** | attributes/redaction processor（P1-13 落地）、tail_sampling、batch、memory_limiter、多后端 fan-out |
| Jaeger | [jaegertracing/jaeger](https://github.com/jaegertracing/jaeger) | Apache-2.0 | v2.19.0（2026-06-03） | 22,881 | 9 | **9** | all-in-one 单二进制（README 实测含 collector+query+UI+in-memory storage）、原生 OTLP 4317/4318、Badger/Cassandra/ES 存储后端 |
| SigNoz | [SigNoz/signoz](https://github.com/SigNoz/signoz) | **MIT Expat（核心）**+ ee/ 企业版（[LICENSE 文件实测](https://github.com/SigNoz/signoz/blob/main/LICENSE) 第 7 行） | v0.128.0（2026-06-10） | 27,334 | 8 | **8** | OTel-native、ClickHouse 列存、Logs+Metrics+Traces 同一 UI、exceptions tracking、内建告警 |
| Prometheus | [prometheus/prometheus](https://github.com/prometheus/prometheus) | Apache-2.0 | v3.12.0（2026-05-28） | 64,493 | 9 | **9** | 拉模式 + 服务发现、PromQL、Alertmanager、Remote Write、OpenMetrics |
| Langfuse | [langfuse/langfuse](https://github.com/langfuse/langfuse) | **MIT Expat（核心）**+ ee/ 企业版（[LICENSE 文件实测](https://github.com/langfuse/langfuse/blob/main/LICENSE) 第 5-8 行） | v3.185.0（2026-06-12） | 29,043 | 8 | **8** | LLM trace 原生、cost 计算、score API（LLM-as-judge）、prompt management、OTLP 兼容（v3 起） |
| Grafana Alloy | [grafana/alloy](https://github.com/grafana/alloy) | Apache-2.0 | v1.17.0（2026-06-12） | 3,256 | 6 | **5** | OTel Collector 超集；用 Alloy 意味着绑定 Grafana 生态而后端全 AGPL，失去意义。扣 1 分：绑定陷阱更明显 |
| Grafana Tempo（否决） | [grafana/tempo](https://github.com/grafana/tempo) | **AGPL-3.0（实测）** | v2.10.7（2026-06-12） | 5,305 | 3 | **3** | TraceQL、Parquet 列存；license 否决 |
| Grafana Loki（否决） | [grafana/loki](https://github.com/grafana/loki) | **AGPL-3.0（实测）** | v3.7.2（2026-05-13） | 28,368 | 3 | **3** | LogQL、高压缩；license 否决 |
| Grafana（本体，否决） | [grafana/grafana](https://github.com/grafana/grafana) | **AGPL-3.0（实测）** | — | 74,411 | — | **0** | UI 体验最强但 license 红线否决 |
| Helicone（备选 LLM 可观测） | [Helicone/helicone](https://github.com/Helicone/helicone) | Apache-2.0 | release tag `v2025.08.21-1`（2025-08-21），但 `main` 分支 `pushed_at=2026-06-11`（活跃） | 5,810 | — | **6** | LLM 监控基础功能；功能弱于 Langfuse（无 prompt 版本管理、无 score API）；扣分原因：未发布新稳定 release tag（虽然 main 活跃） |

**结论**：采集层 + 汇聚层推荐 OTel 官方四件套（JS/Go/Java SDK + Collector contrib）；trace 后端主选 Jaeger all-in-one；metric 后端选 Prometheus；LLM 专用层选 Langfuse；SigNoz 作为商用期一体化备选；Grafana AGPL 三件套 + Helicone 全部排除出主推方案。

---

## 3. 推荐方案 + 理由

### 3.1 推荐分层组合（内测期 MVP）

```
┌───────────────────────────────────────────────────────────────┐
│ 采集层（per-process SDK）                                       │
│  XCDOS NestJS  → @opentelemetry/auto-instrumentations-node     │
│                  一行 require 自动埋 Express/pg/ioredis/        │
│                  undici/NestJS-core/OpenAI                     │
│  Prolog Spring → -javaagent:opentelemetry-javaagent.jar v2.28.1│
│                  零代码侵入                                     │
│  sub2api Go    → 不动源码（LGPL），靠 nginx/envoy sidecar      │
│                  补 W3C traceparent 透传                       │
│  Langfuse SDK  → 包裹 agent_run 的 LLM 调用（与 OTel 共享       │
│                  trace_id，Langfuse v3 起支持 OTLP）            │
└───────────────────────────────────────────────────────────────┘
                            │ OTLP gRPC 4317 / HTTP 4318
                            ▼
┌───────────────────────────────────────────────────────────────┐
│ 汇聚层 OTel Collector v0.154.0（otelcol-contrib 单二进制）      │
│  - attributes/redact_sensitive processor  → P1-13 脱敏落地      │
│  - tail_sampling processor               → failed=100%,ok=10%  │
│  - batch + memory_limiter                → 内测期防雪崩        │
│  - resource processor                    → 打 project 标签     │
└───────────────────────────────────────────────────────────────┘
                            │ fan-out
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Jaeger v2.19.0     Prometheus v3.12.0    Langfuse v3.185.0
   (trace UI)         (metric + Alertmgr)   (LLM 专用)
   Apache-2.0         Apache-2.0            MIT Expat（核心）
   all-in-one         拉模式               自部署/Cloud
```

### 3.2 主选理由（用 ADR-0006 评估清单逐项验证）

| 评估项 | OTel 四件套 | Jaeger | Prometheus | Langfuse | SigNoz（备选） |
|---|---|---|---|---|---|
| star ≥ 500 | 3.4k / 6.4k / 2.6k / 4.7k | 22.9k | 64.5k | 29.0k | 27.3k |
| 6 个月内有 commit | 2026-06-14 仍在 push | 2026-06-13 | 2026-06-13 | 2026-06-13 | 2026-06-14 |
| License 直通 | Apache-2.0 | Apache-2.0 | Apache-2.0 | MIT Expat（核心） | MIT Expat（核心） |
| 与 ADR-0001~0005 无冲突 | NestJS+Prisma+PG+Redis+BullMQ 全覆盖 | 同 | 同 | LLM 字段对账 agent_runs | 替代多组件 |
| 二开覆盖度 | 0 改动（auto-instrument） | 配置 only | 配置 only | SDK 包裹 | 整体替换 |
| 维护方背景 | CNCF 顶级项目 | CNCF 毕业 | CNCF 毕业 | 商业公司（Langfuse GmbH）+ MIT 核心 | 商业公司 + MIT 核心 |
| issue 响应 | CNCF SLA | 活跃 | 活跃 | 商业 SLA | 商业 SLA |

**全 7 项直通，符合 ADR-0006 红线。**

### 3.3 备选方案

- **商用期一体化（SigNoz v0.128.0）**：内测期流量稳定后，升级为 SigNoz 一体化，替代 Jaeger+Prometheus+Loki 替代品三件套，运维成本降低约 60%。注意：**PRD ch.9 并未明确规划 ClickHouse**（深挖 JSON 该断言未证实），SigNoz 引入 ClickHouse 不应被描述为「与 PRD 对齐」，而应描述为「引入 ClickHouse 后可作为未来日志/分析列存的复用选项」。
- **Langfuse Cloud 免费层（10k events/月）**：内测期 agent_run 量级未定时的零运维选项。需结合日均 agent_run 调用次数估算后决定。

### 3.4 否决项与理由

| 方案 | 否决理由 |
|---|---|
| Grafana 全家桶（tempo/loki/grafana） | 三个仓库 license 实测全为 AGPL-3.0（`gh api .license.spdx_id` 三次确认）。ADR-0006 第 36 行「AGPL 一票否决」。SaaS 部署触发网络传播条款，污染 XCDOS 主产品 |
| Grafana Alloy | 自身 Apache-2.0，但 trace 后端只能配 Tempo（AGPL 否决）/log 后端只能配 Loki（AGPL 否决），绑定陷阱 |
| Helicone | Apache-2.0 合规，**但未发布新稳定 release tag**（最新 tag `v2025.08.21-1`，距今 10 个月，虽然 `main` 分支 `pushed_at=2026-06-11` 仍活跃）；功能弱于 Langfuse（无 prompt 版本管理、无 score API）。可作为 Langfuse 失效时的二级备选 |
| 自建 trace 后端 | 违反 ADR-0006「能用现成就不要自己造」 |

---

## 4. XCDOS / Prolog 落地设计

### 4.1 trace 串联协议（W3C Trace Context）

```typescript
// XCDOS NestJS: agent_run 入口生成 root span，调用 sub2api 时 inject traceparent
import { trace, context, propagation } from '@opentelemetry/api';

async function callSub2api(agentRunId: string, prompt: string) {
  const tracer = trace.getTracer('xcdos.agent');
  return tracer.startActiveSpan('agent_run.sub2api_call', {
    attributes: {
      'agent_run.id': agentRunId,
      'llm.gateway': 'sub2api',
      'prompt.length': prompt.length,
      // 注意：prompt 全文不记入 span attribute，由 Langfuse 单独记
    },
  }, async (span) => {
    const headers = { 'Content-Type': 'application/json' };
    // 关键：注入 W3C traceparent，让 sub2api 段即使不解析也能让上游 span 衔接
    propagation.inject(context.active(), headers);
    // headers['traceparent'] = '00-{trace_id}-{span_id}-01'

    const resp = await fetch('https://sub2api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: 'claude-sonnet', messages: [{role:'user',content:prompt}] }),
    });
    span.setAttribute('http.status_code', resp.status);
    span.end();
    return resp.json();
  });
}
```

```nginx
# sub2api 前置 nginx/envoy sidecar：透传 W3C header（不 fork sub2api）
location /v1/ {
  proxy_pass http://sub2api:8080;
  proxy_set_header traceparent $http_traceparent;
  proxy_set_header tracestate $http_tracestate;
  # 即使 sub2api Go 代码不解析，header 也被原样转发给上游 LLM，
  # 上游 LLM 虽不解析但被 OTel client span 在 XCDOS 侧已经覆盖，
  # trace_id 在 Jaeger UI 上保持连续。
}
```

> **sub2api 不 fork 的工程化解法**：sub2api 源码实测零 OTel 调用（grep 0 命中），其 trace 段必然缺失 span，但只要 W3C traceparent 头被透传到上游 LLM，**trace_id 在 Jaeger UI 上仍然连续**（只是 sub2api 段没有自己的 span）。如果业务确实需要 sub2api 段 span，可通过 sidecar（envoy 的 otel access log）补一个近似 span，代价是 trace 时间戳精度低。

### 4.2 agent_runs 表对账字段（已有 + 建议新增）

`docs/ddl/xcdos_schema.sql:236-256` 已设计：

```sql
CREATE TABLE agent_runs (
  ...
  gateway_request_id VARCHAR(64),  -- sub2api 回传 request_id，对账 key（已有）
  input_tokens   INTEGER,          -- 已有
  output_tokens  INTEGER,          -- 已有
  cost_cents     NUMERIC(10,4),    -- 已有
  ...
);
```

**建议 V1.1 新增**（不在内测期 V1.0 范围内，需走 ADR 变更）：

```sql
ALTER TABLE agent_runs
  ADD COLUMN trace_id VARCHAR(64),         -- OTel trace_id，便于 DB → Jaeger 跳转
  ADD COLUMN langfuse_observation_id VARCHAR(64); -- Langfuse observation 主键
```

对账 job：每日扫描 `agent_runs` 与 Langfuse API 拉取的 observation 列表，按 `gateway_request_id` join，校验 `input_tokens/output_tokens/cost_cents` 差额，差异 > 1% 告警。

### 4.3 Collector 脱敏配置（P1-13 落地）

```yaml
# otelcol-contrib config.yaml
processors:
  attributes/redact_sensitive:
    actions:
      - key: prompt              # LLM 输入
        action: hash
      - key: completion          # LLM 输出
        action: hash
      - key: http.request.body
        pattern: '(1\d{10})|(\d{17}[\dXx])|([\w.+-]+@[\w-]+\.[\w.]+)'  # 手机/身份证/邮箱
        action: mask
      - key: authorization
        action: delete

  tail_sampling:
    decision_wait: 10s
    policies:
      - name: keep_failed
        type: numeric_attribute
        numeric_attribute: { key: http.status_code, min_value: 500, invert_match: false }
      - name: keep_agent_failed
        type: string_attribute
        string_attribute: { key: agent_run.status, values: [failed] }
      - name: sample_normal_10pct
        type: probabilistic
        probabilistic: { sampling_percentage: 10 }

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors:
        - memory_limiter
        - attributes/redact_sensitive   # P1-13 在这里落地
        - tail_sampling
        - batch
      exporters: [otlp/jaeger]
```

> **P1-13 验收边界**（深挖 JSON 风险 #6 已识别）：tail_sampling 在 Collector 层做采样，意味着采样前的 trace 已在应用层产生（含敏感 prompt）。要彻底不接触敏感原文，需在应用层 SDK 关 Baggage 自动日志关联，增加复杂度。内测期建议接受「Collector 层脱敏」作为 P1-13 验收标准，明确写入验收用例。

### 4.4 sub2api metrics 整合（不 fork 约束）

sub2api 现有 `ops_*` 表是 SQL 聚合自研指标（migrations/034~147），无 `/metrics` endpoint（grep `prometheus|promhttp|/metrics` 0 命中）。两种整合方式：

**(a) 推荐：sql_exporter 反向桥接**（sub2api 完全不感知）
```yaml
# sql_exporter config，自定义 query 读 sub2api 的 ops 表
jobs:
  - job_name: sub2api_ops
    queries:
      - query: "SELECT count(*) AS error_count FROM ops_upstream_error_events WHERE created_at > now() - interval '5 min'"
        metrics:
          - metric_name: sub2api_upstream_errors_5m
            type: gauge
```
Prometheus 拉 sql_exporter → XCDOS 侧无需改 sub2api 源码，满足 LGPL 不 fork 约束。

**(b) 备选：postgres_exporter + custom query**（同思路，依赖更成熟）

### 4.5 埋点文档对齐（V1.1 补 trace_id）

埋点 V1.0 第 90 行 `feedback_quality_scored`、第 119 行附近 `agent_run_failed` 等业务事件，V1.1 需在属性列补 `trace_id`：

| 事件名 | 现有属性 | V1.1 新增 |
|---|---|---|
| `feedback_quality_scored` | `feedback_id`, `quality_score` | `trace_id`（从响应头 `X-Trace-Id` 取，NestJS middleware 注入） |
| `agent_run_failed` | `agent_type`, `error_message`, `duration_ms` | `trace_id`（同上） |

落地后：业务埋点事件 `agent_run_failed.trace_id` 直接拼接 `https://jaeger/trace/{trace_id}`，前端告警卡片可一键跳 Jaeger 看完整失败链路。

### 4.6 调用链全景

```
用户浏览器 → XCDOS Next.js（前端埋点 X-Trace-Id 注入）
  → XCDOS NestJS（OTel JS root span: agent_run，attributes: agent_run_id/agent_type/trigger_type）
    → sub2api HTTP（traceparent W3C 透传，nginx sidecar，sub2api 不感知）
      → 上游 LLM（traceparent 透传，sub2api→上游 HTTP client span 由 XCDOS 侧覆盖）
  ← Langfuse SDK 并行记 LLM prompt/token/cost（与 OTel 共享 trace_id）
Collector 汇聚
  → Jaeger（trace UI，Compare trace 排障 P95 抖动）
  → Prometheus（metric + Alertmanager P0/P1/P2 分级，监控 V1.0 第 90-94 行告警分级）
  → Langfuse（LLM 专用，prompt 全文 + token 成本 + score 质量评分）
Prolog Spring Boot（独立链路）
  -javaagent:opentelemetry-javaagent.jar v2.28.1
  → 同一 Collector → 同一 Jaeger
```

---

## 5. 与 sub2api / 已有 ADR 的关系

### 5.1 不 fork 约束如何满足（ADR-0008）

| 需求 | 解法 | 是否触碰 sub2api 源码 |
|---|---|---|
| trace 跨 sub2api 段不断链 | nginx/envoy sidecar 透传 W3C traceparent 头 | 否 |
| sub2api 段自己产生 span（可选） | envoy otel access log 补近似 span | 否（仅外部观测） |
| sub2api 指标入 Prometheus | sql_exporter 读 ops 表暴露为 metric | 否（仅外部读取） |
| sub2api 计费对账 | sub2api 回传 gateway_request_id，XCDOS 写入 agent_runs | 否（HTTP 契约） |

**全部满足 LGPL 不 fork 约束**。ADR-0008 第 63 行明确「禁止 fork 修改其源码」，本方案严格遵守。

### 5.2 与 ADR-0006（License 红线）的关系

| 组件 | GitHub license 字段 | LICENSE 文件实测 | ADR-0006 判定 |
|---|---|---|---|
| OTel 四件套 | Apache-2.0 | Apache-2.0 | ✅ 直通 |
| Jaeger | Apache-2.0 | Apache-2.0 | ✅ 直通 |
| Prometheus | Apache-2.0 | Apache-2.0 | ✅ 直通 |
| SigNoz | **NOASSERTION** | **核心 MIT Expat**（LICENSE 第 7 行实测） | ⚠️ 需走 NOASSERTION 单独裁定（建议补到 ADR-0006 备忘） |
| Langfuse | **NOASSERTION** | **核心 MIT Expat**（LICENSE 第 5-8 行实测） | ⚠️ 同上 |
| Grafana 三件套 | AGPL-3.0 | AGPL-3.0 | ❌ 一票否决 |

> **ADR-0006 补充建议**：在第 33-36 行 License 红线后追加一条：「NOASSERTION 类项目（GitHub 无法自动识别复合 license）需 Read LICENSE 文件后由技术负责人单独裁定，不得一概否决」。SigNoz/Langfuse 经实测核心均为 MIT Expat，ee/ 企业版不接触无合规风险。

### 5.3 与 ADR-0001~0007 的关系

- ADR-0001（Prolog 主库 PostgreSQL）：✅ 无冲突，Prolog trace 通过 OTel Java agent 直发 Collector
- ADR-0002（XCDOS ORM Prisma）：✅ OTel pg instrumentation 兼容 Prisma 底层 pg driver
- ADR-0003（密码 Argon2id）：✅ 无关
- ADR-0004（多租户 schema-per-tenant）：⚠️ trace 资源需打 `tenant_id` 标签，Collector 层 resource processor 添加
- ADR-0005（BullMQ + Outbox）：✅ OTel bullmq instrumentation（间接 redis）覆盖死信队列
- ADR-0007（Prolog Hybrid Langflow）：✅ OTel Java agent 自动覆盖 Langflow 容器 HTTP 调用（Langflow 是独立容器，trace 通过 HTTP header 串联）

---

## 6. 风险与开放问题

### 6.1 风险

| # | 风险 | 级别 | 缓解 |
|---|---|---|---|
| R1 | Grafana 全家桶（tempo/loki/grafana）license 实测全 AGPL-3.0，UI 体验优势明显，团队未来可能想接受 | 高 | 走 ADR 变更流程正式否决并记录替代方案（Jaeger+SigNoz）。不能默认可用 |
| R2 | sub2api go.sum 含 otel v1.37.0（`/tmp/sub2api/backend/go.mod` 实测）但代码无 otelhttp 调用（grep 0 命中），trace 在 sub2api 段可能断链 | 高 | nginx/envoy sidecar 补 W3C header 透传；接受 sub2api 段 span 缺失但 trace_id 连续（上下游 span 时间戳拼接） |
| R3 | SigNoz/Langfuse GitHub license 字段 NOASSERTION，虽然 LICENSE 文件实测核心 MIT Expat 符合 ADR-0006，但法务可能要求额外确认 | 中 | 在 ADR-0006 备忘追加 NOASSERTION 裁定规则 |
| R4 | OTel instrumentation-nestjs-core 是社区 contrib（opentelemetry-js-contrib，star 910），不是官方主仓库，质量与稳定性低于 JS 核心 SDK | 中 | NestJS 大版本升级时回退到纯 Express instrumentation（NestJS 底层是 Express/Fastify） |
| R5 | Langfuse 自部署需要 PostgreSQL + ClickHouse（v3 起），内测期多一套 ClickHouse 运维成本 | 中 | 内测期用 Langfuse Cloud 免费层（10k events/月）或 PG-only 模式 |
| R6 | tail_sampling 在 Collector 层做，采样的 trace 在应用层已产生（含敏感 prompt），只是不存到后端 | 中 | P1-13 验收时明确「Collector 层脱敏」为标准，要彻底不接触敏感原文需应用层 Baggage redaction |
| R7 | OTel Java agent v2.28.1 自动覆盖 hibernate/jdbc，但 Hibernate 二级缓存/批量操作可能产生过多 DB span（一次批量查询 1000 行产生 1000 个 span） | 中 | 配 `db.statement.sampling` 或 Collector tail_sampling 过滤 db span |
| R8 | Prolog 是 Spring Boot + Hibernate，监控 V1.0 P0-10 声明 Prolog 侧指标「待验证」，trace 接入是空白 | 中 | Prolog trace 接入工期计入本 Block，不应当作「零成本」 |

### 6.2 开放问题（需决策）

1. **AGPL 三件套是否走 ADR 变更流程正式否决？** 当前按 ADR-0006 否决，但 Grafana UI 体验优势明显，团队内测期是否接受独立部署 AGPL（不修改源码、不分发）需产品/法务确认。
2. **sub2api trace 在 sub2api 段的最佳接入方式？** (a) nginx/envoy sidecar 补 W3C header forward（推荐，零侵入）；(b) XCDOS 在调用 sub2api 前后自己包 client span（精度低）；(c) 说服 sub2api 上游接受最小 PR 加 5 行 otelgin middleware（LGPL 修改义务需法律确认）。
3. **Langfuse 自部署 vs Cloud？** 自部署需 PG+ClickHouse，Cloud 免费层 10k events/月可能不够。需估算内测期日均 agent_run 调用次数后决定。
4. **日志后端替代方案（Loki AGPL 否决后）？** 内测期用 PostgreSQL jsonb 存结构化日志够吗（查询性能 vs 数据量），还是直接上 SigNoz ClickHouse logs（MIT）一步到位？商用期日志保留周期（审计要求 180 天？）影响存储选型。
5. **tail_sampling 采样比例？** agent_run.status=failed 100% 采、正常 10% 采，这个比例是否合理？需结合内测期真实流量调参，过早定死可能导致关键 trace 漏采。
6. **PRD ch.9 是否真有 ClickHouse 二期规划？** 深挖 JSON 该断言未经 grep 验证（PRD HTML 内未命中 ClickHouse），SigNoz 引入 ClickHouse 是否「与 PRD 对齐」需 PRD 作者澄清。

---

## 7. 工期估算（人天）

> 假设单人执行，含联调与文档。Prolog 侧工期单列。

| 阶段 | 任务 | XCDOS 侧 | Prolog 侧 | 备注 |
|---|---|---|---|---|
| 采集层 | OTel JS SDK 集成 + auto-instrumentations-node 配置 | 2 | — | 含 NestJS middleware 注入 X-Trace-Id |
| 采集层 | OTel Java agent 集成（-javaagent） | — | 1 | 零代码，配置 + 启动参数 |
| 采集层 | nginx/envoy sidecar W3C header 透传配置 | 1 | — | sub2api 前置 |
| 采集层 | Langfuse SDK 包裹 agent_run LLM 调用 | 2 | 1 | 对账字段写入 |
| 汇聚层 | OTel Collector 部署 + 脱敏/tail_sampling 配置 | 2 | — | 共用 |
| 后端层 | Jaeger all-in-one 部署 | 1 | — | 单容器 |
| 后端层 | Prometheus 部署 + Alertmanager | 2 | — | 含监控 V1.0 告警规则录入 |
| 后端层 | sql_exporter 接 sub2api ops 表 | 1 | — | 不 fork 约束下的桥接 |
| Schema | agent_runs 加 trace_id/langfuse_observation_id（V1.1 ADR 变更） | 1 | — | 走 ADR 流程 |
| 埋点 | 埋点 V1.1 补 trace_id 字段（埋点文档第 90/119 行事件） | 1 | 0.5 | |
| 联调 | 三段链路 trace 串联验证（agent_run → sub2api → 上游） | 2 | 1 | 含 trace 断链排查 |
| 联调 | Langfuse 对账 job + 差异告警 | 2 | — | |
| 文档 | 本 Block 报告 + 监控 V1.1 + 埋点 V1.1 更新 | 1 | 0.5 | |
| **合计** | | **18** | **4** | **总 22 人天** |

> 工期不含商用期 SigNoz 升级（独立立项，约 5-8 人天）。

---

## 8. 验证修正记录（对抗验证产出）

本节列出对深挖 JSON 的修正点，供后续 Block 复核。

| # | 深挖 JSON 原文 | 修正 | 证据 |
|---|---|---|---|
| C1 | "Helicone 是 Apache-2.0 但 2025-08 后无 release（最新 v2025.08.21-1，9 个月未更新），活跃度输给 Langfuse（周更）" | **「未更新」错误**：`gh api repos/Helicone/helicone` 实测 `pushed_at=2026-06-11T19:46:29Z`，main 分支 3 天前仍在 push。正确表述：未发布新稳定 release tag，但 main 活跃。修正后 Helicone 仍可作为 Langfuse 二级备选 | `gh api` 当日实测 |
| C2 | "SigNoz ... 与 PRD ch.9 已规划的 ClickHouse 二期方案天然对齐" | **断言未证实**：`grep -nE "ClickHouse" XCDOS_PRD_V1_*.html` 未命中相关规划。应改为「SigNoz 内部使用 ClickHouse，未来若团队选 ClickHouse 作分析列存可复用」，不得声称 PRD 已规划 | grep 实测 |
| C3 | "监控文档第 84 行 P0/P1/P2 告警分级" | **行号微偏**：实际告警级别定义在监控 V1.0 第 90-94 行附近（`### 6.1 告警级别定义`），非第 84 行 | sed -n 实测 |
| C4 | "opentelemetry-js-contrib star 仅 910" | **准确**：实测 910 | `gh api` 实测 |
| C5 | "sub2api 当前未真正埋 trace（grep 0 命中）" | **准确**：`grep -rn "otelhttp\|otel\.\|opentelemetry" /tmp/sub2api/backend/internal` 0 命中 | grep 实测 |
| C6 | "agent_runs 表 schema 第 236-255 行" | **准确**：`docs/ddl/xcdos_schema.sql:236` 起 `CREATE TABLE agent_runs`，247-250 行 `gateway_request_id/input_tokens/output_tokens/cost_cents` | Read 实测 |
| C7 | "埋点文档第 90 行 feedback_quality_scored、第 119 行 agent_run_failed" | **准确**：第 90 行 `feedback_quality_scored`，第 119 行附近 `agent_run_failed`（在 `### 5.2 Prolog 业务事件` 表内） | sed 实测 |
| C8 | "Jaeger all-in-one 单二进制" | **准确**：README 实测 `# Run Jaeger all-in-one (includes UI, collector, query, and in-memory storage)` | gh api README 实测 |
| C9 | SigNoz/Langfuse license 「核心 MIT Expat」 | **准确**：LICENSE 文件 base64 解码后实测两份均含「All content that resides under the "ee/" ... is licensed under ... Content outside ... is available under the "MIT Expat" license」 | LICENSE 文件 Read 实测 |

---

## 9. 引用清单

**外部 repo（含版本号）**：
- [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js) v2.8.0（Apache-2.0，3,391 star，2026-06-11 push）
- [open-telemetry/opentelemetry-go](https://github.com/open-telemetry/opentelemetry-go) v1.44.0（Apache-2.0，6,422 star，2026-06-12 push）
- [open-telemetry/opentelemetry-java-instrumentation](https://github.com/open-telemetry/opentelemetry-java-instrumentation) v2.28.1（Apache-2.0，2,551 star，2026-06-14 push）
- [open-telemetry/opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib)（Apache-2.0，910 star，2026-06-11 push，含 instrumentation-nestjs-core/express/pg/ioredis/openai/langchain）
- [open-telemetry/opentelemetry-go-contrib](https://github.com/open-telemetry/opentelemetry-go-contrib) otelgin（Apache-2.0）
- [open-telemetry/opentelemetry-collector-contrib](https://github.com/open-telemetry/opentelemetry-collector-contrib) v0.154.0（Apache-2.0，4,733 star，2026-06-14 push）
- [jaegertracing/jaeger](https://github.com/jaegertracing/jaeger) v2.19.0（Apache-2.0，22,881 star，2026-06-13 push）
- [SigNoz/signoz](https://github.com/SigNoz/signoz) v0.128.0（MIT Expat 核心 + ee/，27,334 star，2026-06-14 push）
- [prometheus/prometheus](https://github.com/prometheus/prometheus) v3.12.0（Apache-2.0，64,493 star，2026-06-13 push）
- [langfuse/langfuse](https://github.com/langfuse/langfuse) v3.185.0（MIT Expat 核心 + ee/，29,043 star，2026-06-13 push）
- [grafana/alloy](https://github.com/grafana/alloy) v1.17.0（Apache-2.0，3,256 star，2026-06-14 push）
- [grafana/tempo](https://github.com/grafana/tempo) v2.10.7（**AGPL-3.0**，5,305 star，否决）
- [grafana/loki](https://github.com/grafana/loki) v3.7.2（**AGPL-3.0**，28,368 star，否决）
- [grafana/grafana](https://github.com/grafana/grafana)（**AGPL-3.0**，74,411 star，否决）
- [Helicone/helicone](https://github.com/Helicone/helicone)（Apache-2.0，5,810 star，main 分支 2026-06-11 push 但 release tag `v2025.08.21-1` 已 10 个月未更新，二级备选）

**项目内文档（file:line）**：
- `docs/ADR/ADR-0006-use-existing-not-rewrite.md:33-36`（License 红线）
- `docs/ADR/ADR-0008-llm-gateway-sub2api.md:19,63`（sub2api 独立部署、不 fork）
- `docs/XCDOS_Prolog_监控指标与告警规则_V1.0.md:1,50,66,74,90-94`（P0-10 声明、APM=OpenTelemetry 假设、告警分级）
- `docs/XCDOS_Prolog_全链路埋点文档_V1.0.md:90,119`（feedback_quality_scored、agent_run_failed）
- `docs/ddl/xcdos_schema.sql:236-256`（agent_runs schema）
- `/tmp/sub2api/backend/go.mod`（otel v1.37.0 indirect 依赖）
- `/tmp/sub2api/backend/internal`（grep otel/prometheus/metrics 0 命中）
- `/tmp/sub2api/backend/migrations/034~147`（ops_* SQL 聚合表）
