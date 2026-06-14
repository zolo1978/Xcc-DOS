# Block H2 — sub2api 段 W3C trace 透传方案（不 fork 落地补缺）

- **Block 编号**：H2 — sub2api 段 trace 补缺（Block H 第 5 节衍生）
- **阶段**：MVP 内测期（ADR-0008 阶段限定）；商用期方案备选
- **作者**：Block H2 衍生方案 subagent
- **最后更新**：2026-06-14
- **状态**：待评审（最小可落地方案，已对齐 ADR-0011 第 82-89 行 trace 串联协议）
- **关联 ADR**：
  - [ADR-0008](../ADR/ADR-0008-llm-gateway-sub2api.md)（sub2api 独立部署、不 fork，第 19、63 行）
  - [ADR-0011](../ADR/ADR-0011-observability-otel.md)（可观测性栈，trace 串联协议第 82-89 行，sub2api 段断链 Negative 第 121 行）
  - [ADR-0006](../ADR/ADR-0006-use-existing-not-rewrite.md)（License 红线第 33-36 行，否决 sub2api 改源码）
- **关联文档**：
  - [Block H 选型报告](./block-h-observability-tracing.md)（第 52 行 grep 实测 0 命中、第 193 行工程化解法）
  - [sub2api 二开调研报告](./sub2api-二开调研报告.md)（OpenAI 兼容端点 100% 复用第 286-304 行）
  - `docs/ddl/xcdos_schema.sql:236-256`（`agent_runs.trace_id` 第 245 行已就绪）

---

## 0. 一句话结论

**sub2api 段 trace 不靠改源码补全（守 ADR-0008 LGPL 不 fork），而是靠「XCDOS NestJS inject W3C traceparent 头 → nginx/envoy sidecar 透传 → 上游 LLM」三层 header 透传保证 trace_id 连续，sub2api 段自身 span 缺失作为已知代价接受；内测期排障需要 sub2api 段近似 span 时，启用 envoy otel access log 补 span（精度低但可定位耗时档位）。**

落地工期 1 人天（nginx 配置 + 验证），与 Block H 第 380-395 行工期表「采集层 nginx/envoy sidecar W3C header 透传配置 1 人天」一致。

---

## 1. 问题复述（为什么 sub2api 段 trace 是断点）

### 1.1 链路拓扑

```
用户浏览器 → XCDOS Next.js（前端埋点）
  → XCDOS NestJS（OTel JS SDK root span: agent_run）             [Span A: 产生]
    → sub2api HTTP（Go + Gin，LGPLv3 独立部署，不 fork）          [Span ?: ???]
       → 上游 LLM（Claude/OpenAI/Gemini，订阅号转 API）            [Span B: 产生]
    ← Langfuse SDK 并行记 prompt/token/cost
```

### 1.2 断链根因（实测）

| # | 证据 | 来源 |
|---|---|---|
| 1 | sub2api `go.sum` 含 `go.opentelemetry.io/otel v1.37.0`（indirect 依赖，被上游框架拉入） | `/tmp/sub2api/backend/go.mod` |
| 2 | sub2api `backend/internal` 全量 `grep -rn "otelhttp\|otel\.\|opentelemetry"` **0 命中** | Block H 第 52 行实测 |
| 3 | sub2api 无 `/metrics` endpoint，`grep "prometheus\|promhttp\|/metrics"` 0 命中 | Block H 第 266 行实测 |
| 4 | sub2api 日志走 `ops_*` SQL 聚合表（`migrations/034~147`），不产 OTel span | sub2api 二开报告第 143-150 行 |

**结论**：sub2api 进程内部**不解析、不产生、不上报任何 OTel span**。如果不做任何处理，XCDOS 在 `agent_run.sub2api_call` span 结束后，下一个 span 直接是「上游 LLM 的 client span」（如果上游 LLM 支持 OTel）或**根本无下游 span**（上游 LLM 多数不支持 OTel）。trace 在 sub2api 段会出现「黑盒」：只知道进和出的总耗时，不知道 sub2api 内部调度/限流/熔断各阶段耗时。

### 1.3 硬约束（不可逾越）

