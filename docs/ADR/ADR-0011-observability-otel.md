# ADR-0011：可观测性栈采用 OpenTelemetry + Jaeger + Prometheus + Langfuse

- **Status**：Accepted
- **Date**：2026-06-14
- **Decision Makers**：技术负责人 / 产品负责人 / 安全负责人
- **阶段限定**：采集层 + 汇聚层 + 后端层方案在内测期与商用期通用；Langfuse 部署形态（Cloud / 自部署）与后端合并（是否升级 SigNoz 一体化）按阶段切换，详见「阶段化边界」节。

## Context

XCDOS / Prolog / sub2api 三段异构链路（NestJS+Prisma / Spring Boot+Hibernate / Go+Gin）需要统一的 Metrics + Logs + Traces 能力，且必须满足四条硬约束：

1. **三段异构链路串联**：浏览器 → XCDOS NestJS → sub2api（Go，LGPLv3）→ 上游 LLM；Prolog（Spring Boot）走独立链路但共用同一可观测后端。
2. **ADR-0006 License 红线**：`docs/ADR/ADR-0006-use-existing-not-rewrite.md:33-36`「AGPL 一票否决」「未声明 License 一票否决」。
3. **ADR-0008 不 fork sub2api**：`docs/ADR/ADR-0008-llm-gateway-sub2api.md:19,63` 禁止 fork 修改 sub2api 源码，其 trace/metric 接入只能走外部观测。
4. **LLM 专用观测**：prompt 全文 + token 成本 + 质量评分须单独承载，且与 `agent_runs` 计费字段对账（`docs/ddl/xcdos_schema.sql:248-251` `gateway_request_id / input_tokens / output_tokens / cost_cents`）。

现状缺口（逐条实测，引用 file:line）：

| 缺口 | 来源 | 影响 |
|---|---|---|
| 监控 V1.0 当前**仅覆盖 XCDOS**，Prolog 侧指标「待部署验证，阈值压测后定」 | `docs/XCDOS_Prolog_监控指标与告警规则_V1.0.md:3,5-13` | Prolog trace 接入是空白 |
| 监控 V1.0 已假设 APM = OpenTelemetry + Prometheus（性能/错误/告警分级行） | `docs/XCDOS_Prolog_监控指标与告警规则_V1.0.md:45-47,71-76,82-88` | 选型方向已锁，本 ADR 仅做落地 |
| `agent_runs.trace_id VARCHAR(64)` **已存在**（W3C traceparent，注释含「Block H / ARD M3」） | `docs/ddl/xcdos_schema.sql:245` | DB → Jaeger 跳转的 join key 已就绪，**无需 V1.1 ADR 变更新增 trace_id**；仅需补 `langfuse_observation_id`（见 Consequences） |
| sub2api 源码实测零 OTel / prometheus 调用，仅 `ops_*` SQL 聚合表（migrations/034~147） | Block H 第 52 行 grep 0 命中 | sub2api 段 trace 必断链，metric 必须靠外部桥接 |
| Grafana 全家桶（tempo/loki/grafana）license 实测全 AGPL-3.0 | Block H 第 72-74 行 `gh api .license.spdx_id` 三次确认 | UI 体验最强，但触发 ADR-0006 红线，**一票否决** |
| SigNoz / Langfuse GitHub license 字段 NOASSERTION | Block H 第 68、70 行 | 需 Read LICENSE 文件后单独裁定（实测核心 MIT Expat） |

对抗验证结论（Block H 第 13-24 行「验证摘要」）：

- 深挖 JSON 9 条结论中 3 条需修正，关键修正：Helicone「未更新」错误（main 分支 2026-06-11 仍 push，仅未发稳定 release tag）、SigNoz「与 PRD ch.9 ClickHouse 对齐」未证实（PRD grep `ClickHouse` 0 命中）、sub2api 段 trace 断链确认。
- 所有候选 license / 版本号 / star 经 `gh api` 2026-06-14 当日复核。

## Decision

**采用 OpenTelemetry 官方四件套（三语言采集 + otelcol-contrib 汇聚）+ Jaeger all-in-one（trace）+ Prometheus（metric + Alertmanager）+ Langfuse（LLM 专用层）作为内测期 MVP 栈。**

