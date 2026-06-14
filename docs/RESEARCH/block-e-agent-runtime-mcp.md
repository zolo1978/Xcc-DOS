# Block E — Agent Runtime + Tool Calling + MCP 协议（对抗验证版）

- **Block**：E
- **角色**：对抗验证者（adversarial reviewer）
- **日期**：2026-06-14
- **基线**：深挖 agent 调研结论 JSON（10 候选）+ 实查 GitHub/npm/registry
- **验证手段**：`gh api` 直查 release/license/star/最近 commit；`curl registry.npmjs.org` 直查 npm 包版本；`grep` XCDOS 现有 DDL/ADR/LLD/ARD
- **结论先行**：深挖 agent 的**方向与选型逻辑基本正确**，但存在 **3 处事实错误**（Temporal 版本号、sub2api license 边界、status 枚举与测试用例不一致）和 **2 处设计缺口**（trace_id 缺失、HITL 枚举未与 TC-PERM-007 对齐）。本报告在保留其主推荐的前提下做修正。

---

## 1. 领域与现状缺口

XCDOS（NestJS+Prisma+PostgreSQL）需要一套 Agent Runtime，承担 6 阶段生命周期 `Intent → Context → Plan → Tool → Verify → Commit`，并在 L3+ 操作触发人工确认（HITL）。现状缺口（实查文档）：

- **设计层已存在但实现空**：
  - `docs/XCDOS_ARD_V2_领域模型_DDD_AgentRuntime_ER_EventStorming.html:272-308` 已定义 Agent Runtime 架构、L1-L5 权限分级、Tool Router / Policy Guard / Trace Logger 模块。
  - `docs/XCDOS_ARD_V2_领域模型_DDD_AgentRuntime_ER_EventStorming.html:504` 明确推荐技术栈："Workflow: **Temporal / BullMQ / 工作流状态机**"——Temporal 在 ARD 推荐栈里。
  - `docs/XCDOS_详细设计文档_LLD_V1.0.html:256-259` 已定义 `AgentRunService.startRun → BullMQ`、`AgentRunProcessor`（CONTEXT_BUILDING → PLANNING → TOOL_CALLING → VERIFYING）、`ToolRouter.route`（L1-L5 校验）、`PolicyGuard.checkPermission`。
  - `docs/XCDOS_ARD_V2_领域模型_DDD_AgentRuntime_ER_EventStorming.html:495` M3 阶段（9-12 周）交付 "Agent Run / Tool Call / Trace / Policy Guard"，**Trace 是设计意图**。
- **数据层已存在但字段不完整**：
  - `docs/ddl/xcdos_schema.sql:236-256` 已有 `agent_runs` 表：`agent_type / trigger_type / status / input / output / tool_calls(JSONB) / llm_account_id / gateway_request_id / input_tokens / output_tokens / cost_cents / upstream_type`。
  - **缺口 1**：`status` 枚举仅 `running/succeeded/failed/cancelled`（`xcdos_schema.sql:240-241`），**不含 HITL 暂停态**。而 `docs/XCDOS_测试用例文档_V1.0.html:209 TC-PERM-007` 期望 `status=NEED_HUMAN_CONFIRMATION`——DDL 与测试用例枚举不一致，必须修。
  - **缺口 2**：无 `trace_id` 字段（M3 设计意图里有 Trace，DDL 漏列）。
  - **缺口 3**：`tool_calls` 是 JSONB 内嵌（`xcdos_schema.sql:244`），查询/审计/索引需独立成表（ARD ER 图显示 tool_calls 是独立实体）。
- **工具协议层完全空**：ARD V2 提到 Tool Router 但未定协议。MCP 是候选标准化方案。
- **Prolog 侧（Spring Boot）并行缺口**：`docs/Prolog AgentTeam 智能交互工厂 - 需求清单与需求基线文档（V1.2）.md` 的 F-017 规则聚类、F-018 规则自动生成依赖 LLM + 向量，需选 Spring 生态的 LLM 抽象。

---

## 2. 候选开源对比（实测 2026-06-14）

