# Block D 选型卡：Transactional Outbox / DLQ / 幂等中间件

> 调研范围：XCDOS（NestJS + Prisma 5 + PostgreSQL 14） + Prolog AgentTeam（Spring Boot + Hibernate + PostgreSQL 14）的事务事件可靠投递、死信治理、幂等键管理、乐观锁选型。
> 关联评审条目：P0-06（DLQ 未定义）、P1-05（先保存后发布事件，无 Outbox/补偿）、P1-06（同日反馈缺少唯一约束）、P1-08（并发控制缺失）。
> 关联 ADR：[ADR-0005 workflow-bullmq-outbox](../ADR/ADR-0005-workflow-bullmq-outbox.md)（Provisional）。

---

## 1. 能力定义

- **Transactional Outbox**：业务数据与待发布事件在同一数据库事务中落库，消除“业务提交成功但事件发送失败”的双写不一致。
- Outbox Relay 通过轮询、事务日志 CDC 或通知机制异步投递事件，通常提供至少一次交付，因此消费者仍须幂等。
- **DLQ（死信队列）**：接收超过重试上限、格式错误或持续处理失败的消息，隔离异常，避免阻塞正常队列。
- DLQ 应保存原始载荷、失败原因、重试次数和关联标识，并支持告警、人工检查及受控重放。
- **幂等键**：由客户端或服务端生成的唯一请求标识，用于识别重复请求并返回首次处理结果，防止重复写入或重复执行。
- 幂等记录应具备唯一约束、请求指纹、处理状态、响应快照和过期策略；仅生成 UUID 并不等于实现幂等。
- **乐观锁**：为聚合记录维护版本号，更新时将主键和原版本同时作为条件，并原子递增版本号。
- 当更新影响行数为零时判定并发冲突，由应用执行重试、合并或提示用户，避免后写覆盖先写。

---

## 2. 候选清单