```
┌───────────────────────────────────────────────────────────────┐
│ 采集层（per-process SDK，零/低侵入）                            │
│  XCDOS NestJS  → @opentelemetry/auto-instrumentations-node v2.8.0│
│                  一行 require 自动埋 Express/pg/ioredis/         │
│                  undici/NestJS-core/OpenAI/langchain            │
│  Prolog Spring → -javaagent:opentelemetry-javaagent.jar v2.28.1 │
│                  零代码侵入（自动覆盖 spring/hibernate/jdbc/     │
│                  jedis/lettuce/quartz/tomcat）                  │
│  sub2api Go    → 不动源码（守 ADR-0008 LGPL），靠 nginx/envoy    │
│                  sidecar 补 W3C traceparent 透传               │
│  Langfuse SDK  → 包裹 agent_run 的 LLM 调用，与 OTel 共享        │
│                  trace_id（v3 起支持 OTLP，与 Jaeger 同 trace） │
└───────────────────────────────────────────────────────────────┘
                            │ OTLP gRPC 4317 / HTTP 4318
                            ▼
┌───────────────────────────────────────────────────────────────┐
│ 汇聚层 OTel Collector v0.154.0（otelcol-contrib 单二进制）      │
│  - attributes/redact_sensitive processor  → P1-13 脱敏落地      │
│  - tail_sampling（failed=100%, ok=10%）                         │
│  - batch + memory_limiter                → 内测期防雪崩         │
│  - resource processor                    → 打 project/tenant 标签│
│  fan-out：Jaeger / Prometheus / Langfuse（OTLP）                │
└───────────────────────────────────────────────────────────────┘
        │ Jaeger v2.19.0         │ Prometheus v3.12.0      │ Langfuse v3.185.0
        │ trace UI               │ metric + Alertmanager   │ LLM 专用
        │ Apache-2.0             │ Apache-2.0              │ MIT Expat（核心）
        │ all-in-one             │ 拉模式                  │ Cloud/自部署
```

### 组件清单（含版本号、license、repo，2026-06-14 `gh api` 复核）

| 层 | 组件 | repo | 版本 | license | 用途 |
|---|---|---|---|---|---|
| 采集 | OTel JS SDK | open-telemetry/opentelemetry-js | v2.8.0（2026-06-11） | Apache-2.0 | XCDOS NestJS 自动埋点 |
| 采集 | OTel JS Contrib | open-telemetry/opentelemetry-js-contrib | —（910 star，2026-06-11 push） | Apache-2.0 | instrumentation-nestjs-core/express/pg/ioredis/openai/langchain |
| 采集 | OTel Java agent | open-telemetry/opentelemetry-java-instrumentation | v2.28.1（2026-05-20） | Apache-2.0 | Prolog Spring Boot -javaagent |
| 采集 | OTel Go SDK | open-telemetry/opentelemetry-go | v1.44.0（2026-05-27） | Apache-2.0 | sub2api 不 fork，仅上游/下游 client span 间接覆盖 |
| 汇聚 | otelcol-contrib | open-telemetry/opentelemetry-collector-contrib | v0.154.0（2026-06-09） | Apache-2.0 | 脱敏 / tail_sampling / fan-out |
| trace 后端 | Jaeger | jaegertracing/jaeger | v2.19.0（2026-06-03） | Apache-2.0 | all-in-one 单二进制（collector+query+UI+in-memory storage） |
| metric 后端 | Prometheus | prometheus/prometheus | v3.12.0（2026-05-28） | Apache-2.0 | 拉模式 + Alertmanager + PromQL |
| LLM 专用 | Langfuse | langfuse/langfuse | v3.185.0（2026-06-12） | **MIT Expat（核心）**+ ee/ | LLM trace / cost / score / prompt 管理，与 `agent_runs` 对账 |

> SigNoz / Langfuse 的 GitHub license 字段为 `NOASSERTION`（复合 license），经 Read LICENSE 文件实测：核心（非 `ee/` 目录）均为 MIT Expat，`ee/` 企业版不接触无合规风险。按 ADR-0006 第 33-36 行 License 红线的精神，单条 NOASSERTION 不应一票否决，需技术负责人单独裁定——本 ADR 即该裁定。

