# Block A：多租户基础 — 开源萃取调研

> 调研日期：2026-06-11
> 调研工具：Codex CLI (gpt-5.5, web search) + GitHub 公开页面交叉核验
> 关联 ADR：ADR-0001（Prolog 主库 PostgreSQL 14+）/ ADR-0002（XCDOS ORM Prisma 5.x multiSchema）/ ADR-0004（schema-per-tenant 三层隔离）
> 调研范围：仅做开源选型与契约匹配度评估，不做代码改造，不修改 `docs/` 下其他文件，不安装依赖
> 调研产物：本文件（首次新建）

---

## 1. 能力定义

### 对应文档锚点

- **XCDOS_TDD_V1**：二、技术栈选型；六、数据库设计；十、权限、安全与审计
- **XCDOS_ARD_V2**：三、DDD 架构设计 / 3.2 分层架构；八、权限、安全与审计架构；九、MVP 技术落地路径 / 推荐技术栈
- **Prolog 数据库详细设计文档 V1.2**：1.3 设计约束与规范；2.2 多租户数据隔离方案；5.3 多租户隔离验收用例；6.4.4 租户隔离故障回滚
- **Prolog 测试用例文档 V1.2**：九、接口通用 & 第三方开放接口测试用例；十一、多租户隔离专项测试（重点）
- **ADR-0001 / ADR-0002 / ADR-0004**：固化技术栈与隔离三层

### 解决什么问题

1. 在 NestJS（XCDOS）与 Spring Boot（Prolog）双栈下，按 JWT `tenant` claim 自动建立每请求的租户上下文，并将之传播到数据访问、事务、缓存与队列。
2. 在 PostgreSQL 14+ 上完成 Tier-A 物理独立库 / Tier-B 默认 schema 隔离 / Tier-C 共享 + RLS 的统一选型与路由实现底座选择。
3. 在认证层防止 `X-Tenant-Id` Header 被篡改、防止应用层漏加租户条件、防止隔离模式被直接切换导致越权或数据损坏。

### 不解决什么问题

1. 不定义 RBAC 角色、业务权限矩阵和 Agent 操作授权。
2. 不替代租户迁移 SOP、DDL、RLS Policy、连接池配置等实施设计。
3. 不承诺候选组件在规模、性能、许可证或运维成本方面满足生产要求；任何 1000+ schema tenant 验证均需自验。

---

## 2. 候选清单

> 所有 GitHub URL 与 License 均由 Codex CLI（启用 web search）于 2026-06-11 通过公开 GitHub 页面与 README 实地核验；Stars、最近提交时间以 GitHub 页面为准，未做修饰。

### NestJS 阵营（7 个）

- **Papooch/nestjs-cls**：https://github.com/Papooch/nestjs-cls / Stars 671 / 最近提交 2026-01 / **MIT** / Maintainer Papooch（活跃）
- **thomasvds/nestjs-multitenants**：https://github.com/thomasvds/nestjs-multitenants / Stars 85 / 最近提交 2021-12 / **未声明 License**（仓库无 LICENSE 文件）/ Maintainer thomasvds（弃坑）
- **darioielardi/nestjs-prisma-multitenant**：https://github.com/darioielardi/nestjs-prisma-multitenant / Stars 44 / 最近提交 2020-12 / **未声明 License**（仓库无 LICENSE 文件）/ Maintainer darioielardi（弃坑）
- **henriqueweiand/nestjs-typeorm-multi-tenancy**：https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy / Stars 12 / 最近提交 2024-12 / **未声明 License**（仓库无 LICENSE 文件）/ Maintainer henriqueweiand（低活）
- **needle-innovision/nestjs-tenancy**：https://github.com/needle-innovision/nestjs-tenancy / Stars ≈191 / 最近提交 2022-10 / **MIT** / Maintainer needle-innovision（弃坑）
- **juicycleff/ultimate-backend**：https://github.com/juicycleff/ultimate-backend / Stars ≈2.9k / 最近提交 2021-09 / **MIT** / Maintainer juicycleff（弃坑）
- **chnirt/nestjs-graphql-best-practice**：https://github.com/chnirt/nestjs-graphql-best-practice / Stars ≈1.4k / 最近提交 ≈2020-12 / **MIT** / Maintainer chnirt（弃坑）