| # | 约束 | 来源 | 影响 |
|---|---|---|---|
| C1 | **禁止 fork 修改 sub2api 源码** | ADR-0008 第 63 行 | sub2api 内嵌 otelgin middleware / 改 Go 源码加 OTel 调用 = 触发 LGPLv3 修改义务，业务代码被迫开源。否决 |
| C2 | **License 红线**（AGPL 一票否决、未声明 License 一票否决） | ADR-0006 第 33-36 行 | sub2api 是 LGPLv3，独立部署 + 网络调用 = 聚合关系，不传染业务代码（ADR-0008 已裁定合规） |
| C3 | **agent_runs.trace_id 已存在** | `docs/ddl/xcdos_schema.sql:245` | DB → Jaeger 跳转 join key 就绪，无需 V1.1 schema 变更 |
| C4 | **sub2api OpenAI 兼容端点 100% 复用** | sub2api 二开报告第 286-304 行 | 端点 `/v1/chat/completions`、`/v1/messages` 不改，HTTP header 透传是唯一接入面 |

---

## 2. 方案对比（三选一）

| # | 方案 | 是否触碰 sub2api 源码 | trace_id 连续 | sub2api 段 span 精度 | 工期 | 结论 |
|---|---|---|---|---|---|---|
| 1 | **XCDOS inject W3C traceparent 头 + nginx/envoy sidecar 透传** | 否 | ✅ 连续 | ❌ 无（黑盒） | 1 人天 | **内测期主选（推荐）** |
| 2 | 方案 1 + envoy otel access log 补近似 span | 否（仅外部观测） | ✅ 连续 | ⚠️ 低（仅入口/出口耗时，无内部阶段） | +1 人天 | 排障时启用（备选增强） |
| 3 | sub2api 改源码加 otelgin middleware（5 行） | **是（fork）** | ✅ 连续 | ✅ 高 | +3 人天 + 法律确认 | **否决**（违 ADR-0008 第 63 行、C1） |

> 方案 3 的诱惑：sub2api `go.sum` 已有 otel v1.37.0 indirect 依赖，加 5 行 `otelgin.Middleware(app)` 即可让 sub2api 段产生完整 span。但触碰源码 = fork = LGPLv3 修改义务传染，且 ADR-0008 第 63 行明确「禁止 fork 修改其源码」。即使只是「加 5 行」也构成「修改」，必须 LGPL 开源。**法律风险 > 工程收益**，否决。

---

## 3. 主选方案：Header 透传（最小可落地）

### 3.1 原理：trace_id 连续 ≠ 段 span 完整

W3C Trace Context 协议规定：trace 通过 HTTP header `traceparent` 传递，格式：

```
traceparent: 00-{trace_id(32 hex)}-{span_id(16 hex)}-{flags(2 hex)}
             版本   trace_id           当前 span 的 id       采样标志
```

关键点：
- **trace_id 是全链路唯一标识**（32 hex），由 root span（XCDOS NestJS `agent_run`）生成。
- **span_id 是每个 span 自己的标识**，每次 `startActiveSpan` 换新。
- 上游 span 收到 `traceparent` 后，要么 `extract` 出来继续在同一 trace 下生成新 span（如 sub2api 内嵌了 otelgin），要么**原样透传给它的下游**（如 sub2api 不解析，但把 header 转发给上游 LLM）。

**sub2api 不解析 traceparent，但只要它把 header 原样转发给上游 LLM，trace_id 在 Jaeger UI 上就连续**——只是 sub2api 段没有自己的 span（黑盒）。这是方案 1 的核心。

### 3.2 三层 Header 透传链路

