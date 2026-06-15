# sub2api 二开调研报告

> 调研日期：2026-06-14
> 数据源：sub2api 全源码（`/tmp/sub2api`，Go + Gin + Ent + Vue3 + PG18 + Redis8）
> 适用范围：MVP 内测期（接订阅号，ADR-0008 阶段限定）
> 对照系统：XCDOS（NestJS + Prisma + PG，UUID PK + org_id 多租户）、Prolog AgentTeam（Spring Boot + Hibernate，tenant_id 隔离）
> 前置基线：[ADR-0008 LLM 网关层采用 sub2api](../ADR/ADR-0008-llm-gateway-sub2api.md)、[block-z1a-license.md](./block-z1a-license.md)、[block-z1b-matrix.md](./block-z1b-matrix.md)

---

## 1. 项目全貌（技术栈 / 分层 / 成熟度 / star）

| 维度 | sub2api 实况 |
|---|---|
| 仓库 | [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api)（Trendshift 收录） |
| License | **LGPLv3**（block-z1a 已核验：独立部署 + 网络调用 = 聚合关系，不传染业务代码；**禁 fork 源码**） |
| 后端 | Go 1.26 + Gin + Ent ORM + PostgreSQL 18 + Redis 8 |
| 前端 | Vue 3 Composition API + Pinia + Vue Router + Axios + TailwindCSS + i18n |
| 部署 | Dockerfile（三阶段：pnpm9 build → Go embed → alpine3.21 非 root）+ docker-compose（全栈/standalone 双形态）+ install.sh（systemd）+ Caddyfile |
| 定位 | 多账号 LLM 代理网关 + 多租户 SaaS 计费后台（账号池 / 粘性会话 / 计费 / 限流 / 熔断 / SSRF 防护 / 支付 / OAuth） |
| 成熟度 | 生产级：gateway_service.go 单文件 10177 行、SettingsView.vue 9783 行、GroupsView.vue 4351 行（巨型组件是其反面）；ops 监控 6 表 + Dashboard 物化聚合 + 熔断器三态；鉴权层（JWT/TOTP/APIKey/Admin）测试覆盖最厚 |

**分层结论**：sub2api 的「网关基础设施层」与「SaaS 后台业务层」耦合在同一进程，但代码内部按 `internal/service`（业务）、`internal/handler`（HTTP）、`internal/server/middleware`（中间件）、`ent/schema`（数据模型）边界清晰。对 XCDOS / Prolog 而言，复用边界是「网关基础设施层 + 鉴权层」，业务层全部独立。

**与 XCDOS / Prolog 技术栈对照**：

| 系统 | 栈 | 域模型 | 主键 | 多租户 |
|---|---|---|---|---|
| sub2api | Go + Gin + Ent | Account/Group/APIKey/UsageLog/PaymentOrder | BIGSERIAL | **无**（单租户 SaaS） |
| XCDOS | NestJS + Prisma + TS | Goal/Problem/DecisionCase/Task/Feedback/AgentRun | UUID | org_id（ADR-0004 schema-per-tenant） |
| Prolog | Spring Boot + Hibernate | Rule/Session/Synonym/Tenant | BIGINT/UUID | tenant_id（ADR-0001） |

---

## 2. 后端网关核心（账号池 / 调度 / 计费 / 限流 / 熔断 / 粘性会话）

网关核心全部集中在 `backend/internal/service/`（无独立 gateway 目录，与 service 合并），`gateway_service.go` 单文件 10177 行。整体是生产级实现，**直接复用率约 70%，二开集中在三处**：计费落库目标、Forward 协议伪装层、平台分发 handler。

### 2.1 账号池调度（两层策略）

| 机制 | file:line | 说明 |
|---|---|---|
| Claude 负载感知调度主入口 | `backend/internal/service/gateway_service.go:1534`（SelectAccountWithLoadAwareness） | 粘性优先 → 模型路由 → 过滤排除/窗口费用/RPM/配额 → `tryAcquireAccountSlot` 抢并发槽 → 失败回退 `WaitPlan` 排队 |
| Legacy 优先级 + 最近使用排序 | `backend/internal/service/gateway_service.go:2188` | 非负载感知路径：`sortAccountsByPriorityAndLastUsed` 顺序抢槽 |
| OpenAI 加权随机调度器 | `backend/internal/service/openai_account_scheduler.go:889` | `buildOpenAIAccountLoadPlan` → 加权随机（minScore 平移防垄断）→ TTFT/errorRate/loadRate 评分 |
| 调度快照服务（热路径） | `backend/internal/service/scheduler_snapshot_service.go:31` | 内存缓存账号/分组热数据，outbox 事件驱动增量刷新，DB 不可用时 fallbackLimiter 兜底 |
| 调度配置 | `backend/internal/service/gateway_service.go:2214`（schedulingConfig） | StickySessionMaxWaiting=3 / WaitTimeout=45s / FallbackMaxWaiting=100 / LoadBatchEnabled=true |
| 窗口费用过滤 | `backend/internal/service/gateway_service.go:2656`（isAccountSchedulableForWindowCost） | Anthropic OAuth 账号按 5h 窗口累计费用过滤 |
| RPM 过滤 | `backend/internal/service/gateway_service.go:2752`（isAccountSchedulableForRPM） | 超 BaseRPM-StickyBuffer 的账号降级为仅粘性可用 |

**XCDOS 接入点**：`SelectAccountWithLoadAwareness` 的粘性 + 负载感知逻辑可直接复用为 agent_run 上游选号，`agent_run.run_id` 作为 sessionHash 源（见 §6 路线图）。

### 2.2 粘性会话（三层 hash 源 + Redis 存储）

| 机制 | file:line | 说明 |
|---|---|---|
| Hash 生成（三层源） | `backend/internal/service/gateway_service.go:725`（GenerateSessionHash） | `metadata.user_id` 的 `session_xxx` > `cache_control ephemeral` 内容 hash > system+messages 摘要 fallback |
| 绑定 / 查询 | `backend/internal/service/gateway_service.go:788` | Redis 存 group→sessionHash→accountID，TTL=1h（stickySessionTTL） |
| 摘要链 fallback（Gemini/OpenAI） | `backend/internal/service/digest_session_store.go:27` | 内存 go-cache，key=groupID:prefixHash\|digestChain，TTL 5min |
| OpenAI Anthropic 兼容 digest 链 | `backend/internal/service/openai_messages_digest_session.go:17` | 复用 Anthropic `prompt_cache_key` |
| 会话数限制（per-account） | `backend/internal/service/gateway_service.go:2800`（checkAndRegisterSession） | 仅 Anthropic OAuth，sessionLimitCache 限并发会话数 + 空闲超时 |

**Prolog 接入点**：Prolog `session_id` 直接作为 sessionHash 入参，保证同会话路由到同上游账号（保持上下文缓存命中），降本效果显著。

### 2.3 计费（订阅 / 余额双模式 + 三档滑动窗口）