### trace 串联协议（W3C Trace Context）

1. **XCDOS NestJS 入口**生成 root span（`agent_run`），attributes 含 `agent_run.id / agent_type / trigger_type / prompt.length`。
2. **调用 sub2api 时**通过 `propagation.inject()` 注入 W3C `traceparent` 头到 HTTP 请求（`00-{trace_id}-{span_id}-01`）。
3. **sub2api 前置 nginx/envoy sidecar** 原样转发 `traceparent / tracestate` 头给上游 LLM；sub2api Go 代码不解析、不产生 span，但 trace_id 在 Jaeger UI 仍连续（sub2api 段缺 span 是已知代价，见 Consequences）。
4. **Langfuse SDK 并行记录** prompt / token / cost，与 OTel 共享同一 trace_id（v3 起 OTLP 兼容），Jaeger UI 可一键跳 Langfuse 看完整 prompt 全文。
5. **NestJS middleware 注入 `X-Trace-Id` 响应头**，前端业务埋点事件（`feedback_quality_scored / agent_run_failed`）取该头写入 `trace_id` 字段，实现业务事件层 ↔ 基础设施层关联。
6. **Prolog Spring Boot** 通过 `-javaagent` 直发同一 Collector → 同一 Jaeger。

### prompt 脱敏边界（关键安全约束）

- **prompt 全文不记入 OTel span attribute**，只记 `prompt.length` 和 `prompt.sha256`（hash）。
- **prompt 全文交 Langfuse 单独承担**：Langfuse 自部署时数据库由项目方控制访问；Cloud 模式下传输走 TLS + 项目方密钥。
- Collector `attributes/redact_sensitive` processor 二次兜底：`prompt / completion` 强制 hash、`http.request.body` 按正则 mask 手机/身份证/邮箱、`authorization` 头 delete。
- `agent_run.status=failed` 100% 采样，但失败 trace 的 prompt 也只保留 hash——P1-13 验收边界明确为「Collector 层脱敏」，彻底不接触敏感原文需应用层 Baggage redaction（内测期暂不做，记入风险）。

### sub2api 指标整合（不 fork 约束下的桥接）

sub2api 无 `/metrics` endpoint（grep `prometheus|promhttp|/metrics` 0 命中），其指标是 `ops_*` SQL 聚合表（migrations/034~147）。采用 **sql_exporter 反向桥接**：Prometheus 拉 sql_exporter → sql_exporter 自定义 query 读 sub2api 的 `ops_upstream_error_events` 等表暴露为 metric。sub2api 完全不感知，满足 ADR-0008 不 fork 约束。

### agent_runs 对账 job

每日扫描 `agent_runs` 与 Langfuse API 拉取的 observation 列表，按 `gateway_request_id` join，校验 `input_tokens / output_tokens / cost_cents` 差额，差异 > 1% 告警。对账字段 `agent_runs.trace_id`（`docs/ddl/xcdos_schema.sql:245`）已就绪，DB → Jaeger 跳转无需 schema 变更。

## Consequences

### Positive

- **全 7 项直通 ADR-0006 评估清单**（star ≥ 500、6 个月内有 commit、License 直通、与 ADR-0001~0007 无冲突、二开覆盖度低、维护方背景 CNCF/商业公司、issue 响应活跃），无 license 红线。
- **三语言采集零/低侵入**：JS 一行 require、Java `-javaagent` 零代码、Go 不 fork 走 sidecar。NestJS/Express/pg/ioredis/undici/OpenAI/langchain 全自动覆盖（js-contrib 实测命中 6 项）。
- **关闭 P1-13（敏感日志脱敏）实现层**：由 Collector `redact_sensitive` processor 承载，prompt 全文不进 OTel span。
- **关闭 P0-10 Prolog 可观测性空白**：`-javaagent` 覆盖 JVM/HTTP/Hibernate/Quartz，Prolog 监控 V1.0 第 9-12 行待验证指标获得数据源。
- **`agent_runs.trace_id` 已就绪**（`xcdos_schema.sql:245`），DB 异常行 → Jaeger UI 一键跳转，无需 schema 变更。
- **LLM 专用层与基础设施层共 trace_id**：Langfuse v3 起 OTLP 兼容，prompt 全文 + token 成本 + score 质量评分与 Jaeger 同一 trace，排障闭环。
- **license 完全规避 AGPL**：tempo/loki/grafana 三件套实测全 AGPL-3.0，本方案 Jaeger + Prometheus + Langfuse 核心 全部 Apache/MIT，不触发网络传播条款。
- **运维组件成熟度高**：Jaeger all-in-one 单二进制、Prometheus 拉模式原生服务发现，内测期部署成本可控。