```
┌─────────────────────────────────────────────────────────────┐
│ 第 1 层：XCDOS NestJS（OTel JS SDK，inject traceparent）      │
│  - agent_run root span 生成 trace_id                         │
│  - 调用 sub2api 前 propagation.inject(headers)               │
│  - headers['traceparent'] = '00-<trace_id>-<span_id>-01'     │
└─────────────────────────────────────────────────────────────┘
                          │ HTTP POST /v1/chat/completions
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 第 2 层：nginx/envoy sidecar（sub2api 前置，仅转发 header）    │
│  - 收到 traceparent / tracestate 头                          │
│  - 原样 proxy_pass 转发给 sub2api:8080                       │
│  - 不解析、不修改、不剥离                                     │
│  - sub2api Go 代码不解析，但 header 仍在 request.Header 里    │
└─────────────────────────────────────────────────────────────┘
                          │ sub2api 内部转发给上游 LLM
                          │ （sub2api 的 HTTP client 默认透传所有 header）
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 第 3 层：上游 LLM（Claude/OpenAI/Gemini）                     │
│  - 收到 traceparent 头（多数不解析，但头已到达）              │
│  - 返回响应（响应头 X-Request-ID 由 sub2api 透传回 XCDOS）    │
└─────────────────────────────────────────────────────────────┘

结果：trace_id 从 Span A (NestJS) → Span B (上游 LLM client span，如启用) 连续，
      sub2api 段黑盒（无 span），但 Jaeger UI 上 trace 整体可见。
```

### 3.3 第 1 层：XCDOS NestJS 注入 traceparent（代码示例）

```typescript
// apps/xcdos-api/src/agent/infra/sub2api-client.ts
import { trace, context, propagation } from '@opentelemetry/api';

export class Sub2apiClient {
  constructor(
    private readonly baseUrl: string,   // https://sub2api/v1
    private readonly apiKey: string,    // sub2api 分发的 sk-xxx
  ) {}

  async chat(agentRunId: string, prompt: string): Promise<Sub2apiResponse> {
    const tracer = trace.getTracer('xcdos.agent');

    // 关键：在 span 内部 inject，确保 traceparent 携带当前 span_id
    return tracer.startActiveSpan('agent_run.sub2api_call', {
      attributes: {
        'agent_run.id': agentRunId,
        'llm.gateway': 'sub2api',
        'prompt.length': prompt.length,
        // 注意：prompt 全文不记 span attribute，由 Langfuse 单独记（ADR-0011 第 93-96 行）
      },
    }, async (span) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-CD-Agent-Run-Id': agentRunId,  // 业务回程对账 key
      };

      // 关键：注入 W3C traceparent / tracestate（baggage 视情况）
      propagation.inject(context.active(), headers);
      // 此刻 headers['traceparent'] = '00-<trace_id>-<span_id>-01'
      //      headers['tracestate']  = '' 或厂商扩展

      const resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4.5',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      span.setAttribute('http.status_code', resp.status);
      span.setAttribute('http.response.content_length', resp.headers.get('content-length') ?? 0);

      // sub2api 回传的对账 key（写 agent_runs.gateway_request_id，xcdos_schema.sql:248）
      const gatewayRequestId = resp.headers.get('x-request-id');
      if (gatewayRequestId) {
        span.setAttribute('sub2api.gateway_request_id', gatewayRequestId);
      }

      if (!resp.ok) {
        span.recordException(new Error(`sub2api ${resp.status}`));
        span.setStatus({ code: 2, message: `HTTP ${resp.status}` });
      }
      span.end();
      return resp.json();
    });
  }
}
```

> **OTel JS SDK 配置（必须启用 W3C TraceContext propagator）**：
> ```typescript
> // apps/xcdos-api/src/otel.ts
> import { NodeSDK } from '@opentelemetry/sdk-node';
> import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
> import { W3CTraceContextPropagator } from '@opentelemetry/core';
> import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
>
> // auto-instrumentations-node v0.55+ 默认 propagator 即 W3CTraceContextPropagator + Baggage，
> // 但显式声明避免后续版本变化导致 inject 行为漂移
> const sdk = new NodeSDK({
>   traceExporter: new OTLPTraceExporter({ url: 'http://otelcol:4318/v1/traces' }),
>   textMapPropagator: new W3CTraceContextPropagator(),
>   instrumentations: [getNodeAutoInstrumentations({
>     '@opentelemetry/instrumentation-fs': { enabled: false },
>   })],
> });
> sdk.start();
> ```

### 3.4 第 2 层：nginx sidecar 透传（配置示例）

sub2api 容器前置 nginx，**仅转发 traceparent / tracestate 头**，不做任何 OTel 解析：

