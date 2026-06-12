# 架构决策记录索引（ADR Index）

本目录采用 MADR 简化格式记录关键架构决策。所有 ADR 一经 Accepted 即作为 XCDOS / Prolog 双系统的"事实源"，OpenAPI、DDL、运维 SOP、测试用例必须与之对齐。Provisional 状态的 ADR 可在后续阶段被新证据推翻。

## 索引

| 编号 | 标题 | 状态 | 日期 | 关闭的评审项 |
|---|---|---|---|---|
| [ADR-0001](./ADR-0001-prolog-primary-db.md) | Prolog 主库锁定 PostgreSQL 14+ | Accepted | 2026-06-11 | P0-09 |
| [ADR-0002](./ADR-0002-xcdos-orm-prisma.md) | XCDOS ORM 选定 Prisma 5.x | Accepted | 2026-06-11 | P1-01 |
| [ADR-0003](./ADR-0003-password-argon2id.md) | 密码方案统一为 Argon2id | Accepted | 2026-06-11 | P0-07 |
| [ADR-0004](./ADR-0004-multi-tenant-schema-per-tenant.md) | 多租户隔离采用 schema-per-tenant | Accepted | 2026-06-11 | P0-08 / P1-14 / P1-15 |
| [ADR-0005](./ADR-0005-workflow-bullmq-outbox.md) | 工作流执行 BullMQ + Transactional Outbox | Provisional | 2026-06-11 | P0-06 / P1-05 |

## 状态约定

- **Proposed**：草稿，未定稿
- **Accepted**：已定稿，全文档需对齐
- **Provisional**：暂定稿，等待后续证据，可被替换
- **Superseded by ADR-XXXX**：被新 ADR 替换
- **Deprecated**：弃用

## 模板

新增 ADR 时遵循以下 6 节结构：

1. Status / Date / Decision Makers
2. Context
3. Decision
4. Consequences（Positive / Negative）
5. Alternatives Considered
6. Related（评审项 / 文档行号 / 其他 ADR）