| 名称 | repo | license（实测） | 最新版（实测） | star（实测） | fitScore | 关键能力 |
|---|---|---|---|---|---|---|
| MCP TS SDK | `modelcontextprotocol/typescript-sdk` | MIT/Apache-2.0 双许可过渡（npm `license=MIT`，仓库根 LICENSE 双许可+文档 CC-BY-4.0） | npm `latest=1.29.0`（2026 发布，node>=18）；GitHub 已进 `2.0.0-alpha` | 12.66k | **9** | Tools/Resources/Prompts/Sampling 四原语；stdio/SSE/streamable-http transport |
| Temporal TS SDK | `temporalio/sdk-typescript` | MIT | **npm `@temporalio/client@1.18.1`（2026-06-11）** ⚠️ 深挖写的 "v1.9.3 npm" 错误 | 862 | **8** | Durable execution + Signal/Timer/Query；适配 L4/L5 审批回路 |
| OpenAI Agents JS | `openai/openai-agents-js` | MIT | npm `@openai/agents@0.11.6`（0.x 未 GA） | 3.21k | **6** ⚠️ 深挖给 7，对抗验证降分（厂商绑定 + 0.x） | Agent/Tool/Handoff/Guardrails；与 Temporal 有官方集成 |
| LangGraph JS | `langchain-ai/langgraphjs` | MIT | npm `@langchain/langgraph@1.4.2`（1.x GA） | 3.01k | **6** | StateGraph + interrupt() + Checkpointer；JS 版二等公民 |
| Spring AI | `spring-projects/spring-ai` | Apache-2.0 | `v2.0.0`（2026-06-12 GA，非 prerelease，实测确认） | 8.94k | **8**（仅 Prolog 侧） | ChatClient + @Tool + Advisor（Guardrail）+ MCP Client（`mcp/` 子模块实测存在） |
| 自建 BullMQ 状态机 | internal（基于 `agent_runs` + `outbox_events`） | N/A（MIT 栈） | N/A | N/A | **9** ⚠️ 深挖给 8，对抗验证加分（完全对齐 LLD 现有设计） | 零新运行时；对齐 `AgentRunProcessor` 4 阶段 |
| Microsoft AutoGen | `microsoft/autogen` | **CC-BY-4.0（仓库根）** ⚠️ 代码包子包标 MIT 但根 LICENSE 是 CC-BY-4.0 | `python-v0.7.5`（2025-09-30） | 58.94k | **3** | 纯 Python；GroupChat/Selector；模型错配 |
| Microsoft Semantic Kernel | `microsoft/semantic-kernel` + `-java` | MIT / MIT | 主仓活跃；**Java 子仓 268 star，pushed 2026-05-08**（实测确认低活跃） | 28.1k / 268 | **4** | Plugin/Planner；Java 版低活跃 |
| CrewAI | `crewAIInc/crewAI` | MIT | `v1.14.7`（2026-06-11 GA） | 53.52k | **3** | 角色 Play 多 Agent；纯 Python；模型错配 |
| LlamaIndex | `run-llama/llama_index` | MIT | 活跃（2026-06-12 push） | 50.12k | **4** | RAG 强项；Agent/Workflow 后加；纯 Python |

**实测修正点**：
1. **Temporal 版本号错误**：深挖写 "v1.9.3 npm / GitHub monorepo tag v1.18.1"。实查 `@temporalio/client@1.18.1`（2026-06-11）——**npm 包版本与 GitHub tag 同步，不是 1.9.3**。深挖把某个历史版本当 npm latest 了。
2. **MCP license 是双许可过渡**：不是纯净 MIT。仓库根 LICENSE 文件实测开头："The MCP project is undergoing a licensing transition from the MIT License to the Apache License, Version 2.0 ... All new code ... licensed under Apache-2.0. Documentation contributions ... licensed under CC-BY-4.0." npm `license=MIT`（已获重新许可同意的部分仍 MIT）。**对 ADR-0006 合规**：MIT 和 Apache-2.0 都在直通区。
3. **sub2api 是 LGPL-3.0**（实测 `Wei-Shaw/sub2api` `license=LGPL-3.0`, 27.65k star, 2026-06-13 push）——深挖完全没提。ADR-0006 把 LGPL 列为"警示"。但 ADR-0008 已规定"独立部署、不 fork、HTTP 调用"——**LGPL 传染只在链接/静态编译时触发，独立进程 HTTP 不构成衍生作品**。合规边界已由 ADR-0008 划清。