```nginx
# /etc/nginx/conf.d/sub2api-proxy.conf
upstream sub2api_backend {
    server sub2api:8080;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name sub2api.internal.xcdos;

    # TLS（内测期内网证书即可，商用切正式证书）
    ssl_certificate     /etc/nginx/tls/sub2api.crt;
    ssl_certificate_key /etc/nginx/tls/sub2api.key;

    location /v1/ {
        proxy_pass http://sub2api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # ===== 关键：W3C Trace Context 头透传 =====
        # nginx 默认透传未知头（proxy_pass 不剥离），但显式声明避免未来配置漂移
        proxy_set_header traceparent $http_traceparent;
        proxy_set_header tracestate $http_tracestate;
        proxy_set_header baggage $http_baggage;

        # 业务对账头
        proxy_set_header X-CD-Agent-Run-Id $http_x_cd_agent_run_id;

        # 超时（sub2api 调上游 LLM 可能慢，预留 120s）
        proxy_connect_timeout 5s;
        proxy_send_timeout    120s;
        proxy_read_timeout    120s;

        # 上游 LLM 响应头透传（sub2api 回程的 x-request-id 用于对账）
        proxy_pass_header x-request-id;
        proxy_pass_header x-ratelimit-remaining;
    }
}
```

> **为什么 nginx 显式 `proxy_set_header`？** nginx 默认透传未在配置中声明的客户端头，但只要配置里出现过 `proxy_set_header`（如 `Host`），nginx 会**重置 header 集合**为「显式声明的头」+ 几个标准头（`Host`/`Connection`）。此时 `traceparent` 若不显式声明，会被丢弃。这是 sub2api 段断链最隐蔽的坑，必须显式列出。

### 3.5 第 3 层：上游 LLM 侧

无需任何操作。上游 LLM（Claude/OpenAI/Gemini）：
- **若支持 OTel**（罕见）：会 extract traceparent 继续生成 span，trace 完整。
- **若不支持 OTel**（多数情况）：忽略 traceparent 头，返回响应。trace 在「上游 LLM 调用」这一段无下游 span，但 XCDOS 侧的 `agent_run.sub2api_call` span 已记录 HTTP 请求/响应耗时、状态码、content-length，足够定位「上游慢」vs「sub2api 调度慢」。

> 上游 LLM 侧断链是**业界通病**，所有 LLM 网关（sub2api、one-api、LangChain 等）都有此问题。本方案不试图解决上游 LLM 段，只保证 sub2api 段不新增断点。

---

## 4. 备选增强：envoy otel access log 补近似 span（方案 2）

当排障需要「sub2api 段内部耗时分解」（如限流排队多久、粘性会话命中哪条）时，方案 1 的黑盒不够用。启用 envoy 替换 nginx，用 otel access log 补一个近似 span。

### 4.1 envoy 配置（替换 nginx）

```yaml
# /etc/envoy/envoy.yaml
static_resources:
  listeners:
  - name: listener_0
    address:
      socket_address: { address: 0.0.0.0, port_value: 443 }
    filter_chains:
    - transport_socket:
        name: envoy.transport_sockets.tls
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
          common_tls_context:
            tls_certificates:
            - certificate_chain: { filename: /etc/envoy/tls/sub2api.crt }
              private_key: { filename: /etc/envoy/tls/sub2api.key }
      filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: sub2api ingress
          codec_type: AUTO
          # ===== 关键：W3C 透传 + OTel access log =====
          tracing:
            provider:
              name: envoy.tracers.opentelemetry
              typed_config:
                "@type": type.googleapis.com/envoy.config.trace.v3.OpenTelemetryConfig
                grpc_service:
                  envoy_grpc:
                    cluster_name: otel_collector
                  timeout: 0.25s
                service_name: sub2api-sidecar   # Jaeger 上的服务名
          route_config:
            virtual_hosts:
            - name: sub2api
              domains: ["*"]
              routes:
              - match: { prefix: "/v1/" }
                route:
                  cluster: sub2api_backend
                  timeout: 120s
          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router

  clusters:
  - name: sub2api_backend
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: sub2api_backend
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address: { address: sub2api, port_value: 8080 }
  - name: otel_collector
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    http2_protocol_options: {}
    load_assignment:
      cluster_name: otel_collector
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address: { address: otelcol, port_value: 4317 }
```