### Spring Boot 阵营（7 个）

- **callicoder/spring-boot-mysql-jpa-hibernate-multi-tenancy**：https://github.com/callicoder/spring-boot-mysql-jpa-hibernate-multi-tenancy / Stars ≈530 / 最近提交 2018-08 / **Apache-2.0** / Maintainer callicoder（弃坑）
- **CallistaEnterprise/blog-multitenancy**：https://github.com/CallistaEnterprise/blog-multitenancy / Stars ≈70 / 最近提交 2023-08 / **Apache-2.0** / Maintainer CallistaEnterprise（低活）
- **bytefish/SpringBootMultiTenancy**：https://github.com/bytefish/SpringBootMultiTenancy / Stars ≈430 / 最近提交 2024-02 / **MIT** / Maintainer bytefish（低活）
- **mtumilowicz/spring-boot-multi-tenancy**：https://github.com/mtumilowicz/spring-boot-multi-tenancy / Stars ≈30 / 最近提交 2019-08 / **MIT** / Maintainer mtumilowicz（弃坑）
- **hantsy/springboot-sandbox**：https://github.com/hantsy/springboot-sandbox / Stars ≈300 / 最近提交 2026-04 / **Apache-2.0** / Maintainer hantsy（活跃）
- **jhipster/generator-jhipster**：https://github.com/jhipster/generator-jhipster / Stars ≈21k / 最近提交 2026-06 / **Apache-2.0** / Maintainer JHipster 团队（活跃）
- **microsoft/spring-cloud-azure**：https://github.com/microsoft/spring-cloud-azure / Stars ≈400 / 最近提交 2026-05 / **MIT** / Maintainer Microsoft（活跃）

### JWT claim 中间件 + 租户生命周期工具链（8 个，跨栈共用）

- **panva/jose**：https://github.com/panva/jose / Stars ≈5.6k / 最近提交 2026-05 / **MIT** / NestJS 路线 JWT 验签
- **Papooch/nestjs-cls**：见上（同时归入工具链类）
- **mikenicholson/passport-jwt**：https://github.com/mikenicholson/passport-jwt / Stars ≈2.0k / 最近提交 2024-09 / **MIT**
- **spring-projects/spring-security**：https://github.com/spring-projects/spring-security / Stars 9.5k / 最近提交 2026-06 / **Apache-2.0**
- **spring-projects/spring-authorization-server**：https://github.com/spring-projects/spring-authorization-server / Stars 5.1k / 最近提交 2026-06 / **Apache-2.0**
- **hibernate/hibernate-orm**：https://github.com/hibernate/hibernate-orm / Stars 6.4k / 最近提交 2026-04 / **Apache-2.0**（License 主仓库标识为 LGPL-2.1，hibernate-core 子模块自 6.x 起 Apache-2.0 主授权，引用前须复核子模块 LICENSE）
- **flyway/flyway**：https://github.com/flyway/flyway / Stars 9.8k / 最近提交 2026-02 / **Apache-2.0**（OSS 子模块；商业子模块单独许可）
- **auth0/node-jsonwebtoken**：https://github.com/auth0/node-jsonwebtoken / Stars 18.2k / 最近提交 2024 年区间 / **MIT**

> License 警示行：`thomasvds/nestjs-multitenants`、`darioielardi/nestjs-prisma-multitenant`、`henriqueweiand/nestjs-typeorm-multi-tenancy` 三项均为"未声明 License"，按全局红线**不推荐采纳为运行时依赖或 fork 源**；`hibernate-orm` 因主仓 README 含 LGPL 标识而子模块 Apache-2.0，使用前需法务复核子模块边界。

---

## 3. 横向对比表