| 机制 | file:line | 说明 |
|---|---|---|
| 成本计算（token / cache / image / long-context） | `backend/internal/service/billing_service.go:466`（CalculateCostUnified/CalculateCost） | 按 model + input/output/cache_read/cache_creation/image/long-context 倍率算 USD，支持 channel pricing/service tier |
| 用量记录 + 扣费主流程 | `backend/internal/service/gateway_service.go:8894`（recordUsageCore） | 解析费率倍数（用户>分组>系统）→ 算成本 → 判断订阅/余额计费 → 写 usage_log → 异步 finalizePostUsageBilling 累加 user×platform 配额 |
| 计费缓存 + 熔断器 | `backend/internal/service/billing_cache_service.go:917`（billingCircuitBreaker） | closed/open/halfOpen 三态，DB 写失败超阈值熔断，保护 Redis 已扣费但 DB 写失败场景 |

**⚠️ 二开点**：`recordUsageCore` 强耦合 sub2api 的 `BillingTypeBalance`/`Subscription` 双模式 + `UserPlatformQuota` 表。对接 XCDOS 时落库目标需改写为 `agent_runs`（XCDOS DDL 已预留 `cost_cents NUMERIC(10,4)` / `llm_account_id` / `gateway_request_id` 三字段，见 `docs/ddl/xcdos_schema.sql:246-250`）。Prolog 侧改为按 tenant × session 维度配额。

### 2.4 限流（账号并发槽 + 用户并发 + RPM + session）

| 机制 | file:line | 说明 |
|---|---|---|
| 并发槽服务（Redis 信号量） | `backend/internal/service/concurrency_service.go:165`（AcquireAccountSlot/AcquireUserSlot） | Redis 原子计数 maxConcurrency，ReleaseFunc 异步释放（5s 超时），maxConcurrency<=0 无限 |

### 2.5 熔断（按上游厂商协议精确分流）

| 机制 | file:line | 说明 |
|---|---|---|
| 错误处理主入口 | `backend/internal/service/ratelimit_service.go:164`（HandleUpstreamError） | 按状态码分流：400 org-disabled/credit/KYC 永久禁用、401 OAuth 刷新冷却、403 handleOpenAI403/Antigravity403、429 handle429 |
| 429 限流冷却（精确重置时间） | `backend/internal/service/ratelimit_service.go:873`（handle429） | OpenAI 解析 `x-codex-*` 头、Anthropic 解析 5h/7d reset 头、Gemini 解析 body |
| 429 fallback 冷却配置 | `backend/internal/service/ratelimit_service.go:985`（apply429FallbackRateLimit） | 无精确重置时间时按可配置 cooldown 秒级冷却 |
| 临时停调度（retryable） | `backend/internal/service/gateway_service.go:590`（TempUnscheduleRetryableError） | 400→tempUnscheduleGoogleConfigError，502→tempUnscheduleEmptyResponse |

### 2.6 上游协议适配（接口抽象 + 5 平台分发）

| 机制 | file:line | 说明 |
|---|---|---|
| 上游 HTTP 客户端接口 | `backend/internal/service/http_upstream_port.go:9`（HTTPUpstream） | `Do`/`DoWithTLS`，支持按账号绑定代理 + TLS 指纹伪装（profile） |
| 转发主入口 | `backend/internal/service/gateway_service.go:4485`（Forward） | 分发 Bedrock/APIKey passthrough/Claude Code mimicry/Web 搜索模拟 → SSE/usage 提取 → 重试 |
| 平台分发 handler | `backend/internal/handler/gateway_handler.go:793` | 按 account.Platform 分流：Antigravity→antigravityGatewayService.Forward，其余→gatewayService.Forward |
| Claude OAuth token provider | `backend/internal/service/claude_token_provider.go:21` | access_token 缓存 + 提前 3min 刷新 + singleflight 防并发刷新 |

**⚠️ 二开点**：Forward 主入口含 Claude Code mimicry（system prompt 重写 / metadata 注入 / billing attribution block）、TLS 指纹伪装、WebSocket v2 转发等订阅号伪装专用逻辑。XCDOS 内部 agent 调用应裁剪，但裁剪边界需谨慎（部分与计费关联）。

### 网关核心复用结论

- **直接复用（保持原样）**：账号选择、粘性会话、并发槽、熔断、限流、调度快照、429 精确重置时间、token provider。这些通过接口抽象（HTTPUpstream / BillingCache / ConcurrencyCache / AccountRepository）已解耦。
- **需二开（3 处）**：
  1. `recordUsageCore`（`gateway_service.go:8894`）计费落库目标 → XCDOS `agent_runs` / Prolog tenant 计费表；
  2. `Forward`（`gateway_service.go:4485`）协议伪装层裁剪；
  3. `gateway_handler.go:793` 平台分流对接目标系统路由层。
- **代码债风险**：`gateway_service.go` 单文件 10177 行，违反「小文件原则」，二开前必须按职责拆分（selection / forward / billing / error-handling），否则 diff 风险极高。

---

## 3. 数据库模型（Ent 实体 + 关系表，对照 XCDOS DDL / Prolog DB）

schema 源头：`backend/ent/schema/*.go`（37 个实体文件）+ `backend/migrations/`（150+ SQL）。通用 mixin：`TimeMixin`（created_at/updated_at）+ `SoftDeleteMixin`（deleted_at 拦截器）。

### 3.1 核心实体（计费 / 配额 / 日志）

| 实体 | path | 用途 | 复用 |
|---|---|---|---|
| User | `backend/ent/schema/user.go:19-145` | email 部分唯一 / password_hash / role / balance(decimal 20,8) / concurrency / totp_* / signup_source(7 种) / rpm_limit | 直接复用 |
| Account | `backend/ent/schema/account.go:28-239` | AI 凭证池：platform/type/credentials(JSONB 加密) / 调度热路径字段（rate_limited_at / overload_until / temp_unschedulable_until） | 直接复用 |
| APIKey | `backend/ent/schema/api_key.go:17-148` | 用户调用密钥 + 三档滑动窗口限流（5h/1d/7d）+ IP 黑白名单 | 直接复用 |
| Group | `backend/ent/schema/group.go:17-197` | 账号分组/计费档：rate_multiplier / subscription_type / model_routing(JSONB) / fallback_group_id / claude_code_only | 直接复用 |
| UsageLog | `backend/ent/schema/usage_log.go:20-211` | 只追加调用日志，6 类 token + decimal(20,10) 成本快照 + rate_multiplier 快照 + duration_ms/first_token_ms，11 个索引 | 直接复用 |
| UserSubscription | `backend/ent/schema/user_subscription.go:19-119` | 用户订阅绑定 + 三档窗口配额（daily/weekly/monthly_window_start + _usage_usd） | 直接复用 |
| PaymentOrder | `backend/ent/schema/payment_order.go:22-199` | 支付订单（硬删除）+ refund_* 审计 + provider_snapshot(JSONB) | 直接复用 |
| UserPlatformQuota | `backend/ent/schema/user_platform_quota.go:17-113` | user×platform 独立配额（anthropic/openai/gemini/antigravity），nil=无限 / 0=禁用 | 直接复用 |