envoy tracing provider 会：
1. 收到 XCDOS 发来的请求，**extract traceparent**（继承同一 trace_id）。
2. 生成 sidecar 自己的 span（`ingress` + `egress` 两个），上报到 otelcol。
3. **重新 inject** traceparent（用 sidecar 自己的 span_id）转发给 sub2api。

效果：Jaeger UI 上 sub2api 段多出 `sub2api-sidecar.ingress` 和 `sub2api-sidecar.egress` 两个 span，能看到 sub2api 进程的入口/出口耗时，但**看不到 sub2api 内部各阶段**（限流排队、账号池调度、熔断判定）。

### 4.2 方案 2 的代价

- **精度低**：sidecar span 只反映「请求进出 sub2api 进程」的墙钟时间，不含 sub2api 内部业务逻辑。要分清「限流排队 50ms」vs「上游 LLM 响应慢 50ms」仍需结合 sub2api 日志。
- **span_id 不连续风险**：envoy 重新 inject 后，sub2api 收到的 traceparent 的 span_id 是 envoy 的，不是 XCDOS 的。上游 LLM（如支持 OTel）会挂在 envoy span 下，导致 trace 树层级多一层。可通过 envoy 配置 `sampling: 100%` + 不重新 inject（仅转发）规避，但失去 sidecar 自己的 span。
- **运维组件 +1**：envoy 比 nginx 重，配置复杂度高。

> **内测期建议**：先用方案 1（nginx 透传），排障出现「sub2api 段黑盒定位不准」时再切方案 2。Block H 第 380-395 行工期表方案 2 的 +1 人天单独列项。

---

## 5. 验证方法（必过）

### 5.1 单元验证：traceparent 注入正确

```bash
# 在 sub2api 容器侧用 mitmproxy / socat 抓 XCDOS → sub2api 的请求头
# 预期：traceparent / tracestate / baggage 头存在且格式符合 W3C

# 启动抓包容器
docker run --rm --network=xcdos-net -p 8888:8080 \
  mitmproxy/mitmproxy mitmdump \
  --mode reverse:http://sub2api:8080 \
  --set headers=true \
  -w /tmp/sub2api-traffic.flow

# 触发一次 agent_run（curl XCDOS API）
curl -X POST https://xcdos/api/goals/1/breakdown \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"Q1"}'

# 检查 mitmproxy 抓到的请求头
mitmdump -nr /tmp/sub2api-traffic.flow --set headers=true | grep -iE "traceparent|tracestate|baggage"
# 预期输出：
# traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
# tracestate: <vendor>=<value>
```

### 5.2 集成验证：Jaeger UI trace 连续

```bash
# 1. 启动全栈（含 otelcol + Jaeger）
docker compose up -d xcdos-api sub2api nginx otelcol jaeger

# 2. 触发一次完整 agent_run
curl -X POST https://xcdos/api/agent-runs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"goal_id":1,"agent_type":"decision_breakdown"}'

# 3. 从响应头拿 X-Trace-Id
TRACE_ID=$(curl -sI -X POST https://xcdos/api/agent-runs ... | grep -i "x-trace-id" | awk '{print $2}' | tr -d '\r')

# 4. 在 agent_runs 表确认 trace_id 落库
psql -h pg -U xcdos -d xcdos -c \
  "SELECT id, trace_id, gateway_request_id, status FROM agent_runs WHERE trace_id='$TRACE_ID';"
# 预期：trace_id 非空，gateway_request_id 非空（sub2api 回传）

# 5. Jaeger UI 查询该 trace
open "http://jaeger:16686/trace/$TRACE_ID"
# 预期：
#   - Span A: agent_run (NestJS, root)
#     - Span A.1: agent_run.sub2api_call (NestJS, 含 http.status_code=200, sub2api.gateway_request_id)
#       - [sub2api 段无 span，黑盒，方案 1] 或
#       - [sub2api-sidecar.ingress + egress（方案 2）]
#         - [上游 LLM 段，多数无 span]
```