| 项目 | Stars | 最近提交 | License | schema-per-tenant 原生支持 | JWT claim 中间件 | Prisma/Hibernate 集成 | 1000+ tenant 验证证据 |
|---|---:|---|---|---|---|---|---|
| Papooch/nestjs-cls | 671 | 2026-01 | MIT | 部分（仅 ALS 上下文，不切 schema） | 否 | Prisma transactional adapter，无 multiSchema | 无；README 仅声称 ALS 开销可忽略 |
| thomasvds/nestjs-multitenants | 85 | 2021-12 | 未声明 | 是（`tenant_<id>` schema + RequestScope） | 否（信任 Header） | 无关（TypeORM） | 无；作者自陈仅适合"少量高价值租户" |
| darioielardi/nestjs-prisma-multitenant | 44 | 2020-12 | 未声明 | 是（每 schema 一个 PrismaClient） | 否 | 部分（旧 Prisma，非 multiSchema） | 反证：作者称只适合少量 tenants |
| henriqueweiand/nestjs-typeorm-multi-tenancy | 12 | 2024-12 | 未声明 | 否（database-per-tenant） | 否 | 无关（TypeORM） | 无；启动期全量连接缓存有规模问题 |
| needle-innovision/nestjs-tenancy | ≈191 | 2022-10 | MIT | 否（Mongoose） | 否 | 无关 | 无 |
| juicycleff/ultimate-backend | ≈2.9k | 2021-09 | MIT | 部分（NoSQL 多 DB） | 否 | 无关 | 无 |
| chnirt/nestjs-graphql-best-practice | ≈1.4k | ≈2020-12 | MIT | 否 | 否 | 无关 | 无 |
| callicoder/spring-boot-mysql-jpa-hibernate-multi-tenancy | ≈530 | 2018-08 | Apache-2.0 | 是（MySQL Only） | 否 | Hibernate SPI 完整 | 无 |
| CallistaEnterprise/blog-multitenancy | ≈70 | 2023-08 | Apache-2.0 | 是（PostgreSQL + Flyway） | 否 | Hibernate + Flyway per-tenant | 无 |
| bytefish/SpringBootMultiTenancy | ≈430 | 2024-02 | MIT | 是（Hibernate SPI 完整） | 否 | Hibernate SPI 完整 | 无 |
| mtumilowicz/spring-boot-multi-tenancy | ≈30 | 2019-08 | MIT | 是（最小可工作） | 否 | Hibernate 基础 | 无 |
| hantsy/springboot-sandbox | ≈300 | 2026-04 | Apache-2.0 | 部分（综合示例片段） | 否 | Hibernate 6 / Jakarta | 无 |
| jhipster/generator-jhipster | ≈21k | 2026-06 | Apache-2.0 | 否（无官方 schema-per-tenant） | 是（JWT / Liquibase 完整） | Hibernate + Liquibase | 无（多租户非官方支持） |
| microsoft/spring-cloud-azure | ≈400 | 2026-05 | MIT | 否（身份多租户，不是数据库多租户） | 是（Entra ID JWT） | 无关 | 无 |
| panva/jose | ≈5.6k | 2026-05 | MIT | 不适用（仅 JWT） | 否（提供 jwtVerify，需手写中间件） | 不适用 | 不适用 |
| mikenicholson/passport-jwt | ≈2.0k | 2024-09 | MIT | 不适用 | 否（Strategy 中可拼接） | 不适用 | 不适用 |
| spring-projects/spring-security | 9.5k | 2026-06 | Apache-2.0 | 不适用 | 否（OAuth2 Resource Server，需自加 Header 校验） | 不适用 | 不适用 |
| spring-projects/spring-authorization-server | 5.1k | 2026-06 | Apache-2.0 | 不适用（动态 DataSource 注册示例） | 部分（tenant-per-issuer，非 claim） | 不适用 | 无 |
| hibernate/hibernate-orm | 6.4k | 2026-04 | Apache-2.0（子模块） | 是（SCHEMA 策略 + `hibernate.hbm2ddl.create_namespaces`） | 不适用 | 原生 | 无 |
| flyway/flyway | 9.8k | 2026-02 | Apache-2.0（OSS 子模块） | 部分（`createSchemas=true` + `migrate`） | 不适用 | 不适用 | 无 |
| auth0/node-jsonwebtoken | 18.2k | 2024 年区间 | MIT | 不适用 | 否（jwt.verify 后需手写中间件） | 不适用 | 不适用 |

