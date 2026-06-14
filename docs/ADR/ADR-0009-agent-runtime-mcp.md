# ADR-0009：Agent Runtime 采用 MCP 协议 + 自建 BullMQ 状态机（OpenAI Agents JS 降为可选薄层）

- **Status**：Accepted
- **Date**：2026-06-14
- **Decision Makers**：技术负责人 / 产品负责人 / 安全负责人
- **阶段限定**：仅适用于 MVP 内测期（内部使用）；正式商用/外发前须重评
- **依据**：[Block E 对抗验证结论](../RESEARCH/block-e-agent-runtime-mcp.md)（10 候选实测，MCP TS SDK 1.29.0 锁版）

## Context

XCDOS（NestJS+Prisma+PostgreSQL）的 Agent 能力（拆解 / 评估 / 报告 / 反馈质量评估）需要一套 Agent Runtime，承担 6 阶段生命周期 `Intent → Context → Plan → Tool → Verify → Commit`，并在 L3+ 操作触发人工确认（HITL）。Prolog（Spring Boot）的 F-017 规则聚类、F-018 规则自动生成同样依赖 LLM + 工具调用。

现状缺口（实查文档，Block E §1）：

- **设计层已有、实现空**：ARD V2 已定义 Agent Runtime 架构、L1-L5 权限分级、Tool Router / Policy Guard / Trace Logger（`XCDOS_ARD_V2_领域模型_DDD_AgentRuntime_ER_EventStorming.html:272-308`），并在第 504 行推荐技术栈 "Workflow: Temporal / BullMQ / 工作流状态机"；LLD V1.0 已定义 `AgentRunService.startRun → BullMQ`、`AgentRunProcessor`（CONTEXT_BUILDING → PLANNING → TOOL_CALLING → VERIFYING）、`ToolRouter.route`（L1-L5 校验）、`PolicyGuard.checkPermission`。
- **数据层已存在**：`agent_runs` 表已含 `status / trace_id / tool_calls(JSONB) / llm_account_id / gateway_request_id / input_tokens / output_tokens / cost_cents / upstream_type`（`docs/ddl/xcdos_schema.sql:236-257`，已对齐 Block E 修正：`status` 含 `awaiting_approval`，`trace_id` 已补）。
- **工具协议层完全空**：ARD V2 提到 Tool Router 但未定协议。MCP（Model Context Protocol）是业界标准化候选。
- **安全约束（硬边界）**：Agent 权限走 L1-L5 策略表（`docs/XCDOS_Prolog_安全设计文档_V1.0.md:172-184`），L5 操作代码层 `return 403 before agent_runs 写入`；L3-L4 须人工确认。

评审阶段痛点：需要在多种 Agent 框架（Temporal / OpenAI Agents JS / LangGraph JS / AutoGen / CrewAI / LlamaIndex / SK Java / Spring AI / 自建）之间做选型，且必须与 ADR-0005（BullMQ+Outbox）、ADR-0006（能用现成就不要自己造）、ADR-0008（sub2api 作 LLM 网关、不 fork 守 LGPL）对齐。

## Decision

**三层选型：工具协议层用 MCP TS SDK 1.29.0（MIT）；编排层用自建 BullMQ 状态机（对齐 LLD V1.0 `AgentRunProcessor` 4 阶段）；Agent 抽象层 OpenAI Agents JS 降为可选薄层（0.x 未 GA）。Prolog 侧用 Spring AI v2.0.0。**

### 架构分层

```
用户/定时器 → POST /api/agent-runs
  → AgentRunService.startRun (写 agent_runs.status=running + outbox)
  → BullMQ Job → AgentRunProcessor
    → Context/Plan  (LLM via sub2api, tool_calls 经 MCP)
    → Tool Calling   (MCP tools, PolicyGuard 校验 L1-L5)
    → Verify         (PolicyGuard + Guardrails)
    → 若 L3+ → status=awaiting_approval + outbox 发布 human_approval_required
       → 前端确认按钮 → 写 hitl_approved_by + outbox.approved
       → BullMQ delayed job 续跑 (超时=timeout_escalated)
    → Commit (DB + outbox, status=succeeded)

L5 操作：NestJS Guard 层硬 return 403，不进入编排流程
```

### 主选（XCDOS / NestJS）