### 3.2 鉴权 / 营销 / 运维实体

| 实体 | path | 用途 | 复用 |
|---|---|---|---|
| AuthIdentity | `backend/ent/schema/auth_identity.go:35-97` | 规范化登录身份（7 provider：email/github/google/linuxdo/oidc/wechat/dingtalk），三元唯一 | 直接复用 |
| PendingAuthSession | `backend/ent/schema/pending_auth_session.go` | 短时授权决策会话（login/bind_current_user/adopt_existing_user_by_email 三态机） | 需二开（2 人天） |
| RedeemCode / PromoCode / SubscriptionPlan | `backend/ent/schema/*.go` | 兑换码 / 注册优惠 / 订阅套餐商品 | 直接复用 |
| PaymentProviderInstance | `backend/ent/schema/payment_provider_instance.go:21-74` | 微信/支付宝支付通道实例（加密密钥） | 直接复用 |
| Proxy | `backend/ent/schema/proxy.go:15-89` | 出站代理配置 + fallback_mode + backup_proxy_id 自引用 | 直接复用 |
| SecuritySecret | `backend/ent/schema/security_secret.go` | 系统级密钥 KV（JWT/TOTP 加密密钥） | 直接复用 |
| IdempotencyRecord | `backend/ent/schema/idempotency_record.go` | 幂等记录 + response 缓存 + locked_until | 直接复用 |
| ChannelMonitor | `backend/ent/schema/channel_monitor.go` | 渠道心跳探活 + 子表 histories/daily_rollup/request_templates | 直接复用 |
| TLSFingerprintProfile | `backend/ent/schema/tls_fingerprint_profile.go` | TLS 指纹模板（模拟 Claude Code 握手） | 直接复用 |

### 3.3 Ops 监控表簇（`backend/migrations/033_ops_monitoring_vnext.sql`）

ops_error_logs（错误分级 P0-P3）/ ops_retry_attempts / ops_system_metrics / ops_job_heartbeats / ops_alert_rules / ops_alert_events + ops_metrics_hourly/daily 维度聚合。**直接复用**，可补足 XCDOS / Prolog 的可观测性缺口。

### 3.4 UsageLog 物化聚合（`backend/migrations/034_usage_dashboard_aggregation_tables.sql`）

usage_dashboard_hourly/_daily/_hourly_users/_daily_users + aggregation_watermark（水位线），避免全表扫 usage_logs。**直接复用**。

### 3.5 对照 XCDOS DDL / Prolog DB

| 维度 | sub2api | XCDOS（`docs/ddl/xcdos_schema.sql`） | Prolog（ADR-0001） | 缺口 |
|---|---|---|---|---|
| 主键 | BIGSERIAL | UUID（gen_random_uuid()） | BIGINT/UUID | 跨系统对账需维护映射表 |
| 多租户 | **无** org_id/tenant_id | org_id + schema-per-tenant（ADR-0004） | tenant_id | 单租户独立部署隔离（内测期不做） |
| 业务域 | Account/Group/Key/Payment | Goal/Problem/DecisionCase/Task/Feedback/AgentRun | Rule/Session/Synonym | XCDOS / Prolog 侧自建 |
| 计费精度 | decimal(20,8) 配额 / decimal(20,10) 成本 | cost_cents NUMERIC(10,4) 单位分 | tenant 计费表 | **换算口径需明确**（ADR-0008 已定 subscription/official_api 双模式） |
| 软删除 | SoftDeleteMixin 全局 | 各表 deleted_at | Hibernate @SQLDelete | 跨库直查须带 `WHERE deleted_at IS NULL` |

### 3.6 数据模型复用结论

- **整体复用度 85%+**，内测期接订阅号场景几乎无需改造 schema。User/AuthIdentity/UserSubscription/PaymentOrder/UsageLog/RedeemCode/PromoCode/SecuritySecret/IdempotencyRecord 全部直接可用。
- **二开缺口（3 处）**：
  1. 多租户字段（无 tenant_id）—— 内测期靠独立部署隔离，不做 schema 改造；
  2. 业务域表（goal/decision_case/task/feedback/agent_run 等）—— XCDOS / Prolog 侧自建，sub2api 仅通过 `agent_runs.llm_account_id` / `gateway_request_id` 松耦合对账（已预留，`xcdos_schema.sql:246-250`）；
  3. Prolog 规则 / 同义词 / 会话表 —— 完全不在 sub2api 模型内，Prolog 独立维护。

### 3.7 对账字段映射（关键）

| sub2api | XCDOS / Prolog | 用途 |
|---|---|---|
| `usage_logs.request_id` | `agent_runs.gateway_request_id` | 请求链路对账 |
| `accounts.id`（BIGINT，转字符串） | `agent_runs.llm_account_id` VARCHAR(64) | 上游账号标识 |
| `usage_logs.input_tokens` / `output_tokens` / `total_cost` | `agent_runs` token / cost_cents | 成本回传 |
| `payment_orders.out_trade_no` | XCDOS / Prolog 订单号 | 支付对账（若复用 sub2api 支付层） |

---

## 4. 前端 UI（页面 / 组件 / 状态 / 路由，标可复用 vs 需改造）

Vue3 Composition API + Pinia + Vue Router + Axios + TailwindCSS + i18n 标准管理后台。**与 XCDOS（React/Next/TypeScript）技术栈完全异构**，但管理后台骨架范式高度成熟，可平移复用率约 60%。

### 4.1 骨架层（直接复用）

| 组件 | path | 用途 | 复用 |
|---|---|---|---|
| AppLayout | `frontend/src/components/layout/AppLayout.vue:1` | 全局布局壳（Sidebar + Header + main） | 直接复用 |
| AppSidebar | `frontend/src/components/layout/AppSidebar.vue:717` | admin/user 双角色导航，computed 分组 + featureFlag 过滤 | 直接复用（追加 XCDOS / Prolog 菜单组，0.5 人天） |
| AppHeader | `frontend/src/components/layout/AppHeader.vue` | logo / version / announcement bell / locale / dark toggle | 直接复用 |
| TablePageLayout | `frontend/src/components/layout/TablePageLayout.vue` | 标准 CRUD 页骨架（filters + table + pagination slot） | 直接复用 |
| AuthLayout | `frontend/src/components/layout/AuthLayout.vue` | 登录/注册壳 | 直接复用 |
| DataTable | `frontend/src/components/common/DataTable.vue` | columns 配置驱动 + 排序 + skeleton + cell slot + 分页 | 直接复用 |
| Pagination / BaseDialog / ConfirmDialog / StatCard / Toast | `frontend/src/components/common/*.vue` | 通用控件集 | 直接复用 |
| 通用组件集 | `frontend/src/components/common/index.ts` | SearchInput/Select/Input/TextArea/Toggle/StatusBadge/EmptyState/Skeleton/DateRangePicker/GroupSelector | 直接复用 |

