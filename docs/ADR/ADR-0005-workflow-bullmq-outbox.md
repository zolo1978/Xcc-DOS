# ADR-0005：工作流执行 BullMQ + Transactional Outbox（暂定）

- **Status**：Provisional（萃取调研可推翻）
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

## Provisional 原因

Step 2 萃取调研 Block C / D / E 将评估 Temporal / Restate / DurableObjects 等持久工作流方案在以下场景下是否显著优于自研 Outbox：

- XCDOS Plan 多级审批（5+ 步）
- Prolog 自进化任务长流程编排
- Agent Runtime 跨工具调用的确定性重放

若证据充分，本 ADR 将被新 ADR 替换并标记 Superseded。

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
