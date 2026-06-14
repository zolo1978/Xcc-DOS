# ADR-0002：XCDOS ORM 选定 Prisma 5.x

- **Status**：Accepted
- **Date**：2026-06-11
- **Decision Makers**：技术负责人 / 后端 Lead

## Context

评审报告 P1-01 指出：XCDOS DB Design 第 86-87 行仍为"TypeORM / Prisma 待定"，但联合运维手册已默认 TypeORM，造成文档口径分裂。Sprint 0 前必须定稿，否则迁移命令、CI 钩子、代码生成器都无法统一。

## Decision

选定 **Prisma 5.x**。Schema 文件 `prisma/schema.prisma` 作为唯一数据模型源；迁移用 Prisma Migrate；多 schema 多租户场景启用 `multiSchema` preview feature。

## Consequences

### Positive

- 类型生成严格，编译期捕获大多数 schema 不一致；Prisma Client 自动派生 TypeScript 类型。
- Schema 文件可作为 DDL 的可执行事实源，直接对接 Step 2 萃取调研的"技术事实源"建设。
- 与 Next.js App Router / RSC 兼容性良好；官方支持 edge runtime（虽然 XCDOS 主要走 Node runtime）。
- 迁移工作流（`migrate dev` / `migrate deploy`）官方维护，CI 集成方案成熟。

### Negative

- 动态 SQL 与复杂报表能力弱于 TypeORM Query Builder，需借助 `$queryRaw` 或独立报表工具。
- `multiSchema` 仍为 preview feature，1000+ tenant 场景需在 Step 2 萃取阶段做基准测试。
- Prisma 连接池模型（每实例独立池）需与 PgBouncer 协调（建议使用 transaction mode + `directUrl` 旁路迁移）。

## Alternatives Considered

| 方案 | 结论 | 理由 |
|---|---|---|
| TypeORM 0.3+ | 放弃 | 0.3 版本以来多次破坏性变更；装饰器方案与 Next.js RSC 弱兼容；运维默认值不构成选型理由 |
| Drizzle ORM | 放弃 | 生态成熟度尚不足以承载企业级审计 / 迁移需求；Schema 演进路径未稳定 |
| Kysely + 手写 migration | 放弃 | 类型推导优秀但缺少迁移工具；研发人力成本高 |

## Related

- 评审报告：P1-01
- 文档行号：`XCDOS_数据库设计文档_DB_Design_V1.0.html:86-87`
- 关联 ADR：ADR-0001（PG）、ADR-0004（schema-per-tenant，依赖 multiSchema）
- 后续动作：联合运维手册中"TypeORM"全量替换为"Prisma"