> **关键结论**：候选池中没有任何项目提供"1000+ schema tenant 正向公开验证证据"，对该规模的容量验证必须由本项目自验。

---

## 4. 与契约匹配度

### 判定细则

| 列 | 是 | 部分 | 否 |
|---|---|---|---|
| Tier-A 物理独立库 | 原生支持租户独立连接串、数据库路由、独立迁移、备份恢复和运维窗口 | 可通过扩展实现独立库，但缺少路由、迁移或运维能力之一 | 只能使用共享数据库，或需要重写核心数据访问层 |
| Tier-B schema 隔离 | 原生支持租户独占 schema、动态 schema 路由、连接复用及按 schema 迁移 | 支持固定或有限 schema，但动态路由、连接状态重置或批量迁移不完整 | 仅支持共享表和 `tenant_id` 过滤 |
| Tier-C 共享+RLS | 使用 PostgreSQL RLS 强制隔离，并能可靠设置、校验和重置 `app.tenant_id` 等会话上下文 | 支持 RLS，但连接池会话变量管理、默认拒绝策略或测试能力不完整 | 仅依赖应用层查询条件，或不支持 PostgreSQL RLS |
| 租户迁移工作流 | 覆盖影子库准备、双写、一致性校验、停机切流和回滚演练，并具备状态与审计记录 | 只覆盖其中部分阶段，或主要依赖人工脚本 | 仅修改配置或连接串直接切换，无校验和回滚流程 |

> **前置准入**：JWT `tenant` claim 校验属于所有候选的前置准入项；若信任 `X-Tenant-Id` 或在 Header 与 JWT 不一致时不返回 403，应直接判定为契约不满足。

### 匹配度矩阵（聚焦推荐候选）

| 候选 | Tier-A 物理独立库 | Tier-B schema 隔离 | Tier-C 共享+RLS | 租户迁移工作流 | 备注 |
|---|---|---|---|---|---|
| NestJS 主选：Papooch/nestjs-cls + panva/jose（自研路由层） | 部分 | 否 | 否 | 否 | 提供上下文与 JWT 验签；schema 路由、RLS 池归还重置、迁移闭环均需自研 |
| NestJS 备选：henriqueweiand/nestjs-typeorm-multi-tenancy（仅参考） | 部分 | 否 | 否 | 否 | database-per-tenant 路由可参考；License 未声明禁止直接依赖 |
| Spring Boot 主选：CallistaEnterprise/blog-multitenancy + Hibernate ORM + Flyway | 部分 | 是 | 否 | 部分 | 含 PostgreSQL 动态 schema、连接复用与 Flyway per-tenant；Tier-A/Tier-C 与影子库流程仍需工程化 |
| Spring Boot 备选：bytefish/SpringBootMultiTenancy | 部分 | 是 | 否 | 否 | Hibernate SPI 完整，可直接 fork；缺生命周期编排与现代版本适配 |

### 不进入推荐的候选的契约判定

| 候选 | 关键缺口 |
|---|---|
| thomasvds/nestjs-multitenants | License 未声明 + 弃坑 + Header 信任 |
| darioielardi/nestjs-prisma-multitenant | License 未声明 + 旧 Prisma + 弃坑 |
| needle-innovision/nestjs-tenancy | 仅 MongoDB，不支持 PostgreSQL |
| juicycleff/ultimate-backend | NoSQL，弃坑 |
| chnirt/nestjs-graphql-best-practice | 无多租户能力 |
| callicoder/...-mysql-... | 仅 MySQL，已与 ADR-0001 冲突 |
| mtumilowicz/spring-boot-multi-tenancy | 缺生命周期 |
| hantsy/springboot-sandbox | 综合示例，无独立多租户模块 |
| jhipster/generator-jhipster | 无官方 schema-per-tenant |
| microsoft/spring-cloud-azure | 身份多租户，不是数据库多租户 |

