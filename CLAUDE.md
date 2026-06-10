# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

这是**柔电科技** XCDOS 产品文档仓库，**不含任何可执行源代码**。仓库存储产品需求、技术架构、数据库设计、部署方案等设计文档。所有文档均为中文。

## 核心项目

### 1. XCDOS — 企业决策与执行操作系统
产品定位：面向企业决策层的操作系统，基于"拆-推-评-算"模型实现目标→问题→决策方案→执行任务→强制反馈→数据看板的闭环。

| 文档 | 文件 | 用途 |
|------|------|------|
| PRD V1.0 | `XCDOS_PRD_V1_企业决策与执行操作系统.html` | 产品需求文档，定义功能模块、页面、字段规则、权限体系、验收标准 |
| TDD V1.0 | `XCDOS_TDD_V1_企业决策与执行操作系统.html` | 技术设计文档，定义技术栈、架构分层、API/Agent/工作流/部署方案 |
| ARD V2.0 | `XCDOS_ARD_V2_领域模型_DDD_AgentRuntime_ER_EventStorming.html` | 领域架构文档，DDD 聚合设计、ER 图、Event Storming、Agent Runtime 设计 |
| UI 设计规范 | `XCDOS_深蓝三色专业版_前端UI设计规范.html` | 前端设计规范，Design Token、组件样式、布局规范 |

### 2. Prolog AgentTeam — 智能交互工厂
面向企业 SaaS 的多租户智能对话与规则调度系统。

| 文档 | 文件 | 用途 |
|------|------|------|
| 总体技术方案 V1.2 | `Prolog AgentTeam 智能交互工厂 - 总体技术方案（V1.2）.md` | 七层架构设计、模块划分、技术栈选型 |
| 数据库设计 V1.2 | `Prolog AgentTeam 智能交互工厂 - 数据库详细设计文档（DB Design V1.2）.md` | 全量表结构、索引设计、ER 关系 |
| 部署架构 V1.2 | `Prolog AgentTeam 智能交互工厂 - 部署架构与资源规划文档（V1.2）.md` | 部署拓扑、集群规划、资源水位 |
| 测试用例 V1.2 | `Prolog AgentTeam 智能交互工厂 - 测试用例文档（V1.2）.md` | 13 模块 75+ 条测试用例，覆盖功能/隔离/性能/边缘 |

## 产品研发规范

`柔电科技内部研发规范、产研交付流程、上线标准，.md` 定义全链路产研流程：
`需求评审 → 技术方案设计 → 开发 → 自测/联调 → 测试准入 → 集成测试 → 性能/安全测试 → 发布准入 → 灰度上线 → 全量上线 → 运维值守 → 复盘归档`

`研发配套文档 - 前端专项开发规范文档（P1 必备）.md` 为前端专项规范。

## XCDOS 技术架构速览

- **技术栈**: React + Next.js + TypeScript (前端), NestJS + TypeScript (后端), PostgreSQL (主库), Redis + BullMQ (缓存/队列)
- **架构范式**: DDD + CQRS Lite，模块化单体优先（MVP 不做微服务拆分）
- **分层架构**: Client → BFF/API → Application → Domain → Infrastructure
- **核心聚合**: Goal, DecisionCase, Task, Feedback, AgentRun
- **UI 设计系统**: 深蓝三色专业版，Design Token 体系 (`--navy-*`, `--cyan-*`, `--bluegray-*`)

## Prolog AgentTeam 架构速览

- **七层架构**: 接入层 → 网关层 → 业务服务层 → 智能引擎层 → 数据缓存层 → 存储层 → 运维监控层
- **六大业务模块**: 租户权限、规则配置、同义词管理、会话管理、日志审计、自进化任务
- **三种部署模式**: 公网集群、内网单机、边缘离线

## 文档编辑注意事项

- HTML 文档内嵌 CSS（`<style>` 标签），样式变量定义在 `:root` 中，修改样式时保持一致
- 编辑 HTML 文档时注意保持 `layout` / `aside` / `main` 的 grid 布局结构
- Markdown 文档部分使用了反斜杠转义（`\.`），编辑时保持格式一致
- 文档之间存在引用链：PRD → TDD → API/DB → Deploy，修改上游文档需检查下游一致性

## 关联代码仓库

- **GitHub**: [zolo1978/Xcc-DOS](https://github.com/zolo1978/Xcc-DOS) — XCDOS 源代码仓库（Apache-2.0），当前为初始化状态（仅 README + LICENSE），代码开发尚未启动
- 本文档仓库（iCloud Drive）是上游设计文档源，代码仓库派生自此处的 PRD / TDD / ARD 设计基线

## .spec-workflow

仓库配置了 spec-workflow MCP，模板位于 `.spec-workflow/templates/`，包含：
- `requirements-template.md` — 需求文档模板
- `design-template.md` — 设计文档模板
- `tech-template.md` — 技术文档模板
- `tasks-template.md` — 任务拆解模板
- `structure-template.md` — 项目结构模板
- `product-template.md` — 产品文档模板