### Negative

- **sub2api 段 trace 断链（已知代价）**：sub2api 源码零 OTel 调用（Block H 第 21 行 grep 0 命中），trace 在 sub2api 段没有自己的 span，仅靠 W3C header 透传保持 trace_id 连续。若业务需要 sub2api 段 span，需 envoy otel access log 补近似 span（时间戳精度低）。
- **新增 7 个运维组件**：otelcol + Jaeger + Prometheus + Alertmanager + Langfuse（+ 其依赖 PG/ClickHouse）+ sql_exporter + nginx/envoy sidecar。内测期可全部容器化部署，但运维与升级成本上升。
- **Langfuse 自部署运维成本**：v3 起依赖 PostgreSQL + ClickHouse，多一套 ClickHouse 运维。内测期可改用 Langfuse Cloud 免费层（10k events/月）规避，但数据出境合规需评估。
- **NestJS instrumentation 是社区 contrib**（opentelemetry-js-contrib，910 star）：质量与稳定性低于 JS 核心 SDK，NestJS 大版本升级时可能需回退到纯 Express instrumentation（NestJS 底层是 Express/Fastify）。
- **Hibernate 批量 span 风险**：Java agent 自动覆盖 jdbc/hibernate，一次批量查询 1000 行可能产生 1000 个 DB span，撑爆 Jaeger。需配 `db.statement.sampling` 或 Collector tail_sampling 过滤 db span。
- **`agent_runs` 需补 `langfuse_observation_id`**：trace_id 已存在，但 Langfuse observation 主键缺失，对账 job 精度受限。属 V1.1 ADR 变更范围（非本 ADR），需单独走变更流程。
- **tail_sampling 采样前 prompt 已产生**：采样在 Collector 层做，意味着采样前的 trace 已在应用层产生（含敏感 prompt hash）。内测期接受「Collector 层脱敏」为 P1-13 验收标准，彻底不接触敏感原文需应用层 Baggage redaction（后续迭代）。
- **trace_id 单点**：DB → Jaeger 跳转依赖 `agent_runs.trace_id` 非空，若 SDK 配置遗漏或 Collector 阻塞，trace_id 缺失时跳转失效。需埋点校验。

### 阶段化边界（内测期 vs 商用期）

| 维度 | 内测期（MVP，当前） | 正式商用前 |
|---|---|---|
| Langfuse 部署形态 | Cloud 免费层（10k events/月）或 PG-only 自部署 | 自部署（PG + ClickHouse）或 Cloud 付费层，按真实 agent_run 量级决定 |
| 后端整合 | Jaeger + Prometheus 分离部署 | 评估升级为 SigNoz v0.128.0 一体化（替代 Jaeger+Prometheus+日志后端三件套），运维成本降约 60%（独立立项，约 5-8 人天） |
| trace 采样比例 | failed=100% / ok=10%（保守，避免漏采关键失败） | 按真实流量调参，ok 可能降至 1%-5% |
| prompt 存储 | Langfuse Cloud（数据出境合规单独评估）或 PG-only | 自部署 ClickHouse，数据完全自主 |
| 上游凭证联动 | sub2api 订阅号转 API（违上游 ToS，仅内部使用） | 切换为官方 API Key（合规，详见 ADR-0008 阶段化表） |

> SigNoz 引入 ClickHouse 不应被描述为「与 PRD ch.9 对齐」——`grep -nE "ClickHouse" XCDOS_PRD_V1_*.html` 0 命中，PRD 未规划 ClickHouse。正确表述：SigNoz 内部使用 ClickHouse，未来若团队选 ClickHouse 作分析列存可复用。

## Alternatives Considered

