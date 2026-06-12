# ADR-0006：能用现成就不要自己造

- **Status**：Accepted
- **Date**：2026-06-11
- **Decision Makers**：项目负责人 / 技术负责人

## Context

项目早期 Step 2 萃取调研被拆为 10 个"原子能力块"（多租户 / RBAC / 工作流 / Outbox / Agent Runtime / 规则引擎 / 审计 / BFF / 前端 / 监控），每块找单一组件再自研装配。

此模式暴露三个反模式：

1. **现代版造轮子**：开源组件装配本质仍是自研集成层，工程成本接近从零写一套
2. **base 缺失**：缺少"整套产品级开源方案"作为基线，无法享受社区维护红利
3. **工具层同病**：用于驱动开发的 `codex-bridge-agent` 也是用户自改版本，存在并发回收、通知漏推、任务包冗长等问题

## Decision

项目所有层级（产品层、组件层、工具层、subagent 层）一律遵循"现成优先"原则：

### 优先级（从高到低）
1. **直接用**（依赖发布版本，不修改源码）
2. **二次开发**（在 base 之上做插件 / 扩展 / 配置）
3. **Fork**（必要时维护内部分支，需评估长期维护成本）
4. **自研**（仅在前三档均不可行时启用，需写 ADR 说明）

### 适用范围
- 产品框架（如 Prolog 选 Dify / FastGPT；XCDOS 选 Superset / Metabase + 决策模型自研）
- 横切组件（多租户、RBAC、Outbox、工作流引擎、审计、监控）
- 开发工具链（IDE 插件、CLI、CI/CD、test runner）
- AI agent 工具链（Codex bridge、Claude Code subagent、subagent skill）

### License 红线
- ✅ 直通：Apache-2.0 / MIT / BSD-2/3 / MPL-2.0 / Unlicense
- ⚠️ 警示：LGPL（需评估动态链接边界）
- ❌ 一票否决：AGPL / GPL / 未声明 License（除非项目本身就是要 GPL 开源）

### 评估清单（新引入 base / 组件前必填）
1. star ≥ 500 且 6 个月内有 commit
2. License 在直通区
3. 与现有 ADR-0001 ~ ADR-0005 无技术栈冲突
4. 二开覆盖度评估（PRD/TDD 功能项的命中比例）
5. 维护方背景（公司 / 个人 / 基金会）
6. issue 响应中位数 < 14 天

## Consequences

### Positive
- 开发成本骤降，base 已生产可用
- 享受社区维护、安全补丁、新特性
- 团队聚焦真正的产品差异化价值，不重复造基础设施
- 二开成本明确可估算

### Negative
- 失去定制深度，部分场景受限于 base 抽象
- License 边界需法务复核
- 二开升级时需处理 base 主线变更冲突
- 决策依赖 base 维护方持续投入

## Alternatives Considered

| 方案 | 结论 | 理由 |
|---|---|---|
| 全自研 | 拒绝 | 开发成本翻倍，无社区红利 |
| 原子组件装配（前期路线）| 部分保留 | A/D 等横切能力调研产物仍有用，但不再作为主路径 |
| 全 Fork | 不优先 | 维护成本高，仅在 base 缺关键能力且无法插件化时启用 |

## Related

- 用户指令：2026-06-11 session "能用现成就不要自己造，agent 那个 codex bridge 也是如此"
- 关联 ADR：ADR-0005（BullMQ + Outbox 即遵循此原则保留生态组件）
- 后续动作：
  - Step 2 萃取改为"整套 base 对标"（Block Z），并退役 Block B/E/F/H/I/J 的原子块调研
  - 工具层：调研现成 Codex bridge / Claude Code subagent 替代当前 `codex-bridge-agent`
  - 新增引入项必须填评估清单 6 项，写入 `docs/RESEARCH/` 对应选型卡
