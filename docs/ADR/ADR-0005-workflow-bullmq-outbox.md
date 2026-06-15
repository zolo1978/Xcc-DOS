# ADR-0005：工作流执行 BullMQ + Transactional Outbox（暂定）

- **Status**：Accepted（萃取调研完成，Block D 结论支撑）
- **Date**：2026-06-11
- **Decision Makers**：架构师 / 后端 Lead

## Context

评审报告：
- P1-05：LLD 先保存再发布事件 / 审计，无事务、Outbox 或补偿。
- P0-06：测试要求死信队列，但 BullMQ 队列设计未定义 DLQ。

需明确异步执行与可靠性基线，否则审批、Agent 调度、审计三个链路都无法测试。

## Decision

V1.2 **暂定**采用：

1. **BullMQ（Redis Stream）** 作为任务队列。
2. **Transactional Outbox** 表：业务库同事务内写 `outbox(event_id, payload, status)`。
3. **Outbox Relay** 进程消费 outbox 投递到 BullMQ，投递成功后置 `status='dispatched'`。
4. **DLQ 启用**：BullMQ 自带失败队列；重试 5 次后入 DLQ，触发告警与人工介入。
5. **幂等键**：所有事件携带 `event_id`（UUID v7），消费方按 `event_id` 去重。

## 调研结论（2026-06-12 锁定）

Block D 萃取调研（`docs/RESEARCH/block-d-outbox-dlq.md`）已完成 Temporal / Restate / BullMQ+Outbox 三方案对比：

- **Temporal**：持久工作流能力最强，但引入 Go/Java SDK 异构运维、额外数据库依赖、学习曲线陡峭。MVP 阶段过度设计。
- **Restate**：适合事件溯源 + 确定性重放，但社区年轻、Java SDK 不成熟、运维经验稀缺。
- **BullMQ + Transactional Outbox**：复用现有 Redis/PostgreSQL 基础设施，Outbox Relay 组件轻量，DLQ/幂等/重试均已有 DDL 契约落地（`xcdos_schema.sql` 248-284 行）。

**锁定理由**：V1 MVP 的 Plan 审批链（5+ 步）和 Prolog 自进化任务均属适度复杂度，BullMQ + Outbox 可覆盖。长流程编排（>10 步审批、跨服务 Saga）列入 V2 评估 Temporal。Outbox Relay HA 部署方案在联调阶段确定。

原 Provisional 条件（Block C/D/E 调研未完成）已满足——Block D 出结论，Block C（消息可靠性对比）和 Block E（幂等中间件对比）结论已在 Block D 文档附录中记录。

## Consequences

### Positive

- Redis 已在使用，技术栈不变。
- Outbox 模式保证至少一次投递；DLQ + 幂等键覆盖重试边界。
- Outbox 表自带审计轨迹，可直接进入合规审计链。

### Negative

- Outbox Relay 是新组件，需 HA 部署（双实例 + 选主）+ 指标监控。
- BullMQ 不擅长长流程（>10 步）审批，Plan 审批链可能拉长 Redis 内存占用，需设置 TTL 与归档策略。
- 跨服务事务一致性仍需业务层补偿设计，Outbox 不解决业务回滚。

## Alternatives Considered

| 方案 | 结论 | 理由 |
|---|---|---|
| Temporal / Restate | **保留待 Step 2 调研** | 确定性重放是杀手特性，但引入新基础设施 + 学习曲线 |
| 直接事务 + 同步通知 | 放弃 | 评审已指出无补偿，且违反"业务库与消息库不同事务"原则 |
| Kafka + Outbox | 暂不考虑 | V1.2 阶段未规划 Kafka 集群运维 |

## Related

- 评审报告：P0-06, P1-05
- 关联 ADR：ADR-0001（PG，Outbox 表存于 PG）
- 后续动作：Step 2 萃取调研 Block C/D/E 完成后回写本 ADR；若推翻则新建 ADR-00XX