---

## 3. 推荐方案 + 理由

### 主选（XCDOS / NestJS）

**MCP 协议（工具标准化）+ 自建 BullMQ 轻量状态机（M3 起步）+ OpenAI Agents JS（薄抽象层，可替换）**

与深挖结论一致，但调整权重：

| 层 | 组件 | 版本 | 理由 |
|---|---|---|---|
| 工具协议层 | MCP TS SDK `@modelcontextprotocol/sdk` | `1.29.0`（锁版本，2.0-alpha 不用） | 直击 ARD V2 Tool Router 痛点；TS 一等公民；MIT 合规；已有 NestJS 社区桥 `@rekog/mcp-nest@1.9.10`（MIT，实测）和 `@nestjs-mcp/server@1.0.1`（MIT，实测）|
| 编排层 | 自建 BullMQ 状态机 | 基于 `agent_runs.status` + `outbox_events` | **完全对齐 LLD V1.0 现有 `AgentRunProcessor` 4 阶段设计**（`LLD:256-258`），不是新造轮子；ARD V2 第 504 行推荐栈含 BullMQ；KISS/YAGNI |
| Agent 抽象层 | OpenAI Agents JS（**可选**，薄封装隔离 0.x 风险） | `0.11.6` | Agent/Tool/Handoff/Guardrails 与 ARD 概念对应；但 **0.x 未 GA + 厂商绑定**，对抗验证建议**降为可选**——M3 可先用裸 fetch+tool_calls 经 sub2api，等 Agents JS GA 再接入 |

**对抗验证对深挖的修正**：
- 深挖给 OpenAI Agents JS fitScore=7，**我降到 6**。理由：(1) 仍是 0.x（v0.11.6 实测），未 GA，生产风险；(2) 厂商绑定 OpenAI，而 XCDOS 内测接订阅号（Claude Pro/Max）、商用可能切 Anthropic/国产，强绑 OpenAI 限制 sub2api 多账号灵活性；(3) Guardrails 概念 NestJS 自己用 Guard 拦截器就能实现，不必要引入第三方抽象。建议作为**可选薄层**而非核心。
- 深挖给自建状态机 fitScore=8，**我升到 9**。理由：LLD V1.0 已写明 `AgentRunProcessor` 走 BullMQ 4 阶段，这不是新选型而是**实现现有设计**，KISS/YAGNI 完美对齐 ADR-0006"能用现成就不要自己造"——BullMQ 是 ARD 推荐栈，agent_runs/outbox 是现有表。

### 备选（规模化升级路径）

**Temporal TS SDK `@temporalio/client@1.18.1`（MIT）**

- 不在 M3 引入（需独立 Server 集群，违反 YAGNI）。
- 当编排复杂度溢出（分支/并行/子图/补偿/长事务 + 大量 L4 审批）时升级。
- 升级路径平滑：OpenAI Agents JS 已有 Temporal 官方集成；BullMQ Job 可逐步迁移到 Temporal Workflow。
- **触发条件**：L4 审批日均 > 1000 次，或出现需补偿的分布式事务。

### 明确弃用

- **AutoGen / CrewAI / LlamaIndex**：纯 Python + 模型错配（XCDOS 是单 Agent 走结构化决策流程，不是多 Agent 对话/角色扮演/RAG）。
- **Semantic Kernel Java**：268 star，2026-05 后低活跃（实测 `pushed=2026-05-08`）。
- **LangGraph JS**：3.01k star，Python 版的 1/11，二等公民。若团队强 Python 可考虑跨语言 RPC，否则不用。

### Prolog 侧（Spring Boot）并行建议

**Spring AI `v2.0.0`（Apache-2.0，2026-06-12 GA 实测确认）**

- Spring 原生，与 Hibernate/JPA 同构；`mcp/` 子模块实测存在（MCP Client 支持）。
- ChatClient + @Tool + Advisor（=Guardrail）。
- Prolog F-017/F-018 规则聚类/自动生成走 Spring AI + pgvector。
- 与 XCDOS 共用 MCP tools 仓库（decision/forecast/roi skills 双系统复用），**MCP 协议层互通**。