### 4.2 状态 / API / 路由层（直接复用）

| 资产 | path | 用途 | 复用 |
|---|---|---|---|
| API Client | `frontend/src/api/client.ts:14` | Axios 实例 + baseURL(VITE_API_BASE_URL) + token 拦截器 + 刷新 token 队列 + 时区头 | 直接复用 |
| Pinia auth store | `frontend/src/stores/auth.ts:71` | user/token/refreshToken + JWT 自动刷新 + localStorage 持久化 | 直接复用 |
| Pinia app store | `frontend/src/stores/app.ts` | sidebarCollapsed/loading/toasts/withLoading | 直接复用 |
| composables | `frontend/src/composables/` | useAutoRefresh/useTableLoader/useTableSelection/useForm/useClipboard/useRoutePrefetch | 直接复用 |
| 路由守卫 | `frontend/src/router/index.ts:20` | requiresAuth/requiresAdmin/requiresPayment/featureFlag 多级 meta | 直接复用 |

### 4.3 业务页（需二开 / 不适用）

| 页面 | path | 行数 | 复用 | 二开工期 |
|---|---|---|---|---|
| admin/DashboardView | `frontend/src/views/admin/DashboardView.vue:1` | 701 | 需二开 | 2 人天（换 KPI 为 XCDOS goal/task 完成率） |
| admin/UsersView | `frontend/src/views/admin/UsersView.vue:1` | 1800 | 需二开 | 3 人天（Prolog 租户字段映射） |
| admin/AccountsView | `frontend/src/views/admin/AccountsView.vue:1` | 1722 | **不适用** | 删除（XCDOS / Prolog 无对应概念） |
| admin/ChannelsView | `frontend/src/views/admin/ChannelsView.vue:1` | 1632 | **不适用** | 删除 |
| admin/GroupsView | `frontend/src/views/admin/GroupsView.vue:1` | **4351（上帝组件）** | 需二开 | 5 人天（必须先拆分） |
| admin/SettingsView | `frontend/src/views/admin/SettingsView.vue:1` | **9783（巨型上帝组件）** | 需二开 | 8 人天（按 tab 拆为子页） |
| admin/RiskControlView | `frontend/src/views/admin/RiskControlView.vue:1` | 2337 | 需二开 | 3 人天（可平移为决策评分 / Prolog 规则编辑器底座） |
| admin/SubscriptionsView | `frontend/src/views/admin/SubscriptionsView.vue:1` | 1421 | 需二开 | 3 人天（保留计费骨架） |
| admin/UsageView | `frontend/src/views/admin/UsageView.vue:1` | 696 | 需二开 | 2 人天 |
| admin/ProxiesView | `frontend/src/views/admin/ProxiesView.vue:1` | 2067 | **不适用** | 删除 |
| admin/AnnouncementsView | `frontend/src/views/admin/AnnouncementsView.vue:1` | 606 | 直接复用 | NA |
| admin/PromoCodesView / RedeemView / BackupView | `frontend/src/views/admin/` | - | 直接复用 | NA |
| user/DashboardView | `frontend/src/views/user/DashboardView.vue:1` | 40 | 需二开 | 2 人天（换成 XCDOS 我的目标 / Prolog 我的会话） |
| user/KeysView | `frontend/src/views/user/KeysView.vue:1` | 1790 | 需二开 | 3 人天（保留 Key CRUD 骨架） |
| user/UsageView | `frontend/src/views/user/UsageView.vue:1` | 1120 | 需二开 | 2 人天 |
| user/SubscriptionsView / PaymentView / OrdersView | `frontend/src/views/user/` | - | 直接复用 | NA（计费内测期保留） |
| auth/LoginView / RegisterView / OAuthCallbackView | `frontend/src/views/auth/` | - | 直接复用 | NA（微信订阅号 OAuth 现成） |

### 4.4 前端二开障碍（3 点，必须先解决）

1. **主色 token 异构**：sub2api tailwind.config.js 用 teal 青色系（primary-500: `#14b8a6`），XCDOS 深蓝三色规范用 navy/cyan/bluegray（navy-900: `#071A33` / cyan-500: `#1BA6D9`）。需重写 `tailwind.config.js` 的 theme.colors + `style.css` 的 `:root` CSS 变量，约 1 人天。
2. **三个上帝组件不可维护**：SettingsView（9783）/ GroupsView（4351）/ RiskControlView（2337），二开前必须按 tab/section 拆成独立子组件，否则任何改动高风险，拆分约 8 人天。
3. **业务实体页全是 API 渠道域**（accounts/channels/groups/proxies），XCDOS / Prolog 无对应概念，需删除或重写为域实体页（goal/task/rule/session），约 25 人天。

### 4.5 XCDOS / Prolog 业务页新增（需二开，约 25 人天）

| 新增页 | 域 | 工期 |
|---|---|---|
| XCDOS goal/problem/decision_case/task/feedback 管理页 + 看板 | 5 大聚合 | 15 人天（套 TablePageLayout+DataTable 骨架） |
| Prolog rule_prolog/session/synonym 管理页 | 3 大域 | 10 人天（规则编辑器需 Monaco/CodeMirror 代码高亮） |

### 4.6 前端复用结论

内测期建议：**sub2api 独立部署做换肤 + 菜单扩展，不重写框架、不 fork 源码**。

- 路由层：`router/index.ts` 追加 `/xcgos/*`、`/prolog/*` 业务路由，复用 requiresAuth/requiresAdmin meta + 懒加载；
- 菜单层：`AppSidebar.vue:717` adminNavItems computed 追加业务菜单组（children 折叠 + featureFlag 控制）；
- API 层：`api/admin/` 新增 `xcgos/*.ts`、`prolog/*.ts`，复用 `client.ts:14` 的 apiClient（baseURL 指向 XCDOS NestJS BFF 或 Prolog Spring Boot 网关）。

---

## 5. API 契约 + 鉴权（JWT / TOTP / OpenAI 兼容端点）

Gin 单进程多路由组。**鉴权层（JWT/TOTP/AdminAuth/APIKeyAuth/限流/CORS/SecurityHeaders）100% 直接复用**，是 sub2api 最成熟、测试覆盖最厚的部分。

### 5.1 路由总装

| 路由组 | path | 鉴权 | 复用 |
|---|---|---|---|
| 路由总装 | `backend/internal/server/router.go:90`（registerRoutes） | RequestLogger/Logger/CORS/SecurityHeaders | 直接复用 |
| Auth 路由 | `backend/internal/server/routes/auth.go:27`（`/api/v1/auth/*`） | Redis 限流（fail-close） | 需二开（3 人天） |
| User 路由 | `backend/internal/server/routes/user.go:21`（`/api/v1/user/*`） | JWTAuth + TOTP 子组 | 需二开（5 人天） |
| Admin 路由 | `backend/internal/server/routes/admin.go:19`（`/api/v1/admin/*`） | AdminAuth + AdminComplianceGuard | 直接复用 |
| 网关路由 | `backend/internal/server/routes/gateway.go:35`（`/v1/*`） | APIKeyAuth | 直接复用 |
| 支付路由 | `backend/internal/server/routes/payment.go:14`（`/payment/*`） | JWT + webhook 签名校验 | 需二开（3 人天） |

