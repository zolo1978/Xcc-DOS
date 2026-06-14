# ADR-0001：Prolog 主库锁定 PostgreSQL 14+

- **Status**：Accepted
- **Date**：2026-06-11
- **Decision Makers**：产品负责人 / 技术负责人 / DBA

## Context

评审报告 P0-09 指出：Prolog 数据库设计 V1.2 第 22 行同时声明 MySQL 8 / PostgreSQL 14+，字段层却使用 `datetime`、`tinyint`、`ON UPDATE CURRENT_TIMESTAMP`、UTF8MB4、InnoDB 等 MySQL 方言；联合部署文档混用 MySQL binlog 与 PostgreSQL 工具链。当前文档体系无法生成单一可执行 DDL、迁移脚本、索引方案与运维手册。

XCDOS 已锁定 PostgreSQL，若 Prolog 继续双轨，DAO 层、迁移工具、运维 SOP、监控指标全部翻倍。

## Decision

V1.2 锁定 **PostgreSQL 14+** 作为 Prolog 唯一主数据库。MySQL 8 兼容性列入 V2 路线图，V1.2 移除所有 MySQL 方言字段定义、binlog 表述与 InnoDB 引擎声明。

## Consequences

### Positive

- DDL、迁移、DAO 单一化，可直接由 Prisma Migrate / Flyway 生成与执行。
- 与 XCDOS 共享 PostgreSQL 工具链（`pg_dump`、`wal-g`、`pgbouncer`、`pg_stat_statements`），运维成本下降约 40%。
- JSONB、Row Level Security、partition、CTE 等特性可直接用于多租户隔离与审计场景。

### Negative

- 计划中"国产/金融场景 MySQL 客户"V1.2 阶段无法直接交付，销售口径需注明。
- 现有按 MySQL 编写的字段方言需全量改写为 PostgreSQL 等价物。

## Alternatives Considered

| 方案 | 结论 | 理由 |
|---|---|---|
| 双轨支持 MySQL 8 / PostgreSQL 14+ | 放弃 | DAO 方言、迁移工具、运维 SOP 翻倍，与"模块化单体优先"原则矛盾 |
| 锁定 MySQL 8 | 放弃 | XCDOS 已选 PG，Prolog 改 PG 总成本最低；PG JSONB / RLS 在多租户场景下优势显著 |

## Related

- 评审报告：P0-09
- 文档行号：`Prolog AgentTeam - 数据库详细设计文档（DB Design V1.2）.md:22`
- 后续动作：触发 Prolog DB Design V1.2 字段方言全量改写（Step 3 回写）
