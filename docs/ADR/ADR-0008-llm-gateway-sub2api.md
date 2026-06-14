# ADR-0008：LLM 网关层采用 sub2api（独立部署）

- **Status**：Accepted
- **Date**：2026-06-14
- **Decision Makers**：技术负责人 / 产品负责人 / 安全负责人
- **阶段限定**：仅适用于 MVP 内测期（内部使用）；正式商用/外发前须重评

## Context

XCDOS / Prolog 的 Agent 能力（拆解、评估、报告、规则自进化）依赖上游 LLM（Claude / OpenAI / Gemini）。当前两条路：

1. **从 0 自建网关**：账号池、计费、限流、粘性会话、SSRF 防护全自写，工期 4-8 周，新代码稳定性低。
2. **复用成熟开源**：[sub2api](https://github.com/Wei-Shaw/sub2api)（Go + Gin + Ent + Vue3 + PG15 + Redis7）已实现上述全部能力，Trendshift 收录，社区活跃。

评审阶段痛点：MVP 内测需要快速验证业务闭环，不应在 LLM 网关基础设施上投入研发。ADR-0006「能用现成就不要自己造」原则适用。

## Decision

**采用 sub2api 作为 LLM 网关基础设施层，独立部署，XCDOS / Prolog 通过 HTTP API 调用，不 fork 源码、不嵌入业务代码。**

### 架构分层

```
应用层  XCDOS (NestJS+Prisma)  /  Prolog (Spring Boot)
        域: goal/decision/task/rule/session
                    │ HTTP (sk-xxx key, OpenAI 兼容协议)
                    ▼
基础设施层  sub2api (独立容器/进程, 不改源码)
        多账号池 + Token 计费 + 限流 + 粘性会话
        + URL allowlist + SSRF 防护 + 熔断
                    │ 官方 API Key 或 订阅号
                    ▼
            Claude / OpenAI / Gemini 上游
```

### 接入方式

- sub2api 独立 Docker 容器部署，与业务库物理隔离。
- XCDOS / Prolog 的 `agent_runs` 调用 LLM 时，请求发往 sub2api 的 OpenAI 兼容端点（`/v1/messages`、`/v1/chat/completions`）。
- 业务侧只持 sub2api 分发的 `sk-xxx` Key，不直接接触上游凭证。
- 计费/用量数据由 sub2api 回调或定期拉取，写入 `agent_runs`。

### 账号策略（阶段化）

| 阶段 | 上游凭证 | 合规性 |
|---|---|---|
| MVP 内测（当前） | 订阅号（Claude Pro/Max 等通过 sub2api 转 API） | ⚠️ 违反上游 ToS，仅限内部使用，风险自担 |
| 正式商用前 | 切换为官方 API Key | ✅ 合规 |

## Consequences

### Positive

- 工期从 4-8 周降至 1-2 周（部署 + 接入）。
- 复用成熟代码，账号池/计费/限流/粘性会话/SSRF 防护立即可用。
- 关闭 P1-13（日志脱敏）、P1-14（Header 防篡改）的实现层——由 sub2api 承载。
- 内测期订阅号成本远低于官方 API 按量计费。
- 业务层技术栈不变（NestJS / Spring Boot），ADR-0001~0007 全部保留。

### Negative

- **ToS 风险（内测期）**：订阅号转 API 可能触发上游封号。仅限内部使用，不对外提供服务；账号封禁风险由项目自担，不影响客户。
- **License（LGPLv3）**：sub2api 独立部署 + 网络调用 = 聚合关系，非派生作品，不传染业务代码。**但禁止 fork 修改其源码**——任何对 sub2api 本体的修改须 LGPL 开源。内测如需定制，优先通过配置/插件/外部 wrapper 实现。
- **新增运维组件**：sub2api 容器 + 其依赖的 PG/Redis 需纳入监控（复用现有 PG/Redis 实例可降低成本）。
- **计费数据一致性**：业务侧 `agent_runs.cost_cents` 依赖 sub2api 回传，存在延迟与对账需求。

## Alternatives Considered

| 方案 | 结论 | 理由 |
|---|---|---|
| 从 0 自建网关 | 否决 | 工期长、稳定性低、重复造轮子，违反 ADR-0006 |
| fork sub2api 二开 | 否决 | LGPLv3 传染，业务代码被迫开源；且域模型错位（网关骨架塞企业决策系统） |
| 直连官方 API（无网关） | 保留为商用方案 | 内测期成本高，无账号池/计费/限流，MVP 验证速度慢 |
| 其他网关（one-api 等） | 备选 | sub2api 功能更全（粘性会话/SSRF/支付），Trendshift 验证 |

## Related

- 关闭评审项：P1-13（敏感日志）、P1-14（Header 篡改）实现层
- 相关 ADR：[ADR-0006](./ADR-0006-use-existing-not-rewrite.md)（能用现成就不要自己造）
- 合规：[数据合规清单](../XCDOS_Prolog_数据合规清单_V1.0.md)「内测期订阅号使用声明」节
- DDL：`agent_runs` 计费字段扩展
- 切换条件：见合规文档「退出内测、进入商用的强制切换条件」

## 内测期风险接受声明

项目方已知悉 sub2api 订阅号转 API 的上游 ToS 风险，确认：

1. 仅用于内部 MVP 验证，不对外提供服务、不收费。
2. 不将订阅号转 API 能力暴露给最终用户或客户。
3. 账号封禁风险自担，不影响客户业务。
4. 进入商用/外发前，强制切换为官方 API Key，详见合规文档。

> 接受人：技术负责人 ______  产品负责人 ______  安全负责人 ______  日期 ______