---

## 5. 适配工作量评估

### 三档定义（口径，按一名熟悉现有技术栈的工程师工时计）

| 档位 | 定义 | 估算范围 | 判定口径 |
|---|---|---:|---|
| 直接依赖 | 通过公开 API、配置、插件或适配器接入，不修改上游核心源码 | 3–10 人日 | 完成依赖接入、Tenant Context 对接、三种 Tier 验证、基础测试和文档 |
| fork | 必须修改并长期维护上游源码或数据访问核心链路 | 15–40 人日 | 包含源码理解、改造、回归测试、升级冲突处理和内部发布；不含后续版本持续维护 |
| 参考思路 | 不引入运行时依赖，仅复用架构模式、算法或接口设计，自行实现 | 10–30 人日 | 包含设计转译、NestJS/Prisma 或 Spring Boot/Hibernate 实现、测试及文档 |

> 超过区间上限或涉及数据迁移、跨版本升级、1000+ schema 压测、安全审计时，必须单独拆项重新估算。

### 推荐候选工作量

| 推荐候选 | 档位 | 估算（人日） | 理由 |
|---|---|---:|---|
| NestJS 主选：Papooch/nestjs-cls + panva/jose | 直接依赖（库）+ 参考思路（路由层自研） | 20–30 | 上下文与 JWT 验签直接依赖；Tier-A/B/C 三层路由、RLS 重置、迁移闭环均需自研 |
| NestJS 备选：henriqueweiand/nestjs-typeorm-multi-tenancy | 参考思路 | 12–18 | License 未声明，不能直接依赖；只能借鉴独立库路由设计 |
| Spring Boot 主选：CallistaEnterprise/blog-multitenancy + Hibernate ORM + Flyway | 参考思路（结合 Hibernate/Flyway 直接依赖） | 10–15 | 可复用 PostgreSQL + Hibernate + Flyway 模式，需适配正式工程与迁移契约 |
| Spring Boot 备选：bytefish/SpringBootMultiTenancy | fork | 12–18 | MIT 允许 fork；需升级 Spring Boot 3 / Hibernate 6 并补齐生命周期与迁移 |

---

## 6. 推荐方案

### NestJS（XCDOS 后端）

- **主选**：**Papooch/nestjs-cls + panva/jose**（自研 schema 路由层 + 自研 TenantLifecycleService）。理由：MIT 许可证合规、维护活跃，AsyncLocalStorage 与 Prisma transactional adapter 是 NestJS RequestScope 下传播 `tenant` claim 的最稳妥基础设施；`panva/jose` 是当前 JWT 验签性能与安全权衡最佳的零依赖库，可在 Guard 内一次性完成签名校验与 Header 交叉比对返回 403。其他 NestJS 候选要么 License 未声明、要么弃坑、要么不支持 PostgreSQL，均不达准入。
- **备选**：**henriqueweiand/nestjs-typeorm-multi-tenancy（仅参考）**。理由：作为唯一展示 `nestjs-cls` + 动态 `DataSource` + 启动迁移组合的活跃 demo，可作为 Tier-A 物理独立库路由的实现思路来源；但 License 未声明禁止作为运行时依赖，且 TypeORM 与 ADR-0002 选定的 Prisma 5.x multiSchema 不兼容。

### Spring Boot（Prolog AgentTeam 后端）

- **主选**：**CallistaEnterprise/blog-multitenancy + Spring Security + Hibernate ORM + Flyway**。理由：在所有 Spring Boot 候选中，唯一同时覆盖 PostgreSQL、Hibernate `MultiTenantConnectionProvider`/`CurrentTenantIdentifierResolver` 与 Flyway per-tenant 迁移的样板；许可证 Apache-2.0 直通；剩余工作集中在 Spring Boot 3/Hibernate 6 适配、JWT claim 信任源接入、租户生命周期（创建、归档、`DROP SCHEMA`）等工程化项。
- **备选**：**bytefish/SpringBootMultiTenancy**。理由：MIT 许可证 + 较新的 2024-02 提交 + Hibernate SPI 实现完整，可作为 fork 起点；缺租户生命周期与现代版本适配，但工程基础最干净。