### 5.3 失败注入验证：错误 trace 必采

```bash
# 模拟 sub2api 502（停掉 sub2api 容器，让 nginx 返回 502）
docker compose stop sub2api

curl -X POST https://xcdos/api/agent-runs ...

# 预期：tail_sampling 的 keep_failed 策略 100% 采（ADR-0011 第 56 行）
#       agent_run.status=failed，trace_id 在 agent_runs 表非空
#       Jaeger UI 该 trace 含 http.status_code=502 的 span
```

### 5.4 验收清单（P1-13 / Block H2 联合验收）

| # | 验收项 | 验证方法 | 通过标准 |
|---|---|---|---|
| V1 | XCDOS 调 sub2api 时 traceparent 头存在 | mitmproxy 抓包 | 头格式 `00-{32hex}-{16hex}-{2hex}` 合规 |
| V2 | nginx 透传 traceparent（不剥离） | sub2api 容器内 `tcpdump` 抓请求头 | traceparent 头到达 sub2api 进程 |
| V3 | Jaeger UI trace_id 连续 | 触发 agent_run，查 Jaeger | Span A → Span A.1 在同一 trace，trace_id 与 agent_runs.trace_id 一致 |
| V4 | agent_runs.trace_id 落库 | psql 查询 | trace_id 非空，与 Jaeger 一致 |
| V5 | 失败 trace 100% 采 | 停 sub2api 触发 502 | trace 在 Jaeger 可见，含 http.status_code=502 |
| V6 | prompt 全文不进 span | Jaeger span attributes 检查 | 只有 `prompt.length`，无 `prompt` 全文（P1-13 验收） |
| V7 | （方案 2）sidecar span 存在 | Jaeger 查 trace | `sub2api-sidecar.ingress/egress` span 出现 |

---

## 6. 与已有 ADR / 文档的对齐

### 6.1 与 ADR-0011（可观测性栈）的关系

ADR-0011 第 82-89 行已定义 trace 串联协议，本方案是其在 sub2api 段的**落地细节**：

| ADR-0011 第几行 | 本方案对应节 |
|---|---|
| 第 82-83 行：root span `agent_run` 生成 | 第 3.3 节 NestJS inject |
| 第 85 行：`propagation.inject()` 注入 traceparent | 第 3.3 节代码示例 `propagation.inject(context.active(), headers)` |
| 第 86 行：nginx/envoy sidecar 原样转发 | 第 3.4 节 nginx 配置 + 第 4.1 节 envoy 配置 |
| 第 121 行：sub2api 段断链 Negative | 第 1.2 节实测证据 + 第 4 节方案 2 增强 |

### 6.2 与 ADR-0008（sub2api 不 fork）的关系

| ADR-0008 约束 | 本方案满足方式 |
|---|---|
| 第 19 行：独立部署，HTTP API 调用 | ✅ sub2api 不感知，只看到 nginx 转发的 HTTP 请求 |
| 第 63 行：禁止 fork 修改源码 | ✅ 零源码改动，所有 trace 接入在 nginx/envoy/XCDOS 侧 |
| 第 63 行：LGPLv3 聚合关系不传染 | ✅ nginx + sub2api 是独立进程，进程间通信走 HTTP header |

### 6.3 与 ADR-0006（License 红线）的关系