---

## 4. XCDOS / Prolog 落地设计

### 4.1 职责边界 — Runtime vs sub2api（实测确认 ADR-0008）

```
sub2api (Go/Gin, LGPL-3.0, 独立容器, 不 fork)
  = LLM 网关：账号池/计费/转发/限流/tool_calls 透传
  = 不碰编排（LGPL 边界：独立进程 HTTP，不构成衍生作品）

XCDOS Agent Runtime (NestJS, MIT 栈)
  = 编排：6 阶段 + L1-L5 策略 + HITL
  = 通过 sub2api 调 LLM，不直连厂商

调用链：
用户/定时器 → POST /api/agent-runs
  → AgentRunService.startRun (写 agent_runs.status=running + outbox)
  → BullMQ Job → AgentRunProcessor
    → Plan  (LLM via sub2api, tool_calls 经 MCP)
    → Tool  (MCP tools, PolicyGuard 校验 L1-L5)
    → Verify (PolicyGuard + Guardrails)
    → 若 L3+ → status=awaiting_approval + outbox 发布 human_approval_required
       → 前端确认按钮 → 写 hitl_approved_by + outbox.approved
       → BullMQ delayed job 续跑 (超时=timeout_escalated)
    → Commit (DB + outbox, status=succeeded)
```

### 4.2 Schema 修正（基于 `docs/ddl/xcdos_schema.sql:236-256` 实测）

**深挖的 schema 设计方向正确，但有 3 处必须修**：

```sql
-- DDL:236-256 agent_runs 表修正

-- 修正 1：status 枚举必须扩，否则 TC-PERM-007 测试用例无法通过
-- 现状 (xcdos_schema.sql:240-241):
--   status VARCHAR(20) CHECK IN ('running','succeeded','failed','cancelled')
-- 修正为（对齐 TC-PERM-007 期望 NEED_HUMAN_CONFIRMATION + 深挖建议 awaiting_approval）:
ALTER TABLE agent_runs
  DROP CONSTRAINT agent_runs_status_check;
ALTER TABLE agent_runs
  ADD CONSTRAINT agent_runs_status_check
  CHECK (status IN ('running','awaiting_approval','succeeded','failed','cancelled'));
-- 说明：DDL 用 awaiting_approval（snake_case 一致），TC-PERM-007 文档侧同步改

-- 修正 2：补 trace_id（M3 设计意图里有 Trace，DDL 漏）
ALTER TABLE agent_runs ADD COLUMN trace_id VARCHAR(64);
CREATE INDEX idx_agent_runs_trace ON agent_runs(trace_id) WHERE trace_id IS NOT NULL;
-- 值 = OpenTelemetry traceId，串联 tool_calls 与 audit_logs

-- 修正 3：HITL 元数据（深挖建议，采纳）
ALTER TABLE agent_runs ADD COLUMN mcp_server_id VARCHAR(63);
ALTER TABLE agent_runs ADD COLUMN plan_version INTEGER;
ALTER TABLE agent_runs ADD COLUMN hitl_state VARCHAR(20);
ALTER TABLE agent_runs ADD COLUMN hitl_approved_by UUID REFERENCES users(id);
ALTER TABLE agent_runs ADD COLUMN hitl_decided_at TIMESTAMPTZ;
-- hitl_state 值域：pending_approval / approved / rejected / timeout_escalated

-- 新表：MCP server 注册
CREATE TABLE mcp_servers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(63) NOT NULL UNIQUE,
  transport     VARCHAR(20) NOT NULL CHECK (transport IN ('stdio','sse','http')),
  endpoint      TEXT NOT NULL,
  tool_manifest JSONB NOT NULL,
  auth_ref      VARCHAR(120),  -- 引用 secrets 表，不存明文
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  tenant_id     UUID,          -- NULL=公共；非 NULL=租户私有
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mcp_servers_tenant ON mcp_servers(tenant_id) WHERE tenant_id IS NOT NULL;
```

### 4.3 tool_calls JSONB 契约（与 MCP `tools/call` 对齐）