| 层 | 组件 | 版本（实测 2026-06-14） | 理由 |
|---|---|---|---|
| 工具协议层 | MCP TS SDK `@modelcontextprotocol/sdk` | `1.29.0`（锁版，2.0-alpha 不用） | 直击 ARD V2 Tool Router 痛点；TS 一等公民；MIT 合规（仓库正过渡 Apache-2.0 双许可，均在 ADR-0006 直通区）；已有 NestJS 社区桥 `@rekog/mcp-nest`、`@nestjs-mcp/server` |
| 编排层 | 自建 BullMQ 状态机 | 基于 `agent_runs.status` + `outbox_events` | **完全对齐 LLD V1.0 现有 `AgentRunProcessor` 4 阶段设计**，非新造轮子；ARD V2 第 504 行推荐栈含 BullMQ；KISS/YAGNI；零新运行时 |
| Agent 抽象层 | OpenAI Agents JS（**可选**，薄封装隔离 0.x 风险） | `0.11.6`（0.x 未 GA） | Agent/Tool/Handoff/Guardrails 概念与 ARD 对应；但 0.x + 厂商绑定 OpenAI，**降为可选**——M3 可先用裸 fetch+tool_calls 经 sub2api，等 Agents JS GA 再接入 |

### 备选（规模化升级路径）

**Temporal TS SDK `@temporalio/client@1.18.1`（MIT）** — 不在 M3 引入（需独立 Server 集群，违反 YAGNI）。当编排复杂度溢出（分支/并行/子图/补偿/长事务 + 大量 L4 审批）时升级。升级路径平滑：OpenAI Agents JS 已有 Temporal 官方集成；BullMQ Job 可逐步迁移到 Temporal Workflow。**触发条件**：L4 审批日均 > 1000 次，或出现需补偿的分布式事务。

### 明确弃用

- **AutoGen / CrewAI / LlamaIndex**：纯 Python + 模型错配（XCDOS 是单 Agent 走结构化决策流程，不是多 Agent 对话/角色扮演/RAG）；AutoGen 根 LICENSE 为 CC-BY-4.0（非代码友好）。
- **Semantic Kernel Java**：268 star，2026-05 后低活跃。
- **LangGraph JS**：3.01k star，Python 版的 1/11，二等公民。

### Prolog 侧（Spring Boot）并行建议

**Spring AI `v2.0.0`（Apache-2.0，2026-06-12 GA）**：Spring 原生，`mcp/` 子模块实测存在（MCP Client 支持）；ChatClient + @Tool + Advisor（=Guardrail）；F-017/F-018 规则聚类/自动生成走 Spring AI + pgvector。与 XCDOS 共用 MCP tools 仓库（decision/forecast/roi skills 双系统复用），MCP 协议层互通。

### 职责边界 — Runtime vs sub2api（对齐 ADR-0008）

- sub2api（Go/Gin，LGPL-3.0，独立容器，不 fork）= LLM 网关：账号池/计费/转发/限流/tool_calls 透传。不碰编排。
- XCDOS Agent Runtime（NestJS，MIT 栈）= 编排：6 阶段 + L1-L5 策略 + HITL。通过 sub2api 调 LLM，不直连厂商。
- 编排层的 MCP 多步 tool 结果回灌与 sub2api 转发层的 tool_calls 透传不重叠，但需端到端联调（验证 silent refusal 续传不丢工具结果）。

### HITL 三层实现

| 层 | 实现 | 适用阶段 |
|---|---|---|
| L1-L2 | 直接执行，不暂停 | M3 起步 |
| L3-L4 | `status=awaiting_approval` + outbox 事件 + 前端确认 + BullMQ delayed job 超时升级 | M3 起步 |
| L5 | NestJS Guard 层硬 `return 403` **before** agent_runs 写入（安全文档 7.1） | 永不进编排流程 |
| 规模化 | 迁移 Temporal：审批=Signal，超时=Timer | L4 日均 > 1000 次 |

## Consequences

### Positive

- 编排层零新运行时：完全复用 ADR-0005 的 BullMQ + outbox_events，对齐 LLD V1.0 `AgentRunProcessor` 4 阶段，符合 ADR-0006 "能用现成就不要自己造"。
- 工具协议层标准化：MCP 是 Anthropic 主推、社区快速跟进的事实标准，TS 一等公民；XCDOS / Prolog 双系统通过 MCP tools 仓库复用（decision/forecast/roi skills）。
- License 全清：MCP（MIT/Apache-2.0 双许可）、Spring AI（Apache-2.0）、BullMQ/Temporal（MIT）均在 ADR-0006 直通区。
- 与 sub2api 编排/转发边界清晰，LGPL 不传染。
- HITL 回路天然落在 `awaiting_approval` 状态 + outbox 事件，与现有事件投递机制同构。
- 关闭 Block E 风险 R6/R7：`status` 枚举已扩 `awaiting_approval`（`xcdos_schema.sql:241`），`trace_id` 已补（`xcdos_schema.sql:245`）。

### Negative

