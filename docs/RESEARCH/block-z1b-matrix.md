# Block Z-1b/c：存活候选能力矩阵 + 最终推荐

> 调研日期：2026-06-12
> 执行：Claude Code 直接调研（`CODEX_FALLBACK`：codex z1b 串行单发两次僵死，按契约转直接执行）
> 数据源：GitHub API 实拉（stars/license/pushed）+ LICENSE 原文 + README 能力证据
> 前置：[block-z1a-license.md](./block-z1a-license.md)（Dify/FastGPT/Bisheng 已否决）

---

## 1. z1a 复核修正（审核发现 2 处）

| 候选 | z1a 判定 | 复核结果 | 修正 |
|---|---|---|---|
| Flowise | ✅ | LICENSE.md 实查：双层——`packages/server/src/enterprise/` 目录 + 显式版权标记文件（如 IdentityManager.ts）= Commercial License；**其余纯 Apache-2.0 无附加条款** | ✅ 保留，加脚注：enterprise 目录（workspace/RBAC/SSO）禁用；多租户必须自建 |
| Botpress | ✅（v12 警示）| README 实查：现行主仓 = Botpress **Cloud** 的 SDK/CLI/integrations 工具链，**不是自托管平台**；自托管 bot 平台 = v12（AGPL）| **❌ 出局**：自托管场景无合规版本 |

## 2. 存活候选硬数据（GitHub API 2026-06-12 实拉）

| 项目 | Stars | License | 最近 push | 语言 |
|---|---:|---|---|---|
| langflow-ai/langflow | 149,589 | **MIT**（纯） | 2026-06-12 | Python |
| infiniflow/ragflow | 82,557 | **Apache-2.0**（纯） | 2026-06-12 | Python |
| FlowiseAI/Flowise | 53,520 | Apache-2.0（除 enterprise 目录） | 2026-06-10 | TypeScript |
| ~~botpress/botpress~~ | 14,739 | MIT（但主仓非自托管平台） | 2026-06-11 | TypeScript |

## 3. 能力定位（README/docs 证据）

| 项目 | 本质 | 多租户 | 工作流编排 | API 暴露 | 部署 |
|---|---|---|---|---|---|
| Langflow | LLM agent/workflow 可视化编排平台 | 无原生多租户 | ✅ 强（可视化 + 每 flow 导出 API/MCP server）| ✅ 内置 API + MCP | Docker/K8s/主流云，完全开源 |
| RAGFlow | RAG 引擎（文档理解+检索）| 无 | 部分（agent 编排较新）| ✅ API | Docker Compose 自托管 |
| Flowise | LLM workflow 可视化编排 | 锁 enterprise（禁用）| ✅ 强 | ✅ API | Docker 自托管 |

## 4. 与 Prolog 六大模块覆盖度矩阵

| Prolog 模块（F-001~020）| Langflow | RAGFlow | Flowise | 结论 |
|---|---|---|---|---|
| 租户权限（多租户隔离/RBAC）| 缺口 | 缺口 | 缺口（enterprise 禁用）| **全缺**，自建（Block A 方案，20-30 人日）|
| 规则配置（Prolog 规则引擎/灰度/版本）| 缺口 | 缺口 | 缺口 | **全缺**——LLM-flow ≠ 逻辑规则调度，自建（40 人日档）|
| 同义词管理 | 缺口 | 部分（知识库同义词）| 缺口 | 基本自建（10 人日档）|
| 会话管理（多轮/上下文/超时）| 部分（flow 内会话）| 部分（对话 API）| 部分 | 平台仅覆盖 LLM 会话层，业务会话自建（10-20 人日）|
| 日志审计（TraceID/前后值/告警）| 缺口 | 缺口 | 缺口 | 自建（Block D Outbox + 审计表，10 人日）|
| 自进化任务（聚类/生成/审核流）| 部分（可编排 LLM 任务）| 部分（RAG 检索支撑）| 部分 | 编排层可借力，业务流自建（20 人日）|

**覆盖度结论：无候选覆盖 ≥2 个核心模块。整套 base 路线对 Prolog 不成立。**

## 5. 最终推荐：混合方案（z1c 裁决）

```
┌─────────────────────────────────────────────┐
│  Prolog AgentTeam = 业务底座自建 + LLM 子能力嵌入  │
├─────────────────────────────────────────────┤
│ 业务底座（六模块）: Spring Boot 自建            │
│   ├─ 多租户: Block A 方案（Hibernate + Flyway） │
│   ├─ 可靠事件: Block D 方案（Spring Modulith）  │
│   └─ 规则引擎/同义词/审计/自进化: 按 PRD 自研      │
│ LLM 编排子能力: 嵌 Langflow（MIT, 149k★）       │
│   └─ 每 flow 输出 API/MCP，Spring 网关调用      │
│ RAG 子能力(如需): RAGFlow（Apache-2.0, 82k★）   │
└─────────────────────────────────────────────┘
```

- **主选嵌入件：Langflow**。理由：MIT 纯协议零风险 + 149k star 四者最活 + 每 flow 即 API/MCP 与 Spring 网关天然对接。
- **备选：Flowise**（Apache-2.0 开源部分；TypeScript 栈与 XCDOS NestJS 亲和，若双系统统一嵌入件可换它；用前法务复核 enterprise 目录边界）。
- **不推荐**：RAGFlow 当 base（只是 RAG 引擎）；Botpress（自托管无合规版）。
- **ADR-0006 修正注**："整套 base"对 LLM-flow 类平台不成立于规则调度 SaaS 场景；"现成优先"在此落地为**子能力嵌入**而非整套替换。

## 6. 回写清单

| 文档 | 改动 |
|---|---|
| `Prolog 总体技术方案 V1.2` §三 核心技术栈 | 增"LLM 编排子系统 = Langflow 嵌入（独立容器，API 网关对接）"；删"自研 LLM 编排"若有 |
| `Prolog 总体技术方案 V1.2` §二 架构分层 | 智能引擎层标注 Langflow 容器 + RAGFlow（可选）边界 |
| `Prolog 部署架构 V1.2` | 三种部署模式各加 Langflow 容器资源水位；边缘离线模式验证 Langflow 离线包可行性（待 PoC）|
| `docs/ADR/` 新增 ADR-0007 | "Prolog 采用混合方案：业务底座自建 + Langflow 子能力嵌入"，关联 z1a/z1b 证据 |
| 评审报告 P0-11 | Prolog PRD 缺失问题不受影响，仍需补 |

## 7. 调研证据

- GitHub API 实拉 4 仓（stars/license/pushed/language）
- Flowise LICENSE.md 原文逐段核验（gh api contents + base64 解码）
- Langflow/RAGFlow/Botpress README 能力关键词抓取
- `CODEX_FALLBACK` 记录：z1b codex 串行单发 2 次僵死（事件流静默 16+ 分钟），第 3 通道（Claude 直查）完成
- 盲区：Langflow 离线部署（边缘模式 E-004）未实测，需 PoC；Langflow 无原生多租户，并发隔离策略需设计（每租户独立 flow 命名空间 or 独立实例）