### 5.2 鉴权三件套

| 中间件 | path | 用途 | 复用 |
|---|---|---|---|
| JWT 中间件 | `backend/internal/server/middleware/jwt_auth.go:27` | Bearer → ValidateToken → 校验 IsActive + TokenVersion（改密撤销） → 注入 AuthSubject | 直接复用 |
| APIKey 中间件 | `backend/internal/server/middleware/api_key_auth.go:28` | 三头提取（Bearer/x-api-key/x-goog-api-key）+ singleflight+Redis 缓存 + IP/订阅/余额校验 | 直接复用 |
| Admin 中间件 | `backend/internal/server/middleware/admin_auth.go:27` | 双通道：x-api-key（Admin API Key）或 Bearer JWT（IsAdmin） | 直接复用 |
| CORS | `backend/internal/server/middleware/cors.go:16` | 白名单 Origin + Allow-Credentials + 放行 x-stainless-* SDK 头 | 直接复用 |
| 限流 | `backend/internal/middleware/rate_limiter.go:62` | Redis Lua 滑动窗口 + FailOpen/FailClose（auth 全 fail-close） | 直接复用 |

### 5.3 JWT / TOTP 实现

| 服务 | path | 用途 | 复用 |
|---|---|---|---|
| JWT 签发 | `backend/internal/service/auth_service.go:1148` | HS256 + UserID/Email/Role/TokenVersion + exp；RefreshTokenPair 家族轮换防重放；改密 TokenVersion++ 全局失效 | 直接复用 |
| 2FA 流程 | `backend/internal/handler/auth_handler.go:245` | 密码通过 → tempToken → `/auth/login/2fa` 验证 6 位码 → 发 token 对 | 需二开（2 人天） |
| TOTP | `backend/internal/handler/totp_handler.go` | setup / enable / disable / status / verification-method / send-code | 直接复用 |
| APIKey 生成 | `backend/internal/service/api_key_service.go:252` | 32 字节随机 + 前缀（默认 `sk-`）+ SHA256 缓存键 + singleflight | 直接复用 |

### 5.4 OpenAI 兼容端点（100% 直接复用）

| 端点 | path | 用途 |
|---|---|---|
| Claude 网关 handler | `backend/internal/handler/gateway_handler.go:117` | `/v1/messages`、`/v1/messages/count_tokens`、`/v1/models`、`/v1/usage`、`/v1/responses`、Antigravity |
| OpenAI 网关 handler | `backend/internal/handler/openai_gateway_handler.go:606` | `/v1/messages`（Anthropic 协议桥接 OpenAI Responses）、`/v1/responses`、`/v1/responses`（WSS）、`/v1/chat/completions`、`/v1/embeddings`、`/v1/images/*` |

端点全集：`/v1/messages`、`/v1/messages/count_tokens`、`/v1/chat/completions`、`/v1/responses`、`/v1/embeddings`、`/v1/images/generations`、`/v1/images/edits`、`/v1/models`、`/v1/usage`，外加 Gemini `/v1beta/models/*` 和 Antigravity `/antigravity/v1/*`，按 `group.Platform` 自动路由到 Claude 原生或 OpenAI Responses 上游。

### 5.5 API 契约复用结论

- **整体复用率 ~85%**，二开集中在路由裁剪 + XCDOS 域实体（goal/problem/decision_case/task/feedback/agent_run）新增 handler。
- **路由裁剪**：`auth.go` 6 家 OAuth 裁到 wechat 单家（ADR-0008 订阅号场景），删 github/google/linuxdo/oidc/dingtalk 共约 25 个端点，0.5 人天。
- **XCDOS 域接口新增**：在 `/api/v1` 下新增 `/goals` `/problems` `/decision-cases` `/tasks` `/feedbacks` `/agent-runs` 6 组 REST，套 jwtAuth + BackendModeUserGuard，3 人天。
- **JWT Secret 跨服务共享**：sub2api HS256 单密钥（ENV `JWT_SECRET` ≥32 字节，`config.go:1979` 校验）。XCDOS OpenAPI 声明 `bearerAuth(JWT)`，**内测期共用 HS256 单密钥**即可被 NestJS（passport-jwt）校验；商用期改 RS256 + JWKS。
- **APIKey vs JWT 边界**：sub2api APIKey 是网关调用凭证（用户级 + 分组 + 订阅 + IP ACL），XCDOS 内部业务 API 走 JWT 不走 APIKey；两套凭证体系并存，文档须明确边界。

---

## 6. 部署 + 配置 + 安全（docker / config 全字段 / url_allowlist）

**整体复用度 ≥90%**，部署链路覆盖 XCDOS / Prolog 内测期全部场景，无需重造。安全控制可直接关闭 P1-13（日志脱敏）/ P1-14（Header 防篡改）实现层。

### 6.1 四条部署通道

| 通道 | path | 用途 | 复用 |
|---|---|---|---|
| install.sh（裸机） | `deploy/install.sh:1-120` | Bash4 + goreleaser 二进制 + checksum + systemd 单元 | 直接复用 |
| Dockerfile（三阶段） | `Dockerfile:1-137` | pnpm9 build → Go1.26 embed → alpine3.21 非 root(uid1000) | 直接复用 |
| docker-compose（全栈三件套） | `deploy/docker-compose.yml:14-275` | sub2api + postgres:18-alpine + redis:8-alpine，内部 bridge 网络 | 直接复用 |
| docker-compose.standalone（外接） | `deploy/docker-compose.standalone.yml:1-60` | 仅 app，DATABASE_HOST/REDIS_HOST 强制必填 | 需二开（1 人天） |
| docker-entrypoint.sh | `deploy/docker-entrypoint.sh:1-23` | root chown /app/data → su-exec 切 sub2api 用户 | 直接复用 |
| Caddyfile（反代 + TLS） | `deploy/Caddyfile:1-113` | TLS1.2/1.3 + reverse_proxy + X-Real-IP/XFF/CF-Connecting-IP + 100MB body | 需二开（0.5 人天） |

### 6.2 配置（31 个 section）

| 文件 | path | 用途 | 复用 |
|---|---|---|---|
| 配置全量样本 | `deploy/config.example.yaml:1-1108` | server/log/cors/security/gateway/database/redis/ops/jwt/totp/turnstile/gemini/update/pricing/billing/sora/oauth 等 31 section | 需二开（1 人天，裁剪） |
| Config 结构体 | `backend/internal/config/config.go:61-96` | 顶层 Config struct 聚合 31 子配置，mapstructure 双向绑定 | 直接复用 |