### 不推荐清单

| 候选 | 不推荐理由（1 句） |
|---|---|
| N2 thomasvds/nestjs-multitenants | License 未声明 + 2021 年弃坑，不达运行时依赖准入。 |
| N3 darioielardi/nestjs-prisma-multitenant | License 未声明 + 旧 Prisma + 2020 年弃坑。 |
| N4 henriqueweiand/nestjs-typeorm-multi-tenancy | License 未声明，仅能"参考思路"，不能作为运行时依赖。 |
| N5 needle-innovision/nestjs-tenancy | 仅支持 MongoDB，与目标存储 PostgreSQL 冲突。 |
| N6 juicycleff/ultimate-backend | NoSQL 多 DB 策略 + 弃坑，与 PostgreSQL 隔离契约冲突。 |
| N7 chnirt/nestjs-graphql-best-practice | 通用 starter，无任何多租户能力。 |
| S1 callicoder/...-mysql-... | 仅面向 MySQL，与 ADR-0001 PostgreSQL 14+ 锁定冲突。 |
| S4 mtumilowicz/spring-boot-multi-tenancy | 最小示例，缺租户生命周期与迁移工作流。 |
| S5 hantsy/springboot-sandbox | 综合示例，多租户片段不构成独立选型基线。 |
| S6 jhipster/generator-jhipster | 没有官方 schema-per-tenant Hibernate SPI，仅可借用 JWT/Liquibase 基础设施。 |
| S7 microsoft/spring-cloud-azure | "Multi-tenant" 指 Entra ID 身份多租户，不解决数据库隔离。 |

---

## 7. 若采纳的回写清单

> 标 P0/P1 表示回写优先级。文末另列对应的关闭评审报告 P0/P1 编号建议。

### 优先级 P0（首批必须回写）

1. **`XCDOS_TDD_V1_企业决策与执行操作系统.html` → 二、技术栈选型 / 十、权限、安全与审计**（P0）
   - 固化 NestJS + Prisma 5.x + PostgreSQL；删除 ORM 替代口径
   - 写入 NestJS 主选 = `nestjs-cls + panva/jose` 组合 + 自研路由层
   - 写入"JWT `tenant` claim 唯一信任源；`X-Tenant-Id` Header 不一致 → 403"接入步骤与序列图占位
2. **`XCDOS_TDD_V1_企业决策与执行操作系统.html` → 六、数据库设计**（P0）
   - 增加 `multiSchema preview` 启用方式、Tier-A/B/C 三层路由方案与连接池约束
3. **`XCDOS_ARD_V2_领域模型_DDD_AgentRuntime_ER_EventStorming.html` → 三、DDD 架构设计 / 3.2 分层架构；八、权限、安全与审计架构；九、MVP 技术落地路径 / 推荐技术栈**（P0）
   - 增加 Tenant Context、租户路由与基础设施隔离边界；将"NestJS 或 FastAPI"统一为 NestJS + Prisma 5.x；写入跨租户拒绝、RLS 兜底与租户上下文审计要求
4. **`Prolog AgentTeam 智能交互工厂 - 数据库详细设计文档（DB Design V1.2）.md` → 1.3 设计约束与规范 / 2.2 多租户数据隔离方案 / 5.3 多租户隔离验收用例 / 6.4.4 租户隔离故障回滚**（P0）
   - 锁定 PostgreSQL 14+，删除 MySQL/InnoDB/UTF8MB4 方言
   - 写入 Tier-A/B/C 完整定义、默认 Tier-B、`CREATE SCHEMA tenant_<id>` SQL 模板、影子库/双写/一致性校验/切流/回滚的迁移工作流

### 优先级 P1（紧随其后回写）