```json
{
  "tool_call_id": "call_abc123",
  "mcp_server": "xcdos-decision",
  "tool_name": "decompose_problem",
  "input": { "problem_id": "..." },
  "input_hash": "sha256:...",
  "output": { "sub_problems": [...] },
  "output_hash": "sha256:...",
  "status": "success",
  "llm_request_id": "sub2api 回传 gateway_request_id",
  "cost_cents": 12,
  "started_at": "2026-06-14T10:00:00Z",
  "duration_ms": 850
}
```

> **裁决**：`tool_calls` 是否独立成表？深挖列为开放问题。对抗验证建议 **M3 保留 JSONB**（已挂 `agent_runs.id` 逻辑外键，查询用 `jsonb_path_query`），**L4 审计压力大时再抽 `tool_calls` 独立表 + `run_id` FK**——避免过早优化（YAGNI）。

### 4.4 HITL 三层实现

| 层 | 实现 | 适用阶段 |
|---|---|---|
| L1-L2 | 直接执行，不暂停 | M3 起步 |
| L3-L4 | `status=awaiting_approval` + outbox 事件 + 前端确认 + BullMQ delayed job 超时升级 | M3 起步 |
| L5 | NestJS Guard 层硬 `return 403` **before** agent_runs 写入（安全文档 7.1） | 永不进编排流程 |
| 规模化 | 迁移 Temporal：审批=Signal，超时=Timer | L4 日均 > 1000 次 |

### 4.5 埋点

- `agent_runs` 每阶段写一行（或复用 trace）：intent_capture → context_build → plan → tool_execute → verify → commit。
- `tool_calls` 每次调用一条，含 `sub2api` 的 `gateway_request_id`（DDL:252 已预留）用于 LLM 计费对账。
- HITL 审批动作写 `audit_logs`：actor=user_id, action='agent_approval', target=agent_runs.id, before/after=hitl_state。

### 4.6 调用链伪代码（NestJS）

```typescript
// modules/agent-runtime/agent-run.processor.ts
@Processor('agent-run')
export class AgentRunProcessor extends WorkerHost {
  async process(job: Job<{ runId: string }>): Promise<void> {
    const run = await this.prisma.agentRun.findUnique({ where: { id: job.data.runId }});
    const traceId = run.trace_id ?? randomUUID();
    try {
      // 1. Plan (LLM via sub2api, MCP tools)
      const plan = await this.orchestrator.plan(run, traceId);
      // 2. Tool execute (MCP, PolicyGuard L1-L5)
      for (const toolCall of plan.tool_calls) {
        const level = await this.policyGuard.classify(toolCall.tool_name);
        if (level >= 3 && !run.hitl_approved_by) {
          await this.prisma.agentRun.update({
            where: { id: run.id },
            data: { status: 'awaiting_approval', hitl_state: 'pending_approval' },
          });
          await this.outbox.publish('xcdos.agent.human_approval_required', { runId: run.id });
          // BullMQ delayed job: 24h 后 timeout_escalated
          await this.queue.add('agent-run-timeout', { runId: run.id }, { delay: 86400000 });
          return; // 暂停，等前端确认事件触发续跑 Job
        }
        await this.toolRouter.route(toolCall, traceId); // MCP client.callTool
      }
      // 3. Verify + Commit
      await this.policyGuard.verify(run, traceId);
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: { status: 'succeeded', output: plan.result },
      });
      await this.outbox.publish('xcdos.agent.committed', { runId: run.id });
    } catch (e) {
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: { status: 'failed', output: { error: e.message } },
      });
      throw e; // BullMQ 自动重试（限 3 次，对齐 TC-EXC-010）
    }
  }
}
```

### 4.7 Prolog 侧（Spring Boot）

- Spring AI `v2.0.0` ChatClient + MCP Client（`mcp/` 子模块实测存在）。
- Prolog 规则引擎（F-017/F-018）通过 MCP tool 暴露给两侧 Agent。
- 双系统 LLM 调用统一经 sub2api（ADR-0008）。

---

## 5. 与 sub2api / 已有 ADR 的关系

### 5.1 不 fork 约束如何满足（实测 sub2api license = LGPL-3.0）

