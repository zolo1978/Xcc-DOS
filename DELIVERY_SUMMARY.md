# XCDOS + Prolog AgentTeam 交付总结 V1

> 日期：2026-06-19 ｜ 阶段：MVP 双产品全栈成型 ｜ 仓库：zolo1978/Xcc-DOS（main，PR #1–16 全合入）

## 一、总览

从「评审 HOLD（12 P0）」起步，经契约止血 → 开源萃取 → 工具层换原生 codex MCP → 双产品全栈开发，达成：

| 产品 | 后端 | 前端 | 测试 | 状态 |
|---|---|---|---|---|
| **XCDOS**（决策执行 OS）| NestJS + Prisma + PG（101 ts）| Next.js 14 + Arco（15 文件）| vitest 30/30 真库 | 全栈 MVP |
| **Prolog AgentTeam**（智能交互工厂）| Spring Boot 3.5 + Hibernate6 + PG（109 java）| Vue3 + Element Plus（23 文件）| 单测 25/25 | 全栈 MVP |

## 二、决策基线（docs/ADR/，11 份）

| ADR | 决策 |
|---|---|
| 0001 | Prolog 主库 PostgreSQL 14+（MySQL 列 V2）|
| 0002 | XCDOS ORM = Prisma 5.x（multiSchema）|
| 0003 | 密码 Argon2id（禁 MD5/bcrypt）|
| 0004 | 多租户 schema-per-tenant（Tier-A/B/C，JWT 唯一信任源）|
| 0005 | 工作流 BullMQ + Transactional Outbox（Accepted）|
| 0006 | 能用现成不造轮子（产品层 + 工具层）|
| 0007 | Prolog 混合方案：自建底座 + Langflow 嵌入 |
| 0008 | LLM 网关 sub2api（内测订阅号，商用前切官方 Key）|

## 三、Gate 1 事实源（机器可验）

- `docs/api/xcdos_openapi.yaml`：OpenAPI 3.1，redocly 校验通过
- `docs/ddl/xcdos_schema.sql`：PostgreSQL DDL，docker PG14 实跑 19 表零错误
- `docs/XCDOS_需求清单与需求基线_V1.0.html`：RTM 25/25 全覆盖
- 12/12 P0 + 关键 P1 全部关闭

## 四、XCDOS 能力清单

后端（src/）：auth（login/refresh/logout/sessions，jti 黑名单）· goals（乐观锁/软删除）· problems · decision-cases（拆-推-评-算）· hypotheses · forecasts（版本化）· evaluations · roi · report（approved-plan 闭环）· plans（状态机 + 审批职责分离）· tasks（planId approved 校验）· feedbacks（修订链 + 同日唯一）· exceptions · dashboard · agent-runs（cancel）· outbox（relay + DLQ + 去重）· Agent Runtime（LlmGatewayPort + Sub2ApiAdapter）

前端（web/）：登录 + 路由守卫 · 老板驾驶舱（KPI + Superset 占位）· 目标 CRUD · 决策四阶段 Stepper · 方案审批 · 任务 · 反馈修订

一键起栈：docker-compose（pg + redis + api + web）· 全链 E2E 冒烟（登录→…→反馈，含 403/422/409 守卫断言）

## 五、Prolog 能力清单

后端（prolog/）：多租户（Hibernate schema-per-tenant）· 认证（Argon2id + JWT）· 租户管理 · 规则 CRUD/灰度发布/版本快照回滚 · 同义词 · 会话 · 请求日志（脱敏白名单 P1-13）· 自进化（聚类 F-017 / 候选生成 F-018 / AI 审核工作流 F-020）· Langflow 嵌入（LangflowGatewayPort）· Quartz 定时

前端（prolog/web-admin/）：登录 · 规则管理（灰度/回滚）· 自进化审核（approve/reject）· 同义词 · 租户/会话

## 六、遗留清单（全部为外部基础设施部署，非代码）

| 项 | 性质 | 解除条件 |
|---|---|---|
| Superset guest token 真接入 | 需部署 Superset 实例 | 部署后配 guest token |
| sub2api / Langflow 真实例联调 | 需部署网关 + 订阅号凭证 | 部署后配 env URL/KEY，Mock→真适配器 |
| 容器栈实跑（api/web 镜像）| docker build 镜像 | docker daemon 可用时 compose up |
| Testcontainers 集成测试 | 本机 Mac DinD 限制 | CI（GitHub Actions，原生 Docker）可跑 |
| 合规签署 | 法务/安全人工 | 数据合规清单待签 |
| 压测 / 容灾证据 | Gate 3 准入 | 上线前补 |

## 七、协作模式（本阶段实践）

- **Claude Code**：规划 + 审计（不写业务代码）。每个 Sprint 实测 tsc/test/build/compile，不信 codex 回报。
- **codex（原生 MCP）**：执行体，写代码 + 改 bug。
- **审计抓出并修复的 codex 缺陷**：Hibernate5 已删 API、vitest decorator metadata 缺失、集成测试 race、假 tsc=0（非法 ignoreDeprecations）、WebMvcTest 漏 mock、TS7053 索引、误提交 .m2/target/node_modules。
- **环境绕障**：DNS 黑洞 maven 域名 → Docker 网络；本机 JDK25 → Docker JDK21；docker 挂 → 宿主 redis。

## 八、下一阶段建议

1. 配 CI（GitHub Actions）：跑 Testcontainers IT + 前端 build + redocly + DDL 校验，把"本机 DinD 受限未跑"的集成测试在 CI 跑绿。
2. 部署 Superset / sub2api / Langflow 实例，Mock 适配器切真。
3. Prolog 一键起栈 docker-compose（对齐 XCDOS）。
4. Gate 3 准入：压测 + 容灾 + 安全测试 + 合规签署。