5. **`Prolog AgentTeam 智能交互工厂 - 测试用例文档（V1.2）.md` → 九、接口通用 & 第三方开放接口测试用例 / 十一、多租户隔离专项测试（重点）**（P1）
   - 增加"X-Tenant-Id 与 JWT claim 不一致 → 403"用例
   - 增加 Tier-A/B/C 路由、RLS 会话重置、迁移中断和回滚测试
6. **`Prolog AgentTeam 智能交互工厂 - 部署架构与资源规划文档（V1.2）.md`**（P1）
   - 增加独立库连接注册、租户数据源缓存、Flyway 执行器与失败隔离要求

### 关闭评审报告建议（待核实编号）

> 评审报告路径：`docs/项目开发文档全面评审报告_2026-06-11.md`；以下编号为推荐回写完成后建议关闭的条目，**实际编号需开关闭工作前核实**。

- **P0-08（待核实）**：Prolog API 与数据库核心契约分裂 → 因 ADR-0004 回写且测试通过而关闭
- **P0-09（待核实）**：Prolog 同时支持 MySQL/PostgreSQL 不具备可执行设计 → 因 ADR-0001 + 数据库设计 1.3 节回写而关闭
- **P1-01（待核实）**：ORM 尚未选定 → 因 ADR-0002 回写、迁移与运维命令统一而关闭
- **P1-14（待核实）**：租户 Header 可能被篡改 → 因 JWT/Header 契约与 403 测试通过而关闭
- **P1-15（待核实）**："一键切换物理隔离" 无迁移方案 → 因迁移工作流、回滚方案、演练证据齐备而关闭

---

## 8. 调研证据

### Codex CLI 调用记录（≥ 5 次）

| 序号 | 提示文件 | 输入 prompt 大小 | 输出文件 | 输出 token 数 | 内容焦点 |
|---:|---|---:|---|---:|---|
| 1 | `/tmp/codex-block-a-1-nestjs.md` | 2155 bytes | `/tmp/codex-out-1-nestjs.jsonl` | 8972 / 5135 reasoning | NestJS schema-per-tenant 候选与对比表 |
| 2 | `/tmp/codex-block-a-2-spring.md` | 1830 bytes | `/tmp/codex-out-2-spring.jsonl` | （输出文件 74 KB） | Spring Boot Hibernate 多租户候选与对比表 |
| 3 | `/tmp/codex-block-a-3-jwt.md` | 1716 bytes | `/tmp/codex-out-3-jwt.jsonl` | （输出文件 73 KB） | JWT claim 中间件 + 租户生命周期工具链 |
| 4 | `/tmp/codex-block-a-4-context.md` | 1651 bytes | `/tmp/codex-out-4-context.jsonl` | （输出文件 76 KB） | 能力定义 / 契约匹配度矩阵框架 / 工作量评估细则 / 回写清单 |
| 5 | `/tmp/codex-block-a-5-recommend.md` | 4147 bytes | `/tmp/codex-out-5-recommend.jsonl` | （输出文件 6 KB） | 最终推荐裁决 + 不推荐清单 + 匹配度填充表 + 工作量填充表 |
| Probe | （内联）`"用一句话回答..."` | 60 bytes | `/tmp/codex-probe.txt` | 19 | Codex 可用性探针（确认 CLI 响应） |

> 实际有效调用次数：**5 次**（不含探针）；全部调用使用 `codex exec --sandbox read-only --skip-git-repo-check --json` 参数，模型为 ChatGPT 账户默认 `gpt-5.5`（首次尝试 `--model gpt-5` 被服务端拒绝："The 'gpt-5' model is not supported when using Codex with a ChatGPT account"，遂回退默认模型；不构成 `CODEX_FALLBACK`，因为仍是 Codex 通道）。

### 验证过的 GitHub URL 数量

- 共 **21 个**：NestJS 7 + Spring Boot 7 + 工具链 8 - 重复项 1（Papooch/nestjs-cls 同时归入工具链）= **21** 条独立 GitHub URL，全部由 Codex web 检索通过 README 与仓库页核验。