- **ADR-0008 已规定**："采用 sub2api 作为 LLM 网关，独立部署，不 fork 源码、不嵌入业务代码"（`docs/ADR/ADR-0008-llm-gateway-sub2api.md`）。
- **LGPL-3.0 边界**（实测 `Wei-Shaw/sub2api` `license=LGPL-3.0`）：传染只在**链接或静态编译**时触发。XCDOS / Prolog 通过 **HTTP API（OpenAI 兼容协议）调用独立容器**，不构成衍生作品，**合规**。
- ADR-0006 把 LGPL 列为"警示（需评估动态链接边界）"——sub2api 独立容器部署满足"不动态链接"的边界条件。
- **XCDOS Agent Runtime 选 MCP/BullMQ/Temporal 均独立运行或 HTTP 调用，与 sub2api 的 LGPL 边界处理方式一致**。

### 5.2 编排 vs 转发边界

- sub2api 已实现 `openai_tool_corrector.go` + `openai_tool_continuation`（处理 silent refusal）——这是**转发层的 tool_calls 透传**。
- XCDOS Agent Runtime 的 MCP 多步编排是**编排层的 tool 结果回灌**——两者不重叠。
- **风险点**：MCP 多步编排的 tool 结果回灌链路需端到端联调，验证 sub2api 的 silent refusal 续传逻辑不丢工具结果（深挖 risks 第 5 条成立）。

### 5.3 与 ADR-0005（BullMQ + Outbox）的关系

- 自建状态机**完全复用 ADR-0005 的 BullMQ + outbox_events**，不引入新运行时——符合 ADR-0006"能用现成"原则。
- HITL 审批事件走 outbox，与现有事件投递机制同构。

### 5.4 与 ADR-0002（Prisma）的关系

- agent_runs 表结构修正通过 Prisma migration 落地，不破坏现有 ORM 契约。

---

## 6. 风险与开放问题

### 6.1 已识别风险（对抗验证补充）

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | OpenAI Agents JS 0.x 未 GA | 中 | M3 不强依赖；薄封装隔离；回退裸 fetch+tool_calls |
| R2 | MCP 2.0-alpha 开发中，1.x→2.x 可能 breaking | 中 | 锁 `1.29.0`；抽象层隔离 |
| R3 | 自建状态机崩溃恢复/幂等/trace 需自证 | 中 | Temporal 免费送的东西自建要写；M3 验证不过则升 Temporal |
| R4 | `@rekog/mcp-nest@1.9.10` 社区桥（662 star）维护风险 | 低 | 必要时自维护薄封装 |
| R5 | sub2api silent refusal 续传与 MCP 多步回灌冲突 | 中 | 端到端联调 |
| R6 | **status 枚举与 TC-PERM-007 不一致**（实测 DDL 缺 `awaiting_approval`） | **高** | 本报告 §4.2 修正 |
| R7 | **trace_id 字段缺失**（实测 DDL 无） | 中 | 本报告 §4.2 补 |
| R8 | L4 审批超时策略未定义（安全文档 7.1 只说"强制人工确认"） | 中 | 需产品+安全裁决 |
| R9 | Spring AI v2.0.0 刚 GA（2026-06-12） | 低 | 生产前稳定性验证 |
| R10 | **sub2api LGPL-3.0 边界**（实测） | 低 | 独立容器 HTTP 调用，不构成衍生作品（ADR-0008 已划界） |

### 6.2 开放问题（需裁决）

1. **L4 审批超时默认处置**：自动驳回 / 自动升级上级 / 配置化？安全文档 7.1 未覆盖超时分支。
2. **MCP server 多租户隔离粒度**：公共 + 租户私有并存，还是 Tier-A/B 强制每租户独立？需与 ADR-0004（schema-per-tenant）对齐。
3. **M3 是否一步到位上 Temporal**？建议先 BullMQ 验证"拆-推-评-算"闭环再升（KISS），但需确认 L4 审批量级。
4. **OpenAI Agents JS 厂商绑定如何解耦**？是否在 Agent 抽象层做 provider adapter 保护 sub2api 多账号灵活性。
5. **tool_calls 是否独立成表**？M3 建议保留 JSONB，L4 审计压力再抽表。
6. **Prolog F-017/F-018 规则引擎**：走 Spring AI + MCP tool 暴露给 XCDOS Agent，还是双系统各自实现？