| 类别 | 项目名 | 官方仓库 URL | 定位一句话 | License |
|---|---|---|---|---|
| Outbox | Spring Modulith Events | [spring-projects/spring-modulith](https://github.com/spring-projects/spring-modulith) | 为 Spring Boot 模块化单体提供事务事件发布日志、失败恢复和外部消息代理集成。 | Apache-2.0 |
| Outbox | Debezium Outbox Event Router | [debezium/debezium](https://github.com/debezium/debezium) | 通过 PostgreSQL WAL 等事务日志捕获 Outbox 表变更并可靠投递到事件流平台。 | Apache-2.0 |
| Outbox | Eventuate Tram | [eventuate-tram/eventuate-tram-core](https://github.com/eventuate-tram/eventuate-tram-core) | 面向 Java 微服务的事务消息平台，以 Outbox 表配合 CDC 或轮询 Relay 发布事件。 | Apache-2.0 |
| Outbox | Gruelbox Transaction Outbox | [gruelbox/transaction-outbox](https://github.com/gruelbox/transaction-outbox) | Java 事务 Outbox 库，将方法调用持久化并在事务提交后可靠重试执行。 | Apache-2.0 |
| 幂等 | Node Idempotency | [mahendraHegde/node-idempotency](https://github.com/mahendraHegde/node-idempotency) | 为 NestJS、Express、Fastify 提供请求幂等控制，并支持 Redis、PostgreSQL 等存储适配器。 | MIT |
| 幂等 | AWS Lambda Powertools for TypeScript | [aws-powertools/powertools-lambda-typescript](https://github.com/aws-powertools/powertools-lambda-typescript) | 提供装饰器、中间件和函数包装器，按请求载荷生成键并阻止 Lambda 重复执行。 | MIT-0 |
| 乐观锁 | Prisma ORM | [prisma/prisma](https://github.com/prisma/prisma) | Node.js/TypeScript ORM，可通过显式 `version` 字段和条件更新实现应用层乐观并发控制。 | Apache-2.0 |
| 乐观锁 | Hibernate ORM | [hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm) | Java ORM，通过 JPA `@Version` 原生完成版本校验并在冲突时抛出乐观锁异常。 | Apache-2.0 |

License 红线提示：上述 8 项均为 MIT / MIT-0 / Apache-2.0，可直接作为运行时依赖。无 LGPL / GPL / AGPL 项目，无未声明 License 项目。

---

## 3. 横向对比表

> Stars 与最近提交日期均标注**截至 2026-06 公开数据**，未实地核验项请见 §8.3 人工核验待办。

| 项目 | 类别 | Stars | 最近提交 | License | Outbox 模式 | DLQ 原生支持 | 幂等键支持 | PG LISTEN-NOTIFY 集成 | 双栈兼容(Node/Java) | 备注 |
|---|---|---:|---|---|---|---|---|---|---|---|
| [Spring Modulith Events](https://github.com/spring-projects/spring-modulith) | Java 领域事件 / Outbox | 约 1.1k | 2026-06-01（待人工核验） | Apache-2.0 | 库内事务 | 可集成 | 需自研 | 需自研 | Java only | 事务内登记事件发布，支持失败重提交和外部消息系统适配；不等同于完整 DLQ 或消费者幂等。 |
| [Debezium Outbox Event Router](https://github.com/debezium/debezium) | CDC / Outbox 路由 | 约 12.8k | 2026-05-14（待人工核验） | Apache-2.0 | CDC | 可集成 | 可集成 | N/A | 双栈 | 基于 PostgreSQL WAL 捕获 Outbox；DLQ 依赖 Kafka Connect，事件 ID 可供消费者去重但不自动保证幂等。 |
| [Eventuate Tram](https://github.com/eventuate-tram/eventuate-tram-core) | Java 事务消息平台 | 约 1.2k | 2026-04-27（待人工核验） | Apache-2.0 | CDC | 可集成 | 可集成 | 需自研 | Java only | 提供事务消息、Saga、命令和领域事件体系；组件和运维复杂度高于轻量 Outbox。 |
| [Gruelbox Transaction Outbox](https://github.com/gruelbox/transaction-outbox) | Java Outbox 库 | 约 332 | 2026-04-29（待人工核验） | Apache-2.0 | 轮询 | 原生 | 原生 | 需自研 | Java only | PostgreSQL 支持 `SKIP LOCKED`；提供阻塞任务、人工解除及 `uniqueRequestId` 重复检测。 |
| [Node Idempotency](https://github.com/mahendraHegde/node-idempotency) | Node 请求幂等中间件 | 约 14 | 待人工核验 | MIT | N/A | N/A | 原生 | N/A | Node only | 支持 NestJS、Express、Fastify，以及 Redis、PostgreSQL 存储适配器；项目规模较小。 |
| [AWS Powertools TypeScript Idempotency](https://github.com/aws-powertools/powertools-lambda-typescript) | Lambda 幂等工具 | 约 1.8k | 待人工核验 | MIT-0 | N/A | N/A | 原生 | N/A | Node only | 成熟度较高，但主要面向 AWS Lambda，默认依赖 DynamoDB，普通 NestJS 服务适配成本较高。 |
| [Prisma ORM](https://github.com/prisma/prisma) | Node ORM / 乐观并发基础 | 约 46.3k | 2026-06-04（待人工核验） | Apache-2.0 | N/A | N/A | 可集成 | 需自研 | Node only | 可用事务和唯一约束实现 Outbox、幂等键；乐观锁通常需自行维护 `version` 字段及条件更新。 |
| [Hibernate ORM](https://github.com/hibernate/hibernate-orm) | Java ORM / 乐观锁 | 约 6.4k | 待人工核验 | Apache-2.0 | N/A | N/A | 可集成 | 需自研 | Java only | 原生支持 `@Version` 乐观锁；Outbox、DLQ 和请求幂等仍需 Spring Modulith、Gruelbox 或自研组件。 |

### 关键观察

- BullMQ 原生支持失败重试、失败任务集合和退避策略，但**没有自动将耗尽重试的任务转投独立队列的第一类 DLQ**；DLQ 路由、告警、重放和审计需要自行定义。
- BullMQ 提供 `jobId` 和 Deduplication ID，但官方仍要求业务任务自行满足幂等性；它不原生管理 HTTP `Idempotency-Key`、请求指纹及响应缓存。
- 因此 BullMQ 可以继续作为 Node 任务执行器，但不能把“失败任务集合”和“去重 ID”直接视为完整的 DLQ 与幂等键方案。
- PostgreSQL 14 的稳妥基线是 Outbox 表加 `FOR UPDATE SKIP LOCKED` 轮询，具备耐久性、易恢复和较低运维成本。
- `LISTEN/NOTIFY` 只向当前监听会话发送通知，不应作为唯一耐久投递机制；适合用作唤醒轮询器的低延迟加速信号（参考 [PostgreSQL 14 NOTIFY 文档](https://www.postgresql.org/docs/14/sql-notify.html)）。
- Debezium CDC 更适合高吞吐、多消费者和跨 Node/Java 服务场景，但会引入复制槽、Kafka Connect、Schema 演进和监控成本。
- Spring Modulith 适合 Spring 模块化单体：事件登记、事务边界和失败重提交均已有框架支持，工程成本低于从零自研。
- 若要求 Node/Java 统一事件信封、独立 DLQ 策略或跨服务投递治理，则应采用统一 Outbox 表契约加轮询/CDC；Spring Modulith 可作为 Java 侧实现，不宜成为跨栈协议本身。

---

## 4. 与契约匹配度

### 4.1 XCDOS 反馈幂等（评审 P1-06：同日反馈缺少唯一约束）

- 推荐组合为 **Prisma 业务唯一约束 + 自维护幂等键表 + node-idempotency**，分别覆盖数据库、应用服务和 HTTP 接入层。
- 在 `Feedback` 增加 `businessDate`，并建立 `@@unique([tenantId, taskId, submitterId, businessDate])`，从根源阻止同日重复反馈。
- `node-idempotency` 可处理客户端重试和重复请求，但不能替代业务唯一约束；其存储后端、TTL、租户隔离和失败响应重放策略仍需配置。
- 自维护幂等键表应记录 `tenantId`、幂等键、请求摘要、处理状态和响应摘要，避免同一键被不同请求内容复用。
- 典型组合 **Spring Modulith Events + Hibernate @Version +（Prisma 自管 version + 自研 outbox 表）+ node-idempotency** 对该契约匹配度高；留白是历史重复数据清理、业务日期时区和幂等记录保留周期。

### 4.2 Prolog 规则发布事件

- Prolog 的规则发布适合采用 **Spring Modulith Events**：规则状态变更与事件发布登记可处于同一数据库事务，修复“先保存、再发布”产生的原子性缺口。
- `@TransactionalEventListener` 配合持久化事件发布注册表，可跟踪监听器完成状态并对失败发布进行重新提交。
- Hibernate `@Version` 应覆盖规则聚合，阻止两个管理员基于同一旧版本并发发布或覆盖规则。
- Spring Modulith 主要保障模块事件可靠执行；若事件需要发送至 BullMQ、Kafka 或其他服务，仍需实现外部消息适配器、重试与 DLQ。
- 因此典型组合对 Prolog 单体内部事件匹配度很高；留白是跨进程消息格式、事件版本、外部投递状态和发布注册表归档策略。

### 4.3 跨服务投递保证

- XCDOS 自研 outbox 与 Spring Modulith Events 均可解决“业务提交成功但事件丢失”，但整体语义仍是**至少一次投递**，不是端到端恰好一次。
- Node 侧应在 Prisma 事务中同时写入业务数据和 outbox，Relay 通过 `FOR UPDATE SKIP LOCKED` 批量认领，失败进入重试并最终转入 DLQ。
- Java 侧可由 Spring Modulith 保存事件发布记录，再由外部适配器投递；消费者必须以 `eventId + consumerName` 建立唯一消费记录。
- BullMQ 可承担异步重试和失败队列，但不能代替数据库 outbox，也不能单独保证数据库事务与入队操作原子化。
- 典型组合能够覆盖生产端不丢、传输端可重试、消费端去重；留白是统一事件信封、跨栈追踪 ID、消息顺序、DLQ 回放及对账告警。

### 4.4 乐观锁覆盖（评审 P1-08）

- Prolog 使用 Hibernate `@Version` 与 JPA 更新语义天然匹配，可在规则、会话配置等聚合发生并发更新时抛出乐观锁异常。
- XCDOS 的 Prisma 5 没有 Hibernate 式自动版本管理，需要增加 `version Int @default(0)`，更新时使用 `id + version` 条件并原子递增。
- Goal、Task、DecisionCase、Feedback 等存在并发编辑或状态流转的聚合应纳入覆盖，而不应只在控制器层比较版本。
- HTTP 契约应携带 `version` 或 `ETag/If-Match`，冲突统一返回 `409 Conflict`，由客户端刷新后重试或人工合并。
- 典型组合可完整覆盖双栈乐观锁；留白是批量更新、后台任务、事件处理器绕过版本检查，以及冲突错误码和前端交互规范。

---

## 5. 适配工作量评估

> 以下为完成设计回写、核心实现、迁移、监控及测试的粗略估算，不包含历史重复数据的大规模人工治理。

| 方案 | 涉及栈 | 人天估算 | 改动文件清单 | 风险 |
|---|---|---:|---|---|
| **A. 全自研 outbox 表 + 轮询 Relay + 自维护幂等键表（双栈）** | NestJS、Prisma、BullMQ、Spring Boot、Hibernate、PostgreSQL | 后端：18–25；SRE：4–6；测试：7–10 | `XCDOS_TDD_V1.html#§9`；`Prolog 总体方案#§4.2`；`prisma/schema.prisma`；`src/outbox/outbox-relay.ts`；`src/idempotency/*`；`db/migration/*`；`prolog/.../outbox/*` | 双栈重复建设；认领锁、重试退避、归档和并发边界容易实现不一致；长期维护成本最高。 |
| **B. Node 自研 outbox + Spring Modulith Events（Java 侧采纳框架）** ✅ 推荐 | NestJS、Prisma、BullMQ、node-idempotency、Spring Modulith、Hibernate、PostgreSQL | 后端：14–20；SRE：3–5；测试：6–9 | `XCDOS_TDD_V1.html#§9`；`Prolog 总体方案#§4.2`；`prisma/schema.prisma`；`src/outbox/*`；`src/idempotency/*`；`build.gradle`；`prolog/.../RulePublishedListener.java`；`prolog/.../RuleEntity.java` | 两栈实现机制不同，需要统一事件信封和运维指标；Modulith 外部投递仍需适配器；团队需掌握事件发布注册表的清理与重放。 |
| **C. 引入 Debezium CDC 统一两栈** | NestJS、Prisma、Spring Boot、Hibernate、PostgreSQL logical decoding、Debezium、Kafka Connect/Kafka | 后端：18–26；SRE：10–15；测试：9–13 | `XCDOS_TDD_V1.html#§9`；`Prolog 总体方案#§4.2`；`prisma/schema.prisma`；`db/outbox-schema.sql`；`debezium/connectors/*.json`；`deploy/kafka-connect/*`；`monitoring/cdc-dashboard.json` | 基础设施和运维复杂度显著增加；需管理 WAL、复制槽、Schema 演进和连接器恢复；对当前模块化单体 MVP 可能过度设计。 |

综合成本、可靠性和现阶段架构规模，**方案 B 工作量最低且契约匹配度最高**：Node 侧保留可控的 Prisma outbox，Java 侧利用 Spring Modulith 减少自研范围；两侧统一事件信封、消费幂等表、重试/DLQ 和可观测性规范。

---

## 6. 推荐方案

### 6.1 总体推荐

推荐采用**方案 B：Node 自研 Transactional Outbox + Spring Modulith Events**。

两套技术栈分别使用最匹配自身生态的事务事件机制，同时统一事件信封、投递语义和消费端幂等规则：

- **XCDOS（Node.js）**：基于 Prisma 自建 Outbox 表和 Relay。
- **Prolog AgentTeam（Java）**：采用 Spring Modulith Event Publication Registry。
- **统一语义**：业务数据与事件记录同事务提交，跨进程投递采用至少一次语义，消费端必须幂等。
- **统一事件信封**：

```json
{
  "eventId": "UUIDv7",
  "eventType": "FeedbackSubmitted",
  "eventVersion": 1,
  "occurredAt": "2026-06-11T10:00:00Z",
  "producer": "xcdos",
  "tenantId": "tenant-id",
  "aggregateType": "Feedback",
  "aggregateId": "feedback-id",
  "correlationId": "request-or-trace-id",
  "causationId": "upstream-event-id",
  "idempotencyKey": "business-operation-key",
  "payload": {}
}
```

不建议在当前阶段引入 Debezium、Kafka 或独立工作流基础设施。它们可以作为后续高吞吐或长流程编排的升级项，但不是解决当前事务事件一致性、重复消费和并发覆盖问题的最低成本方案。

### 6.2 Node 栈技术栈装配

XCDOS 推荐如下装配：

1. **Prisma Outbox 表**

   在业务事务中同时写入业务聚合和 `outbox_events`。核心字段包括：

   - `event_id UUID`（推荐 UUIDv7）
   - `event_type`
   - `event_version`
   - `tenant_id`
   - `aggregate_type`
   - `aggregate_id`
   - `payload JSONB`
   - `status`（`pending` / `retry` / `published` / `dead`）
   - `attempt_count`
   - `next_attempt_at`
   - `locked_at`
   - `locked_by`
   - `published_at`
   - `last_error`
   - `created_at`

2. **轮询 Relay 作为可靠性主路径**

   Relay 使用 PostgreSQL：

   ```sql
   SELECT ...
   FROM outbox_events
   WHERE status IN ('pending', 'retry')
     AND next_attempt_at <= now()
   ORDER BY created_at
   FOR UPDATE SKIP LOCKED
   LIMIT :batch_size;
   ```

   多实例 Relay 通过 `FOR UPDATE SKIP LOCKED` 并行领取任务，不依赖单实例选主。投递失败后按照指数退避更新 `attempt_count`、`next_attempt_at` 和 `last_error`。

3. **LISTEN/NOTIFY 仅用于加速唤醒**

   事务提交后发送轻量通知，使 Relay 立即发起扫描。通知内容只携带提示信息，不携带完整业务载荷。`LISTEN/NOTIFY` 不是可靠消息通道；通知丢失、连接中断或 Relay 重启时，定时轮询仍必须能够发现全部未投递事件。

4. **BullMQ 作为下游执行器**

   Relay 将事件转换为 BullMQ Job，用于 Agent Run、提醒、报表、质量评估等异步执行。建议使用 `eventId` 作为 `jobId`，减少重复入队，但不能以此替代数据库消费去重。

5. **node-idempotency 管理入口幂等**

   对反馈提交、任务状态变更、规则发布等写接口读取 `Idempotency-Key`，使用 `node-idempotency` 保存请求指纹、处理状态和响应结果。相同键但请求参数不同必须拒绝。

6. **`outbox_consumed` 消费去重表**

   每个消费者在处理业务副作用的同一数据库事务中插入：

   - `consumer_name`
   - `event_id`
   - `tenant_id`
   - `consumed_at`
   - `result_status`

   以 `(consumer_name, event_id)` 建立唯一约束。唯一冲突代表事件已经处理，消费者直接确认成功。

7. **Prisma 自管乐观锁**

   在 `goals`、`tasks`、`feedbacks` 等并发更新实体增加 `version INT DEFAULT 0`。更新条件必须同时包含主键与当前版本，并执行 `version = version + 1`；受影响行数为零时返回 HTTP `409 CONFLICT`。

### 6.3 Java 栈技术栈装配

Prolog AgentTeam 推荐如下装配：

1. 使用 **Spring Modulith Event Publication Registry** 持久化事务内应用事件发布记录。
2. 业务实体通过 Hibernate `@Version` 实现乐观锁，重点覆盖规则、规则版本、发布状态和自进化任务。
3. 在业务事务内发布领域事件，由 Spring Modulith 在事务提交后驱动外部化处理。
4. 增加外部消息适配器，将 Modulith 事件转换为统一事件信封，再投递给实际下游执行通道。
5. 外部投递失败时保留未完成 Publication，由 Registry 重试或运维补偿，不允许仅记录日志后丢弃。
6. Java 消费 Node 事件或其他外部事件时，同样使用 `outbox_consumed`，并以 `(consumer_name, event_id)` 唯一约束实现持久化去重。
7. Node 与 Java 共用 `eventId`、`eventType`、`eventVersion`、`tenantId`、`aggregateType`、`aggregateId`、`correlationId`、`causationId`、`idempotencyKey` 和 `payload` 字段定义。

### 6.4 BullMQ 是否保留

**结论：保留为下游执行器，不充当主 Outbox。**

BullMQ 继续承担异步任务调度、延迟执行、并发控制和 Worker 重试，但不负责业务事务与事件记录之间的原子一致性。

需要特别修正“BullMQ 原生提供 DLQ”的表述：

- BullMQ 能保存最终失败 Job，但不会自动形成完整的业务 DLQ 治理机制。
- 系统必须显式定义独立 DLQ Queue、进入条件、原始事件信息、错误信息、告警、重放和人工关闭流程。
- Outbox 是可靠事件源，BullMQ Job 是可重建的执行载体。
- Redis 或 BullMQ 数据丢失后，应允许根据 Outbox 状态重新投递。

### 6.5 ADR-0005 裁决

**裁决结论：局部修订（Provisional → Accepted，需同步修订实现边界与错误表述）。**

保留“Transactional Outbox + BullMQ”的总体方向，但必须修订实现边界和错误表述。ADR 状态应在修订完成后由 `Provisional` 变更为 `Accepted`。

具体修订要点如下：

1. **显式定义 DLQ**：删除“BullMQ 自带失败队列即可作为 DLQ”的表述。定义独立 DLQ Queue、最大重试次数、进入条件、告警、重放、人工确认和审计字段。
2. **增加幂等键管理和持久化记录**：写接口引入 `Idempotency-Key` 和 `node-idempotency`；明确请求指纹冲突规则、结果缓存周期，以及反馈等业务场景的唯一约束。
3. **Java 栈引入 Spring Modulith**：明确 ADR 同时覆盖 Node 与 Java：Node 使用自研 Prisma Outbox，Java 使用 Spring Modulith Event Publication Registry，不要求两个技术栈共享同一实现库。
4. **明确 LISTEN/NOTIFY 仅作加速**：PostgreSQL 轮询和 `SKIP LOCKED` 是可靠投递主路径；`LISTEN/NOTIFY` 只负责降低轮询延迟，不能作为唯一触发机制。
5. **增加消费端 `outbox_consumed` 表**：所有产生持久化副作用的消费者必须在业务事务内写消费记录，并以 `(consumer_name, event_id)` 唯一约束实现去重。
6. **增加 Prisma `version` 字段**：为目标、任务、反馈等并发更新聚合增加自管乐观锁；Java 实体使用 Hibernate `@Version`，统一以版本冲突阻止丢失更新。

---

## 7. 若采纳的回写清单

| 文件 | 回写段落 | 改动要点 |
|---|---|---|
| `docs/ADR/ADR-0005-workflow-bullmq-outbox.md` | 文档头、`Decision`、`Consequences` | 将状态由 `Provisional` 改为 `Accepted`，标题删除“暂定”；写入 Node 自研 Outbox、Spring Modulith、BullMQ 下游执行器定位，以及 §6.5 列出的六项修订。 |
| `docs/XCDOS_TDD_V1_企业决策与执行操作系统.html` | `二、技术栈选型`、`三、总体技术架构` | 在 PostgreSQL 与 BullMQ 之间增加 Transactional Outbox、Outbox Relay；明确 BullMQ 不承担主 Outbox，补充 `node-idempotency` 和乐观锁技术选型。 |
| `docs/XCDOS_TDD_V1_企业决策与执行操作系统.html` | `九、工作流与异步任务设计`（含 BullMQ 队列、领域事件） | 增加业务事务写 Outbox、Relay 轮询、`SKIP LOCKED`、`LISTEN/NOTIFY` 唤醒、重试退避、独立 DLQ 和统一事件信封字段。 |
| `docs/XCDOS_详细设计文档_LLD_V1.0.html` | `五、核心 UseCase 编排`中的 `CreateGoalUseCase`、`SubmitFeedbackUseCase` | 将“保存后直接发布事件”改为 Prisma `$transaction` 内同时更新业务表和写 `outbox_events`；增加 `Idempotency-Key` 校验和版本条件更新。 |
| `docs/XCDOS_详细设计文档_LLD_V1.0.html` | `六、定时任务与异步任务设计`、`幂等性设计原则` | 补充 Relay 领取 SQL、失败退避、DLQ 路由、`outbox_consumed` 去重事务；删除仅依赖 Redis Key 或业务状态判断幂等的设计。 |
| `docs/XCDOS_数据库设计文档_DB_Design_V1.0.html` | `二、全量表结构`、`三、索引设计` | 新增 `outbox_events`、`outbox_consumed`、接口幂等记录表；为 `goals`、`tasks`、`feedbacks` 增加 `version`；为反馈增加业务幂等唯一约束 `(tenant_id, task_id, submitter_id, business_date)`。 |
| `docs/XCDOS_数据库设计文档_DB_Design_V1.0.html` | `2.4 Agent 与审计域`中的 `domain_events` | 区分领域事件审计记录与待投递 Outbox；禁止用 `domain_events` 的定期清理策略误删尚未成功投递或仍需补偿的事件。 |
| `docs/XCDOS_测试用例文档_V1.0.html` | `三、异常测试`、`五、并发与性能测试` | 增加事务回滚不产生 Outbox、进程崩溃后补投、重复投递只消费一次、通知丢失仍被轮询发现、Relay 多实例无重复领取、DLQ 告警与重放、版本冲突返回 409 等用例。 |
| `docs/Prolog AgentTeam 智能交互工厂 - 总体技术方案（V1.2）.md` | `三、核心技术栈选型`、`4.2 规则配置与调度模块`、`7.1 高可用保障机制` | 引入 Spring Modulith Event Publication Registry、Hibernate `@Version` 和外部消息适配器；定义规则发布事件、失败重试、未完成 Publication 恢复及统一事件信封。 |
| `docs/Prolog AgentTeam 智能交互工厂 - 数据库详细设计文档（DB Design V1.2）.md` | `三、全局通用字段定义`、`四、核心数据表详细设计` | 增加 Modulith Event Publication Registry 所需表、`outbox_consumed` 表；为 `rule_prolog`、`rule_snapshot` 和自进化任务增加 `version`；定义 `(consumer_name, event_id)` 唯一索引。 |
| `docs/Prolog AgentTeam 智能交互工厂 - 测试用例文档（V1.2）.md` | `四、规则配置与调度模块测试用例`、`十、高可用、异常与容灾测试用例` | 增加规则保存与事件记录原子性、重复事件去重、Publication 重试恢复、外部适配器故障补投、服务重启不丢事件、`@Version` 并发更新冲突等用例。 |

ADR-0005 状态变更说明：完成本清单全部回写、确认 BullMQ DLQ/幂等表述被纠正、`outbox_events` 与 `outbox_consumed` 表落地后，将 ADR-0005 由 `Provisional` 切换为 `Accepted`，并在 `History` 段落记录“Block D 调研 2026-06-11 → 局部修订 → Accepted”。

---

## 8. 调研证据

### 8.1 Codex CLI 调用次数

本轮调研共调用 Codex CLI **5 次**，调用主题依次如下：

1. 能力定义 + 候选清单（命令：`codex exec --skip-git-repo-check --sandbox read-only "...聚焦第 1、2 节..."`）
2. 横向对比表 + 关键观察（命令：`codex exec --skip-git-repo-check --sandbox read-only "...输出第 3 节横向对比表，列头：项目/类别/Stars/最近提交/License/Outbox 模式/DLQ 原生支持/幂等键支持/PG LISTEN-NOTIFY 集成/双栈兼容/备注..."`）
3. 与契约匹配度 + 适配工作量（命令：`codex exec --skip-git-repo-check --sandbox read-only "...输出第 4、5 节..."`）
4. 推荐方案 + 回写清单（命令：`codex exec --skip-git-repo-check --sandbox read-only "...输出第 6、7 节，并对 ADR-0005 给出明确裁决..."`）
5. 调研证据汇总（本次调用）

### 8.2 返回片段摘录

> **片段 1（来自第 2 次调用）**：'BullMQ 原生支持失败重试、失败任务集合和退避策略，但没有自动将耗尽重试的任务转投独立队列的第一类 DLQ'

> **片段 2（来自第 2 次调用）**：'PostgreSQL 14 的稳妥基线是 Outbox 表加 FOR UPDATE SKIP LOCKED 轮询'

> **片段 3（来自第 1 次调用）**：'Transactional Outbox：业务数据与待发布事件在同一数据库事务中落库，消除"业务提交成功但事件发送失败"的双写不一致'

> **片段 4（来自第 3 次调用）**：'XCDOS 的 Prisma 5 没有 Hibernate 式自动版本管理，需要增加 version INT @default(0)，更新时使用 id + version 条件并原子递增'

> **片段 5（来自第 4 次调用）**：'裁决结论：局部修订。保留"Transactional Outbox + BullMQ"的总体方向，但必须修订实现边界和错误表述。ADR 状态应在修订完成后由 Provisional 变更为 Accepted'

### 8.3 人工核验待办

1. 在 GitHub 实地核验 8 个候选项目的精确 Stars、Forks 数量与最近提交时间（本卡片采用截至 2026-06 的近似数据）。
2. 核验 `mahendraHegde/node-idempotency` 的项目活跃度、Issue 响应速度与生产可用性（Star 数较低，需评估替代方案如自研中间件或 Stripe-style 实现）。
3. 核验 Spring Modulith Event Publication Registry 的最新版本是否支持本项目使用的 Spring Boot 版本，以及是否需要额外配置 JPA 实体扫描。
4. 核验 Debezium 在本项目 PostgreSQL 部署环境下的逻辑复制槽限制、运维成本（如选 C 方案）。
5. 核验 AWS Powertools TypeScript Idempotency 在非 Lambda 环境下的可移植性（如考虑作为 node-idempotency 的备选）。

### 8.4 调研边界声明

本调研中关于 BullMQ 重试机制、PostgreSQL Outbox 模式、`FOR UPDATE SKIP LOCKED` 语义、Spring Modulith 事件登记机制以及 Hibernate `@Version` 行为，基于公开通用技术知识，可直接作为方案设计依据。
方案 B 的人天估算、风险等级和回写位置属于架构层面的初步判断，可作为提测前 P0/P1 排期的输入。
GitHub Stars、Forks、最近提交和版本发布时间等动态数据基于截至 2026-06 的公开信息，未实地确认，使用前请按 §8.3 进行人工核验。
开源 License 已根据公开来源核验为 MIT / MIT-0 / Apache-2.0，无 LGPL / GPL / AGPL 红线项目，但商业使用前仍应按企业合规流程二次确认。
最终选型还需结合 PoC（事务事件原子性、DLQ 重放、跨服务消费幂等）、性能压测和故障恢复测试确认。

---

> 文档生成日期：2026-06-11
> 调研执行人：Codex Bridge Agent（gpt-5 Codex CLI）
> 关联 Block：A（多租户）、D（Outbox / DLQ / 幂等中间件，本卡片）