**内测必填三件**（`compose.yml:86-101` 注释明确警告）：`POSTGRES_PASSWORD` / `JWT_SECRET` / `TOTP_ENCRYPTION_KEY`，留空则每次重启随机生成 → 会话 / 2FA 全部失效。

### 6.3 安全控制（直接复用，关闭 P1-13 / P1-14）

| 控件 | path | 用途 |
|---|---|---|
| SecurityHeaders 中间件 | `backend/internal/server/middleware/security_headers.go:75-116` | 每请求生成 16 字节 CSP nonce；X-Content-Type-Options=nosniff / X-Frame-Options=DENY / Referrer-Policy=strict-origin-when-cross-origin；API 路由跳过 CSP |
| URL Allowlist + SSRF 校验 | `backend/internal/util/urlvalidator/validator.go:28-126` | scheme + 私网/loopback 字面量阻断 + allowlist 通配；ValidateResolvedIP 防 DNS-rebinding |
| 凭证脱敏 - dto 层 | `backend/internal/handler/dto/credentials_redact.go:11-29` | RedactCredentials 复制 map 剥离 SensitiveCredentialKeys，产 has_<key> 状态位 |
| 凭证脱敏 - 敏感键清单 | `backend/internal/service/account_credentials_redact.go:5-13` | 13 类敏感子键硬编码：access_token/refresh_token/id_token/api_key/session_key/cookie/aws_secret/service_account_json/private_key 等 |
| ops_error 入库脱敏 | `backend/internal/service/ops_service.go:226-261` | sanitizeErrorBodyForStorage 截断 + 脱敏 + upstream_errors 最多 32 条 |
| API Key 尾部掩码 | `backend/internal/service/content_moderation.go:2681-2690`（maskSecretTail） | ≤4 字符全 ****，否则 ********+后 4 位 |
| Gemini 日志体净化 | `backend/internal/pkg/geminicli/sanitize.go:7-46`（SanitizeBodyForLogs） | base64>50 字符截断 + 整体 2048 截断 |
| trusted_proxies（XFF） | `backend/internal/server/http.go:48-58` | Gin SetTrustedProxies 显式 CIDR/IP 列表 |
| Turnstile（人机校验） | `backend/internal/config/config.go:1246` | required=true 时 release 强制校验登录/注册 |
| OAuth 回调重定向净化 | `backend/internal/handler/auth_linuxdo_oauth.go:954`（sanitizeFrontendRedirectPath） | 防开放重定向 |

### 6.4 内测一键部署建议

1. 走 `docker-compose.yml`（全栈三件套）或 `docker-compose.standalone.yml`（外接 XCDOS 既有 PG/Redis）；
2. Caddyfile 反代按路径分流：`/v1/*` → sub2api，业务 → NestJS BFF，`X-Real-IP`/`CF-Connecting-IP` 头透传两侧；
3. 固化 `POSTGRES_PASSWORD` / `JWT_SECRET` / `TOTP_ENCRYPTION_KEY`；
4. `trusted_proxies` 写入 Caddy + Cloudflare 两层代理 CIDR，否则 client IP 取错导致 rate_limit/ACL 失效（`http.go:57` 有 Warning 但不阻断）；
5. `SECURITY_URL_ALLOWLIST_ENABLED` 显式开 true 并配 upstream_hosts（默认 false，`config.go:1577`）；
6. Turnstile required 内测面向内部用户可关，公测前必须开（`config.go:1614`）。

### 6.5 二开缺口

- **配置裁剪**：config.yaml 31 section 需按 XCDOS 域裁掉无关项（pricing/billing/sora 等 AI 网关特有），保留 server/security/database/redis/log/jwt/totp/gateway，1 人天。
- **CSP frame-ancestors 'none'**（`security_headers.go:32`）阻止所有 iframe 嵌入；若 XCDOS 看板需嵌入 sub2api 页面需改 CSP，但会弱化 clickjacking 防护。
- **安全控制正交**：sub2api 安全是网关层，XCDOS 业务安全（task/decision_case RBAC）不能替代；二者叠加，XCDOS NestJS 侧应复用相同 Header 策略保持一致。

---

## 7. 复用矩阵

> 工期单位：人天（PD）。汇总自 5 维度调研。

| 模块 | 复用判定 | 对应 XCDOS / Prolog | 工期（人天） |
|---|---|---|---|
| 账号池调度 - 负载感知主入口（`gateway_service.go:1534`） | 需二开 | XCDOS agent_run 上游选号 | 5 |
| 账号池调度 - Legacy 排序（`gateway_service.go:2188`） | 直接复用 | - | 0 |
| OpenAI 加权随机调度（`openai_account_scheduler.go:889`） | 直接复用 | - | 0 |
| 粘性会话 hash 三层源（`gateway_service.go:725`） | 直接复用 | Prolog session 续接 | 0 |
| 粘性会话绑定 / 查询（`gateway_service.go:788`） | 直接复用 | - | 0 |
| 摘要链会话存储（`digest_session_store.go:27`） | 直接复用 | - | 0 |
| 并发槽服务（`concurrency_service.go:165`） | 直接复用 | - | 0 |
| 会话数限制（`gateway_service.go:2800`） | 直接复用 | - | 0 |
| 熔断主入口（`ratelimit_service.go:164`） | 直接复用 | - | 0 |
| 429 限流冷却（`ratelimit_service.go:873`） | 直接复用 | - | 0 |
| 计费成本计算（`billing_service.go:466`） | 直接复用 | - | 0 |
| **计费落库主流程**（`gateway_service.go:8894`） | **需二开** | XCDOS agent_runs.cost_cents | **5** |
| 计费缓存 + 熔断器（`billing_cache_service.go:917`） | 直接复用 | - | 0 |
| **转发主入口**（`gateway_service.go:4485`） | **需二开** | 裁剪 Claude Code mimicry | **8** |
| 上游 HTTP 接口（`http_upstream_port.go:9`） | 直接复用 | - | 0 |
| **平台分发 handler**（`gateway_handler.go:793`） | **需二开** | 对接目标系统路由层 | **5** |
| Claude token provider（`claude_token_provider.go:21`） | 直接复用 | - | 0 |
| 调度快照服务（`scheduler_snapshot_service.go:31`） | 直接复用 | - | 0 |
| 数据模型 - User/Account/APIKey/Group/UsageLog/UserSubscription/PaymentOrder | 直接复用 | schema 不动 | 0 |
| 数据模型 - PendingAuthSession | 需二开 | - | 2 |
| 数据模型 - channels 簇 | 需二开 | 二次计费层（内测不启用） | 3 |
| 数据模型 - 多租户字段 | 不适用（内测独立部署隔离） | - | 0 |
| 数据模型 - XCDOS 域表 / Prolog 域表 | 不适用（自建） | XCDOS / Prolog 侧自建 | 0 |
| 鉴权 - JWT/TOTP/APIKey/AdminAuth/CORS/限流/SecurityHeaders | 直接复用 | 关闭 P1-13/P1-14 | 0 |
| 鉴权 - auth 路由裁剪（6 家 OAuth → wechat） | 需二开 | 订阅号 | 3 |
| 鉴权 - 2FA 流程 | 需二开 | - | 2 |
| 鉴权 - JWT Secret 共享（HS256 单密钥） | 需二开 | XCDOS NestJS passport-jwt | 0.5 |
| OpenAI 兼容端点（`/v1/*`） | 直接复用 | - | 0 |
| XCDOS 域接口新增（/goals /tasks /agent-runs 等） | 需二开 | XCDOS | 3 |
| 支付路由 / webhook | 需二开 | - | 3 |
| 前端骨架（Layout/Sidebar/通用组件/API Client/Pinia/路由守卫） | 直接复用 | - | 0 |
| 前端主色 token 换肤（teal → navy/cyan） | 需二开 | XCDOS 深蓝三色规范 | 1 |
| 前端上帝组件拆分（SettingsView/GroupsView/RiskControl） | 需二开 | - | 8 |
| 前端业务实体页重写（AccountsView/ChannelsView/ProxiesView） | 不适用 | 删除 | 0 |
| XCDOS 五大聚合域管理页 | 需二开 | XCDOS | 15 |
| Prolog 三大域管理页（含 Monaco 规则编辑器） | 需二开 | Prolog | 10 |
| 前端 user KeysView/UsageView/DashboardView | 需二开 | - | 7 |
| 前端 auth/user 订阅支付链路 | 直接复用 | - | 0 |
| 部署 - Dockerfile / install.sh / entrypoint | 直接复用 | - | 0 |
| 部署 - docker-compose 全栈 / standalone | 直接复用 / 需二开 | standalone 外接 PG | 1 |
| 部署 - Caddyfile | 需二开 | 域名替换 + 反代头 | 0.5 |
| 配置 - config.yaml 裁剪（31 section） | 需二开 | - | 1 |
| 安全 - SecurityHeaders / URL Allowlist / SSRF / 凭证脱敏 / trusted_proxies / Turnstile | 直接复用 | 关闭 P1-13/P1-14 | 0 |