- **OpenAI Agents JS 0.x 未 GA**（R1）：M3 不强依赖；薄封装隔离；回退裸 fetch+tool_calls。
- **MCP 2.0-alpha 开发中**（R2）：1.x→2.x 可能 breaking。锁 `1.29.0`，抽象层隔离。
- **自建状态机崩溃恢复/幂等/trace 需自证**（R3）：Temporal 免费送的 durable execution / signal / timer 自建要写；M3 验证不过则升 Temporal。
- **`@rekog/mcp-nest` 社区桥维护风险**（R4）：必要时自维护薄封装。
- **sub2api silent refusal 续传与 MCP 多步回灌冲突**（R5）：需端到端联调。
- **L4 审批超时策略未定义**（R8）：安全文档 7.1 只说"强制人工确认"，超时分支（自动驳回 / 升级上级 / 配置化）需产品+安全裁决。
- **Spring AI v2.0.0 刚 GA**（R9，2026-06-12）：生产前稳定性需验证。
- **新增运维组件**：MCP server 注册中心（`mcp_servers` 表）需纳入监控；trace_id 串联 OpenTelemetry 需落地。

## Alternatives Considered

| 方案 | 结论 | 理由 |
|---|---|---|
| Temporal TS SDK 作编排层 | 保留为 L4 规模化升级路径 | Durable execution + Signal/Timer 强，但需独立 Server 集群，M3 引入违反 YAGNI；触发条件 L4 审批日均 > 1000 次 |
| OpenAI Agents JS 作核心抽象层 | 否决（降为可选） | 0.x 未 GA（v0.11.6）+ 厂商绑定 OpenAI，限制 sub2api 多账号灵活性；Guardrails 概念 NestJS 自己用 Guard 拦截器就能实现，不必要引入第三方抽象 |
| LangGraph JS | 否决 | 3.01k star，Python 版的 1/11，二等公民；若团队强 Python 可考虑跨语言 RPC，否则不用 |
| Microsoft AutoGen | 否决 | 纯 Python + 模型错配（单 Agent 决策流程非多 Agent 对话）；根 LICENSE 为 CC-BY-4.0（非代码友好） |
| CrewAI | 否决 | 纯 Python；角色 Play 多 Agent 模型错配 |
| LlamaIndex | 否决 | RAG 强项，Agent/Workflow 后加；纯 Python 模型错配 |
| Semantic Kernel Java | 否决 | Java 子仓 268 star，2026-05 后低活跃 |
| 从 0 自造编排 + 私有工具协议 | 否决 | 重复造轮子，违反 ADR-0006；工具协议自造无生态复用 |
| M3 一步到位上 Temporal | 否决 | KISS；先 BullMQ 验证"拆-推-评-算"闭环再升 |

## Related

- 依据：[Block E 对抗验证报告](../RESEARCH/block-e-agent-runtime-mcp.md)（10 候选实测，含 3 处深挖修正：Temporal 版本 v1.18.1、sub2api license LGPL-3.0、status 枚举对齐 TC-PERM-007）
- 相关 ADR：[ADR-0005](./ADR-0005-workflow-bullmq-outbox.md)（BullMQ+Outbox，编排层复用）、[ADR-0006](./ADR-0006-use-existing-not-rewrite.md)（能用现成就不要自己造）、[ADR-0008](./ADR-0008-llm-gateway-sub2api.md)（sub2api LLM 网关，LGPL 边界）
- 安全：[安全设计文档](../XCDOS_Prolog_安全设计文档_V1.0.md) §7.1 L1-L5 权限分级策略表（`:172-184`）
- DDL：`agent_runs` 表（`docs/ddl/xcdos_schema.sql:236-257`，含 `status=awaiting_approval` 与 `trace_id`）
- 设计：LLD V1.0 `AgentRunProcessor` 4 阶段、ARD V2 Agent Runtime 架构 / Tool Router / Policy Guard
- 升级触发：L4 审批日均 > 1000 次 → 迁移 Temporal（+8 人天）

## 内测期风险接受声明

项目方已知悉以下内测期风险，确认接受：

1. **OpenAI Agents JS 0.x 未 GA**：M3 仅作可选薄层，核心走裸 fetch+tool_calls 经 sub2api，0.x breaking 不阻塞主线。
2. **MCP 1.x→2.x 可能 breaking**：锁 `1.29.0`，抽象层隔离；2.0-alpha 不引入。
3. **自建状态机需自证崩溃恢复/幂等/trace**：M3 验证不通过则升 Temporal（已留升级路径）。
4. **L4 审批超时策略待裁决**：内测期默认"超时自动驳回 + 通知上级"，正式商用前由产品+安全最终裁决。
5. 进入商用/外发前，重评 OpenAI Agents JS 是否 GA、MCP 2.x 是否稳定、Spring AI v2.0.0 生产验证结论、L4 审批量级是否触发 Temporal 升级。

> 接受人：技术负责人 ______  产品负责人 ______  安全负责人 ______  日期 ______