本方案引入的组件：
- nginx：BSD-2-Clause（[nginx LICENSE](https://github.com/nginx/nginx/blob/master/LICENSE)），直通。
- envoy：Apache-2.0（[envoyproxy/envoy LICENSE](https://github.com/envoyproxy/envoy/blob/main/LICENSE)），直通。
- OTel JS SDK：Apache-2.0（ADR-0011 第 71 行已核验）。

**全部 ADR-0006 直通区**，无 license 红线。

### 6.4 与 `agent_runs` 表的关系

`docs/ddl/xcdos_schema.sql:236-256` 已有字段：

```sql
CREATE TABLE agent_runs (
  ...
  trace_id          VARCHAR(64),   -- 第 245 行，W3C traceparent trace_id 段
  gateway_request_id VARCHAR(64),  -- 第 248 行，sub2api 回传 x-request-id，对账 key
  input_tokens      INTEGER,       -- 第 249 行
  output_tokens     INTEGER,       -- 第 250 行
  cost_cents        NUMERIC(10,4), -- 第 251 行
  ...
);
```

本方案写入流程：
1. XCDOS `agent_run` 创建时，从 OTel context 取 `trace_id` 写入 `agent_runs.trace_id`。
2. sub2api 响应头 `x-request-id` 写入 `agent_runs.gateway_request_id`。
3. （Langfuse 对账 job 按日 join，校验 input/output/cost 差额，差异 > 1% 告警——ADR-0011 第 102-104 行。）

**无需 schema 变更**。`langfuse_observation_id` 字段是 V1.1 ADR 变更范围（ADR-0011 第 126 行已声明），不在本方案。

---

## 7. 阶段化边界（内测期 vs 商用期）

参考 ADR-0008 阶段化写法，本方案按阶段切换：

| 维度 | 内测期（MVP，当前） | 正式商用前 |
|---|---|---|
| trace 透传层 | nginx（方案 1） | envoy（方案 2）或保留 nginx + 额外 OTel 网关 |
| sub2api 段 span | 黑盒（无 span，已知代价） | 评估是否启用 envoy otel access log 补近似 span |
| 上游凭证 | 订阅号转 API（违上游 ToS，仅内部使用，ADR-0008 第 47 行） | 切换为官方 API Key（合规，ADR-0008 第 48 行） |
| trace 采样 | failed=100% / ok=10%（ADR-0011 第 56 行） | 按真实流量调参，ok 可能降至 1%-5% |
| 验证范围 | V1-V6（不含 sidecar span） | 全 V1-V7 |
| 排障手段 | Jaeger trace + sub2api `ops_*` 表 | + envoy sidecar span + sub2api 慢查询日志 |

> **商用切换强制条件**（参考 ADR-0008 第 47-48 行阶段化表）：
> 1. 上游凭证从订阅号切官方 API Key（关闭 ToS 风险）。
> 2. trace 采样比例按真实流量重标（避免商用流量下 Jaeger 撑爆）。
> 3. 评估是否需要 sub2api 段 span（商用期 SLO 要求 P95 分解到 sub2api 内部阶段时启用方案 2）。

---

## 8. 风险与开放问题

### 8.1 风险

| # | 风险 | 级别 | 缓解 |
|---|---|---|---|
| R1 | **nginx `proxy_set_header` 隐性剥离**：只要配置里出现过任意 `proxy_set_header`，nginx 会重置 header 集合为「显式声明」+ 标准头，traceparent 若不显式声明会被丢弃 | 高 | 第 3.4 节配置已显式 `proxy_set_header traceparent $http_traceparent`，V1 验收抓包确认头到达 sub2api |
| R2 | sub2api 内部 HTTP client 可能不透传未知头给上游 LLM（取决于 sub2api 用 net/http 还是 fasthttp，以及是否手动构造 header） | 中 | V2 验收（sub2api 容器内 tcpdump）确认；若不透传，方案 1 trace 在 sub2api→上游这一跳仍断，但 sub2api→XCDOS 回程不影响（对账靠 x-request-id）。商用期方案 2 envoy 重 inject 兜底 |
| R3 | traceparent 的 `flags=01`（采样）位语义：OTel 默认 propagator 会把 root span 的采样决定传下去，如果 root 未采样，traceparent 仍透传但 flags=00，下游若严格按 flags 决定是否上报可能丢 span | 中 | otelcol 配 `tail_sampling` 在 Collector 层重采样（ADR-0011 第 56 行），不依赖 flags；XCDOS 侧 SDK 配 `alwaysOn` sampler 保证本地必产 span |
| R4 | 方案 2 envoy `sampling: 100%` 但 sub2api 流量大时 sidecar span 翻倍（每个请求 2 个 span），Jaeger 存储压力 | 中 | 内测期流量低，可接受；商用期按真实流量决定是否降采 |
| R5 | 上游 LLM 若严格按 W3C 拒绝未知头（罕见，但 Claude/OpenAI 偶有头白名单），返回 400 | 低 | V1 验收抓包确认上游响应非 400；若触发，nginx 配 `proxy_set_header traceparent ""`（仅在调特定上游时剥离），保留 trace 在 sub2api 段 |
| R6 | sub2api 二开时（若未来内测期需配置 sub2api 自己的 header 白名单），可能误删 traceparent | 中 | sub2api 配置变更走 PR review + V1 验收回归 |

### 8.2 开放问题

1. **sub2api 内部 HTTP client 是否透传 traceparent 给上游 LLM？** 需 V2 验收确认。若不透传，方案 1 的 trace 在「sub2api→上游 LLM」这一跳仍断（但 XCDOS→sub2api 段连续，对账靠 x-request-id 不受影响）。如业务必须 sub2api→上游段也连续，需方案 2 envoy 重 inject（覆盖 sub2api 的 header 集合）。
2. **是否需要 sub2api 段 span？** 内测期黑盒够用（agent_run.sub2api_call span 已记录总耗时、状态码）。商用期 SLO 要求 P95 分解到 sub2api 内部阶段时，方案 2 是唯一选项（不 fork 约束下）。
3. **tracestate 是否需要透传厂商扩展？** W3C tracestate 用于多厂商 trace 上下文（如 AWS X-Ray、Datadog）。内测期单厂商（自部署 OTel）tracestate 为空，透传无副作用。商用期若接入云厂商可观测，需评估 tracestate 内容。

---

## 9. 工期估算（人天）

| 阶段 | 任务 | 人天 | 备注 |
|---|---|---|---|
| 采集层 | XCDOS NestJS Sub2apiClient 注入 traceparent（第 3.3 节） | 0.5 | 含 OTel SDK propagator 显式配置 |
| 采集层 | nginx sidecar 配置 + TLS（第 3.4 节） | 0.5 | 含 V1-V2 验收抓包 |
| 验证 | V3-V6 集成验证（Jaeger trace 连续 + agent_runs.trace_id 落库） | 0.5 | 含失败注入 V5 |
| 文档 | 本 Block H2 报告 | 0.5 | 已成稿 |
| **方案 1 合计** | | **2** | Block H 第 384 行「nginx/envoy sidecar W3C header 透传配置 1 人天」是单指配置，含联调本方案 2 人天更现实 |
| 方案 2 增强 | envoy 替换 nginx + otel access log（第 4 节） | +1.5 | 排障时启用，非内测期必做 |

> 工期含在 Block H 第 380-395 行总工期 22 人天内，不额外增加。

---

## 10. 引用清单

**外部协议 / repo**：
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)（traceparent / tracestate 规范）
- [W3C Baggage](https://www.w3.org/TR/baggage/)
- [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js) v2.8.0（Apache-2.0，`@opentelemetry/api` 的 `propagation.inject`）
- [open-telemetry/opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib)（auto-instrumentations-node v0.55+，默认 W3CTraceContextPropagator）
- [nginx/nginx](https://github.com/nginx/nginx)（BSD-2-Clause，`proxy_set_header` 语义）
- [envoyproxy/envoy](https://github.com/envoyproxy/envoy)（Apache-2.0，OpenTelemetry tracer 配置）

**项目内文档（file:line）**：
- `docs/ADR/ADR-0008-llm-gateway-sub2api.md:19,47-48,63`（sub2api 独立部署、阶段化账号策略、不 fork 约束）
- `docs/ADR/ADR-0011-observability-otel.md:82-89`（trace 串联协议）、`:121`（sub2api 段断链 Negative）、`:126`（langfuse_observation_id V1.1 变更）
- `docs/ADR/ADR-0006-use-existing-not-rewrite.md:33-36`（License 红线）
- `docs/RESEARCH/block-h-observability-tracing.md:52`（sub2api grep 0 命中实测）、`:193`（sidecar 工程化解法）、`:380-395`（工期表）
- `docs/RESEARCH/sub2api-二开调研报告.md:286-304`（OpenAI 兼容端点 100% 复用）
- `docs/ddl/xcdos_schema.sql:236-256`（`agent_runs` schema，trace_id 第 245 行、gateway_request_id 第 248 行）