**复用率汇总**：后端网关 70%（核心基础设施直接复用，二开 3 处）/ 数据库 85% / 前端骨架 60% / 鉴权 85% / 部署安全 90%。

**二开总工期估算**（净开发量，不含联调测试）：约 **96 人天**（≈ 5 人月），其中 XCDOS / Prolog 业务页占 32 人天（最大头），网关计费/转发/handler 占 18 人天，前端拆分 + 换肤占 9 人天。

---

## 8. MVP 内测二开路线图（接 sub2api 的具体步骤，按周排）

> 前提：sub2api 独立部署（ADR-0008），接订阅号，**不 fork 源码**；XCDOS（NestJS）/ Prolog（Spring Boot）通过 HTTP 调用 sub2api OpenAI 兼容端点。

### Week 0：环境与契约冻结（3 人天）

- [ ] `docker-compose.yml` 全栈起 sub2api（PG18 + Redis8 + app），固化三件密钥；
- [ ] 后台 admin 配置 1 个 Group（platform=anthropic，subscription_type=subscription）+ 1 个 Account（订阅号凭证）+ 1 个 APIKey（sk-xxx）；
- [ ] curl 验证 `/v1/messages` 通路 + 粘性会话 TTL；
- [ ] 冻结对账字段：`usage_logs.request_id` ↔ `agent_runs.gateway_request_id`、`accounts.id` ↔ `agent_runs.llm_account_id`、`usage_logs.total_cost` ↔ `agent_runs.cost_cents`（NUMERIC(20,10) USD → NUMERIC(10,4) 分，换算 ×100）。

### Week 1：鉴权与网关接入（10 人天）

- [ ] 裁 `auth.go` 6 家 OAuth → wechat 单家（`routes/auth.go:27`，0.5 人天）；
- [ ] JWT Secret 共享：sub2api `JWT_SECRET` 同步写入 XCDOS NestJS 配置，XCDOS 用 passport-jwt HS256 校验（`auth_service.go:1148`，0.5 人天）；
- [ ] 2FA 流程对接（`auth_handler.go:245`，2 人天）；
- [ ] XCDOS `/api/v1/auth/login` + `/auth/login/2fa` + `/me` 契约对齐 sub2api 实现（3 人天）；
- [ ] XCDOS agent_run 调用层封装：用 `sk-xxx` Key 调 `/v1/messages`，response 回写 `agent_runs.gateway_request_id` + token + cost（4 人天）。

### Week 2：计费对账 + XCDOS 域接口（13 人天）

- [ ] 计费落库 wrapper：sub2api 侧不改源码，XCDOS 侧建定时任务拉 `usage_logs`（按 `request_id` 匹配 `agent_runs`），写 `cost_cents` + token（替代 `recordUsageCore` 二开，**避开 10177 行的 gateway_service.go**，6 人天）；
- [ ] XCDOS `/goals` `/problems` `/decision-cases` `/tasks` `/feedbacks` `/agent-runs` 6 组 REST 新增，套 jwtAuth（3 人天）；
- [ ] 网关错误回流：sub2api 429/401 → XCDOS agent_run 状态机标 `failed_upstream`（HandleUpstreamError 包装为健康检查，4 人天）。

### Week 3：前端换肤 + 菜单扩展（11 人天）

- [ ] tailwind.config.js + style.css 主色 token 换肤（teal → navy/cyan，1 人天）；
- [ ] `AppSidebar.vue:717` 追加 XCDOS 菜单组（0.5 人天）；
- [ ] `router/index.ts` 追加 `/xcgos/*` 路由 + 懒加载（0.5 人天）；
- [ ] XCDOS 5 大聚合域管理页（套 TablePageLayout + DataTable，9 人天，分 2 人并行）。

### Week 4：上帝组件拆分 + 计费看板（13 人天）

- [ ] SettingsView（9783）按 tab 拆分为独立子页（4 人天）；
- [ ] GroupsView（4351）拆分（3 人天）；
- [ ] RiskControlView（2337）拆分 + 平移为决策评分规则底座（3 人天）；
- [ ] admin/UsageView 换成 XCDOS task 执行统计（3 人天）。

### Week 5：Prolog 接入 + 灰度（10 人天）

- [ ] Prolog Spring Boot 调 sub2api：`session_id` 作为 sessionHash 入参，调 `/v1/chat/completions`（3 人天）；
- [ ] Prolog 三大域管理页（rule_prolog/session/synonym，含 Monaco 规则编辑器，10 人天 → 分 2 人并行 5 人天）；
- [ ] tenant_id 映射 group_id，复用 Group.ClaudeCodeOnly/FallbackGroupID 实现租户隔离（2 人天）。

### Week 6：安全加固 + 内测发布（8 人天）

