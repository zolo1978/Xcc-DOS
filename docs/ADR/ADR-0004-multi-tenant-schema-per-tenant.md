# ADR-0004：多租户隔离采用 schema-per-tenant

- **Status**：Accepted
- **Date**：2026-06-11
- **Decision Makers**：架构师 / 安全负责人 / DBA

## Context

评审报告：
- P0-08：Prolog API 声明隔离模式为 `schema/shared`，DB 声明"物理独立库/共享行级"，三方语义分裂。
- P1-14：API 要求客户端传 `X-Tenant-Id`，未明确必须与 JWT claim 绑定，存在篡改风险。
- P1-15：声称"一键切换物理隔离"，但未定义搬迁、校验、双写、回滚和停机窗口。

## Decision

### 默认模式

**schema-per-tenant**（PostgreSQL schema 级别隔离）：每个租户独占一个 schema，`public` schema 仅放租户元表（`tenants`、`tenant_users`、`tenant_quotas`）。

### 分层策略

| Tier | 适用客户 | 模式 | 备注 |
|---|---|---|---|
| Tier-A | 金融 / 政务 / 大客户 | 物理独立数据库 | 独立连接串、独立备份、独立运维窗口 |
| Tier-B | 默认 | schema-per-tenant | 单库多 schema，连接池按 schema 切换 |
| Tier-C | 自助试用 / 小客户 | 共享 schema + Row Level Security | RLS 策略强制 `tenant_id = current_setting('app.tenant_id')` |

### 租户身份信任源

- **服务端只信任 JWT 内 `tenant` claim**。
- `X-Tenant-Id` Header 仅作路由提示，与 JWT claim 不一致时**返回 403 Forbidden**。
- 切换租户必须重新登录或显式调用租户切换 API（重新签发 JWT）。

### 迁移路径

Tier 间迁移（如 Tier-B → Tier-A）必须走"租户迁移工作流"，包括：影子库准备 → 双写 → 一致性校验 → 停机切流 → 回滚演练。**禁止直接修改配置切换隔离模式**。

## Consequences

### Positive

- PostgreSQL 原生 schema 支持，备份 / 恢复 / 迁移路径清晰；`pg_dump --schema` 可单租户导出。
- Prisma `multiSchema` 兼容；连接池可按 schema 维度复用。
- Tier 化策略匹配商务定价，且为后续多区域部署留空间。

### Negative

- 跨租户聚合查询（平台运营报表）需走 ETL / 物化视图，不能直接 JOIN。
- schema 数量 > 1000 时 PostgreSQL 元数据查询（`information_schema`）变慢，需配合 partman / 分库策略。
- RLS（Tier-C）需注意所有连接必须重置 session 变量，否则有越权读风险。

## Alternatives Considered

| 方案 | 结论 | 理由 |
|---|---|---|
| 全部 shared schema + RLS | 放弃 | 企业级客户对"物理隔离感"有合规诉求 |
| 全部独立库 | 放弃 | 1000+ 租户运维成本不可接受 |
| 应用层 tenant_id 过滤（无 RLS） | 放弃 | 误漏一处即越权，需要 DB 层兜底 |

## Related

- 评审报告：P0-08, P1-14, P1-15
- 关联 ADR：ADR-0001（PG）、ADR-0002（Prisma multiSchema）
- 后续动作：
  - 补充"租户迁移工作流"详细 SOP
  - API 文档统一 `X-Tenant-Id` 信任语义
  - 测试用例增加"X-Tenant-Id 与 JWT claim 不一致"的 403 用例