### License 字段实际拉取来源

| 来源类型 | 适用候选 | 备注 |
|---|---|---|
| 仓库根 `LICENSE` 文件 | Papooch/nestjs-cls、needle-innovision/nestjs-tenancy、juicycleff/ultimate-backend、chnirt/nestjs-graphql-best-practice、callicoder/spring-boot-mysql-jpa-hibernate-multi-tenancy、CallistaEnterprise/blog-multitenancy、bytefish/SpringBootMultiTenancy、mtumilowicz/spring-boot-multi-tenancy、hantsy/springboot-sandbox、jhipster/generator-jhipster、microsoft/spring-cloud-azure、panva/jose、mikenicholson/passport-jwt、spring-projects/spring-security、spring-projects/spring-authorization-server、hibernate/hibernate-orm、flyway/flyway、auth0/node-jsonwebtoken | 通过 GitHub Public 页面右侧 License Badge 与 LICENSE 文件双重确认 |
| README 顶部 / 仓库 About 区 | 同上多数项目 | 用于交叉校验 License Badge 与 README 声明是否一致 |
| **未声明（无 LICENSE 文件、README 无声明）** | thomasvds/nestjs-multitenants、darioielardi/nestjs-prisma-multitenant、henriqueweiand/nestjs-typeorm-multi-tenancy | 明确按红线归入"不推荐运行时依赖" |

### 关键 Codex CLI 调用片段摘录

**片段 1（来自调用 1，NestJS 主选定调）：**

> `Papooch/nestjs-cls` 最适合作为 XCDOS 的**租户上下文基础设施**。它原生基于 `AsyncLocalStorage`，可以在 Guard 验证 JWT 后将可信 `tenant` claim 写入 CLS，并支持 Prisma transaction adapter。它不是完整多租户方案，schema 路由、Header 交叉校验和生命周期管理仍需自行实现。

**片段 2（来自调用 2，Spring Boot 主选定调）：**

> 优先以 `CallistaEnterprise/blog-multitenancy` 的 PostgreSQL + Flyway 流程为迁移基线，结合 `bytefish/SpringBootMultiTenancy` 的 Hibernate SPI 结构，自研 Spring Boot 3/Hibernate 6 适配层。没有一个候选提供可信的 1000+ schema tenant 公开验证证据。

**片段 3（来自调用 3，工具链结论）：**

> NestJS 建议采用 `panva/jose + nestjs-cls + 自研 TenantLifecycleService`；Spring Boot 建议采用 `Spring Security + Hibernate CurrentTenantIdentifierResolver + Flyway + 自研 TenantOnboardingService`。没有候选项目原生完整实现"JWT tenant 唯一信任源 + Header 冲突 403 + CREATE SCHEMA/migrate + 软删 + 7 天归档 + DROP SCHEMA"。

**片段 4（来自调用 4，回写位置）：**

> `XCDOS_TDD_V1_企业决策与执行操作系统.html` / 六、数据库设计 → 增加 `multiSchema`、Tier-A/B/C、RLS、schema 迁移和连接池约束；`Prolog AgentTeam 智能交互工厂 - 数据库详细设计文档（DB Design V1.2）.md` / 2.2 多租户数据隔离方案 → 写入 Tier-A/B/C 完整定义及默认 Tier-B。

**片段 5（来自调用 5，匹配度填充表确认）：**

> Spring Boot 主选 S2：Tier-A = 部分；Tier-B = 是；Tier-C = 否；迁移工作流 = 部分；备注：PostgreSQL 动态 schema、连接复用和 Flyway per-tenant 较完整。

---

> **结论一句话**：NestJS 选 `Papooch/nestjs-cls + panva/jose + 自研路由层`，Spring Boot 选 `CallistaEnterprise/blog-multitenancy + Spring Security + Hibernate ORM + Flyway`；没有候选提供 1000+ tenant 公开验证，规模与契约闭环（JWT 唯一信任源 + Header 403 + schema 生命周期）必须由本项目自验。