- [ ] `SECURITY_URL_ALLOWLIST_ENABLED=true` + 配 upstream_hosts（0.5 人天）；
- [ ] trusted_proxies 写入 Caddy + Cloudflare 两层 CIDR（0.5 人天）；
- [ ] Turnstile 公测前必开（0.5 人天）；
- [ ] XCDOS NestJS 侧复用相同 SecurityHeaders 策略（X-Frame-Options/CSP nonce/nosniff/Referrer-Policy，1 人天）；
- [ ] 计费对账对齐演练 + 端到端联调（5 人天）。

**总工期**：约 6 周（68 人天净开发，5-6 周含联调测试），与 ADR-0008「工期从 4-8 周降至 1-2 周」的乐观估计相比，实际因 XCDOS/Prolog 业务页工作量上浮至 6 周，但网关基础设施层确在 1-2 周内即可起跑。

---

## 9. 风险与边界（LGPL / ToS / 切换条件，引用 ADR-0008）

### 9.1 License 风险（LGPLv3）

- **结论**：sub2api 独立部署 + 网络调用 = 聚合关系，**非派生作品，不传染**业务代码（ADR-0008 Negative 节，block-z1a 核验）。
- **红线**：**禁止 fork 修改 sub2api 源码**。任何对 sub2api 本体的修改须 LGPL 开源。内测如需定制，优先通过：
  1. **配置层**（config.yaml 31 section + ENV）；
  2. **外部 wrapper**（XCDOS NestJS 作为 sub2api 的前置 BFF，做请求/响应改写）；
  3. **定时拉取对账**（避开 `gateway_service.go:8894` recordUsageCore 二开，改为 XCDOS 侧拉 usage_logs 落 agent_runs）。
- **本文档的关键决策**：计费落库**不二开 sub2api 源码**，改为 Week 2 的 XCDOS 侧拉取 wrapper，规避 LGPL 传染。

### 9.2 ToS 风险（内测期订阅号转 API）

- **结论**：违反上游 ToS，**仅限内部 MVP 验证，不对外提供服务、不收费**（ADR-0008 内测期风险接受声明）。
- **隔离措施**：
  1. 不将订阅号转 API 能力暴露给最终用户或客户；
  2. sub2api 独立容器 + 独立 PG schema，与客户数据物理隔离；
  3. 账号封禁风险自担，不影响客户业务。

### 9.3 切换条件（内测 → 商用强制切换）

按 ADR-0008「账号策略阶段化」表 + 合规文档「退出内测、进入商用的强制切换条件」：

| 触发条件 | 动作 |
|---|---|
| 进入商用 / 外发 | 上游凭证从订阅号切换为官方 API Key（Anthropic/OpenAI/Gemini） |
| sub2api 账号被封禁 | 立即切换备用订阅号 or 提前切官方 API |
| 客户数据接入 | sub2api 物理隔离失效，必须切官方 API + 多租户 schema 改造（加 tenant_id） |
| LGPL 边界突破（任何源码修改需求） | 评估 fork 开源成本 vs 自建网关（重新触发 ADR-0008 备选 one-api） |

### 9.4 其他边界

- **多租户缺失**：sub2api 单租户 SaaS，无 org_id/tenant_id。内测期靠独立部署隔离；多租户场景必须加 tenant_id 列 + 改 Ent interceptor（影响面大，建议商用期再做）。
- **跨系统主键**：sub2api BIGSERIAL vs XCDOS UUID vs Prolog BIGINT，跨系统关联需维护映射表（`agent_runs.llm_account_id` 存 BIGINT 转字符串已够用）。
- **计费精度**：sub2api 配额 decimal(20,8) / 成本 decimal(20,10) USD，XCDOS `cost_cents` NUMERIC(10,4) 单位分，换算口径需固化（×100，4 位小数足够）。
- **god component 风险**：gateway_service.go（10177 行）/ SettingsView.vue（9783 行）/ GroupsView.vue（4351 行），任何 diff 高风险，Week 4 必须先拆分再改。
- **CSP iframe 阻断**：frame-ancestors 'none' 阻止 XCDOS 看板嵌入 sub2api 页面，需改 CSP 但弱化 clickjacking 防护，建议改用独立 tab 打开而非 iframe 嵌入。

---

## 附录 A：关键文件路径速查（sub2api 源码）

- 网关核心：`backend/internal/service/gateway_service.go`（10177 行）
- 计费：`backend/internal/service/billing_service.go` / `billing_cache_service.go`
- 熔断：`backend/internal/service/ratelimit_service.go`
- 调度：`backend/internal/service/openai_account_scheduler.go` / `scheduler_snapshot_service.go` / `concurrency_service.go`
- 粘性会话：`backend/internal/service/digest_session_store.go` / `openai_messages_digest_session.go`
- 数据模型：`backend/ent/schema/*.go`（37 文件）+ `backend/migrations/`（150+ SQL）
- 鉴权：`backend/internal/server/middleware/{jwt_auth,api_key_auth,admin_auth,cors}.go` + `backend/internal/service/auth_service.go`
- 网关路由：`backend/internal/server/routes/gateway.go` + `backend/internal/handler/{gateway,openai_gateway}_handler.go`
- 部署：`Dockerfile` / `deploy/{docker-compose.yml,docker-compose.standalone.yml,install.sh,Caddyfile,config.example.yaml}`
- 安全：`backend/internal/server/middleware/security_headers.go` + `backend/internal/util/urlvalidator/validator.go` + `backend/internal/handler/dto/credentials_redact.go`

## 附录 B：XCDOS / Prolog 侧改造点速查

- XCDOS：`docs/ddl/xcdos_schema.sql:236-256`（agent_runs 表，已预留 `llm_account_id` / `gateway_request_id` / `cost_cents`）；
- XCDOS：NestJS passport-jwt 复用 sub2api `JWT_SECRET`（HS256 单密钥，内测期）；
- XCDOS：`docs/ADR/ADR-0008-llm-gateway-sub2api.md`（决策基线）；
- XCDOS：`docs/ADR/ADR-0002-xcdos-orm-prisma.md`（Prisma ORM，sub2api 是 Ent，不共享 ORM）；
- Prolog：`docs/ADR/ADR-0001-prolog-primary-db.md`（Hibernate + Flyway，sub2api 是 Ent，不共享 ORM）；
- Prolog：tenant_id → group_id 映射，复用 Group.ClaudeCodeOnly/FallbackGroupID 实现租户隔离与降级。

---

**报告结论**：sub2api 作为 LLM 网关基础设施层，**内测期直接独立部署 + HTTP 调用、不 fork 源码**的方案成立（ADR-0008）。核心网关机制（账号池/粘性会话/熔断/限流/计费缓存）可直接复用，鉴权层 100% 复用，安全控制直接关闭 P1-13/P1-14。二开工作量集中在 XCDOS/Prolog 业务页（32 人天）与网关计费落库 wrapper（采用拉取对账规避源码修改），总工期约 6 周。**红线**：禁止 fork sub2api 源码（LGPLv3 传染）；**切换条件**：商用前必须切官方 API Key（ToS 合规）。