| 方案 | 结论 | 理由 |
|---|---|---|
| Grafana 全家桶（tempo/loki/grafana） | 否决 | 三仓库 license 实测全 AGPL-3.0，触发 ADR-0006 第 36 行「AGPL 一票否决」。SaaS 部署触发网络传播条款，污染 XCDOS 主产品。UI 体验优势明显但 license 红线不可逾越 |
| Grafana Alloy | 否决 | 自身 Apache-2.0，但 trace 后端只能配 Tempo（AGPL）/log 后端只能配 Loki（AGPL），绑定陷阱，引入即实质绑定 AGPL 后端 |
| SigNoz 一体化（替代 Jaeger+Prometheus） | 保留为商用期升级方案 | 核心 MIT Expat，OTel-native，ClickHouse 列存，Logs+Metrics+Traces 同一 UI。内测期流量未稳定时不上，避免过早绑定 ClickHouse 运维 |
| Helicone（替代 Langfuse） | 二级备选 | Apache-2.0 合规，但未发布新稳定 release tag（最新 `v2025.08.21-1`，10 个月未更新；main 分支 2026-06-11 仍活跃），功能弱于 Langfuse（无 prompt 版本管理、无 score API）。Langfuse 失效时启用 |
| 自建 trace 后端 | 否决 | 违反 ADR-0006「能用现成就不要自己造」 |
| sub2api 内嵌 otelgin middleware | 否决 | 触碰 sub2api 源码 = fork，违反 ADR-0008 第 63 行「禁止 fork 修改其源码」，且 LGPLv3 修改义务需法律确认 |

## Related

- 必读依据：[Block H 可观测性选型报告](../RESEARCH/block-h-observability-tracing.md)（含对抗验证修正记录第 401-416 行）
- 现状对齐：
  - `docs/XCDOS_Prolog_监控指标与告警规则_V1.0.md:3,5-13,45-47,71-76,82-88`（P0-10 Prolog 待验证、APM=OTel 假设、P0/P1/P2 告警分级）
  - `docs/ddl/xcdos_schema.sql:236-256`（`agent_runs` schema，trace_id 已存在第 245 行）
- 相关 ADR：
  - [ADR-0006](./ADR-0006-use-existing-not-rewrite.md)（License 红线，第 33-36 行）
  - [ADR-0008](./ADR-0008-llm-gateway-sub2api.md)（sub2api 独立部署、不 fork，第 19、63 行）
  - ADR-0001~0005、0007（技术栈无冲突，详见 Block H 第 340-346 行逐项验证）
- 关闭评审项：P1-13（敏感日志脱敏，由 Collector redact_sensitive 承载）、P0-10（Prolog 可观测性空白，由 Java agent 承载）
- 衍生文档：sub2api 段 W3C header 透传详细方案见衍生 block-h2 文档；埋点 V1.1 需在业务事件属性列补 `trace_id`（`feedback_quality_scored / agent_run_failed`）
- Schema 变更：`agent_runs` 新增 `langfuse_observation_id VARCHAR(64)`（V1.1 ADR 变更范围，非本 ADR）

## 内测期风险接受声明

项目方已知悉以下内测期风险并确认接受：

1. **sub2api 段 trace 无 span**：仅靠 W3C header 透传保持 trace_id 连续，sub2api 内部耗时无法在 Jaeger UI 内部分解。需排障时改用 envoy otel access log 补近似 span（精度低）或临时直连 sub2api 日志。
2. **Langfuse 数据存储位置**：若用 Cloud 免费层，prompt 全文数据出境，需结合数据合规清单评估；若用 PG-only 自部署，丢 ClickHouse 列存查询性能。
3. **tail_sampling 采样前 prompt hash 已产生**：Collector 层脱敏是 P1-13 验收标准，要彻底不接触敏感原文需应用层 Baggage redaction（后续迭代）。
4. **Prolog trace 接入有工期**：Java agent 配置 + Prolog 侧联调约 4 人天（Block H 第 383-395 行工期表），不当作零成本。
5. **NestJS instrumentation 是社区 contrib**：NestJS 大版本升级时可能需回退到纯 Express instrumentation。

> 接受人：技术负责人 ______  产品负责人 ______  安全负责人 ______  日期 ______