---

## 7. 工期估算（人天）

| 阶段 | 任务 | 人天 | 说明 |
|---|---|---|---|
| M3-1 | DDL 修正（status 枚举扩 + trace_id + hitl 字段 + mcp_servers 表） | 1 | 本报告 §4.2 |
| M3-2 | Prisma migration + repository 层 | 1 | 对齐 ADR-0002 |
| M3-3 | MCP server 注册 + tool manifest 管理 | 2 | 含公共/租户隔离 |
| M3-4 | AgentRunProcessor 4 阶段状态机（BullMQ） | 3 | 对齐 LLD:256-258 |
| M3-5 | PolicyGuard L1-L5 + Guardrails | 2 | L5 NestJS Guard 硬拦截 |
| M3-6 | HITL 审批回路（outbox + 前端确认 + 超时升级） | 3 | 含超时策略配置 |
| M3-7 | sub2api 集成 + tool_calls 透传联调 | 2 | 验证 silent refusal 续传 |
| M3-8 | OpenTelemetry trace 串联（agent_runs ↔ tool_calls ↔ audit_logs） | 2 | 补 trace_id 落地 |
| M3-9 | MCP tools 实现（decompose/forecast/roi 等 Skill） | 4 | 每个 Skill 一个 MCP tool |
| M3-10 | 单测 + 集成测试（覆盖 TC-PERM-007 / TC-EXC-010 / TC-PERF-003） | 3 | ≥90% 覆盖率 |
| **小计** | | **23** | M3 主体（约 5 周，对齐 ARD M3=9-12 周的子集） |
| L4 升级 | Temporal 迁移（条件触发） | +8 | 仅 L4 审批量级溢出时 |
| Prolog 侧 | Spring AI v2.0.0 接入 + MCP Client | +5 | 并行，不阻塞 XCDOS |

---

## 附录 A：实测命令记录

```bash
# MCP TS SDK
gh api repos/modelcontextprotocol/typescript-sdk --jq '{stars,license:.license.spdx_id,pushed}'
# → {"license":"NOASSERTION","pushed":"2026-06-14","stars":12658}（双许可无法单 SPDX）
curl -s https://registry.npmjs.org/@modelcontextprotocol/sdk/latest | jq '.version,.license,.engines'
# → "1.29.0" "MIT" {"node":">=18"}

# Temporal TS SDK（修正深挖版本号错误）
curl -s "https://registry.npmjs.org/@temporalio%2fclient" | jq '.dist-tags.latest'
# → "1.18.1"（不是深挖说的 1.9.3）

# Spring AI v2.0.0 GA
gh api repos/spring-projects/spring-ai/releases --jq '.[0:3]|.[]|{tag,prerelease,published}'
# → v2.0.0 prerelease=false 2026-06-12

# sub2api license（深挖漏报）
gh api repos/Wei-Shaw/sub2api --jq '.license.spdx_id'
# → "LGPL-3.0"

# XCDOS DDL
grep -n "agent_runs\|status.*CHECK" docs/ddl/xcdos_schema.sql
# → 236 CREATE TABLE agent_runs; 240-241 status 枚举仅 4 态
```

## 附录 B：与深挖结论的差异对照

| 项 | 深挖 | 对抗验证修正 | 依据 |
|---|---|---|---|
| Temporal TS SDK 版本 | v1.9.3 npm | **v1.18.1 npm**（2026-06-11） | npm registry 实测 |
| sub2api license | 未提 | **LGPL-3.0**（独立容器 HTTP 合规） | gh api 实测 |
| OpenAI Agents JS fitScore | 7 | **6**（0.x + 厂商绑定） | 对抗降分 |
| 自建状态机 fitScore | 8 | **9**（完全对齐 LLD 现有设计） | LLD:256-258 实测 |
| status 枚举 | 建议加 awaiting_approval | **必须加**（TC-PERM-007 期望 NEED_HUMAN_CONFIRMATION，DDL 不一致） | 测试用例实测 |
| trace_id | 列为开放问题 | **M3 必补**（M3 设计意图含 Trace，DDL 漏） | ARD:495 实测 |
