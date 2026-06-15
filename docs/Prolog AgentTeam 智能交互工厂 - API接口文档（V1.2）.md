# Prolog AgentTeam 智能交互工厂 - API 接口文档（V1.2）

## 一、API 约定

| 项 | 规范 |
|------|------|
| Base URL | `/api/v1` |
| Content-Type | `application/json; charset=utf-8` |
| 认证方式 | Bearer Token (JWT) |
| 多租户 | Header: `X-Tenant-Id`（所有请求必传） |
| 追踪 ID | Header: `X-Trace-Id`（UUID，网关自动生成） |
| Session ID | Header: `X-Session-Id`（会话类接口必传） |
| 限流 | 默认 100 req/min per tenant；规则调度接口 300 req/min |
| 超时 | 默认 30s；规则执行接口 60s |
| 时间格式 | ISO 8601 (`2026-06-11T14:30:00+08:00`) |
| 分页 | Query: `?page=1&pageSize=20`；Response: `{ items, total, page, pageSize }` |

### 统一响应信封

```json
// 成功
{
  "success": true,
  "data": { ... },
  "error": null,
  "traceId": "req_xxx",
  "timestamp": "2026-06-11T14:30:00+08:00"
}

// 错误
{
  "success": false,
  "data": null,
  "error": { "code": "RULE_NOT_FOUND", "message": "规则不存在或已停用" },
  "traceId": "req_xxx",
  "timestamp": "2026-06-11T14:30:00+08:00"
}
```

---

## 二、认证接口

### POST /api/v1/auth/login
用户登录，返回 JWT Token。限流：10 req/min/IP。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| username | Body | string | ✓ | 用户名 |
| password | Body | string | ✓ | 密码 |
| tenant_code | Body | string | ✓ | 租户编码 |

**Response 200:**
```json
{ "success": true, "data": { "token": "...", "user": { "id", "username", "nickname", "role_level", "tenant_id" } } }
```

### GET /api/v1/auth/me
获取当前用户信息与权限。

### POST /api/v1/auth/refresh
刷新 Token（Token 过期前 5 分钟内可刷新）。

---

## 二.B 统一枚举字典（P0-08：API/DB/测试唯一口径）

| 枚举 | 取值 | DB 存储 | 说明 |
|------|------|---------|------|
| isolate_type | `physical` / `schema` / `shared_rls` | 2 / 3 / 1 | Tier-A 物理独立库 / Tier-B schema-per-tenant（默认）/ Tier-C 共享+RLS（ADR-0004） |
| rule_type | `process` / `validation` / `routing` | 1 / 2 / 3 | 流程规则 / 校验规则 / 路由规则（业务维度；组合结构由 parent_rule_id 表达） |
| rule_status | `draft` / `active` / `gray` / `inactive` | 0 / 1 / 2 / 3 | 草稿 / 已生效 / 灰度中（F-005）/ 停用（F-007）；DB rule_prolog.status 同步增加 3-停用 |
| ID 类型 | string（雪花 ID 数字串） | bigint | 全系统主键统一雪花 ID；API 层以 string 传输防 JS 精度丢失；**不使用 UUID** |

---

## 三、租户管理（超级管理员）

### POST /api/v1/tenants
创建租户。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✓ | 租户名称 |
| code | string | ✓ | 租户编码（唯一） |
| isolate_type | enum | ✓ | `physical`（Tier-A 物理独立库）/ `schema`（Tier-B 默认）/ `shared_rls`（Tier-C 共享+RLS），见二.B 字典 |
| expire_time | datetime | | 过期时间，不填则永久 |

### GET /api/v1/tenants
租户列表。Query: `?status=active&page=&pageSize=`。权限：超级管理员。

### GET /api/v1/tenants/:id
租户详情。

### PATCH /api/v1/tenants/:id/status
更新租户状态。Body: `{ status: "active" | "inactive" | "expired" }`。

停用后该租户所有用户会话立即失效。

---

## 四、用户与权限管理

### POST /api/v1/users
创建用户。Body: `{ username, password, nickname, role_level, email, phone }`。
权限：租户管理员。

### GET /api/v1/users
用户列表。Query: `?role_level=&status=&page=&pageSize=`。

### PATCH /api/v1/users/:id
更新用户信息。

### PATCH /api/v1/users/:id/status
更新用户状态。Body: `{ status: "active" | "inactive" | "locked" }`。

### POST /api/v1/roles
创建角色。Body: `{ name, level, permission_set: {...} }`。

### GET /api/v1/roles
角色列表。

---

## 五、规则配置管理（核心）

### POST /api/v1/rules
新增 Prolog 规则。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rule_code | string | ✓ | 规则编码（唯一） |
| rule_name | string | ✓ | 规则名称 |
| rule_content | text | ✓ | Prolog 规则内容 |
| rule_type | enum | ✓ | `process` / `validation` / `routing`（见二.B 字典；组合规则用 parent_rule_id 表达层级） |
| priority | int | | 优先级，默认 0（越大越高） |
| parent_rule_id | string(雪花ID) | | 父规则（组合规则时使用）；全系统主键统一雪花 ID，API 以 string 传输（见二.B） |
| gray_rate | int | | 灰度比例 0-100，默认 100 |

**Response 201:** `{ id, rule_code, version: 1, status: "draft" }`

### GET /api/v1/rules
规则列表。Query: `?rule_type=&status=&keyword=&page=&pageSize=`。

### GET /api/v1/rules/:id
规则详情，含版本历史摘要。

### PUT /api/v1/rules/:id
编辑规则。Body 同创建。规则版本号自动 +1，旧版本存入 `rule_snapshot` 表。

### PATCH /api/v1/rules/:id/status
规则状态管控。Body: `{ status: "draft" | "active" | "gray" | "inactive" }`（四态见二.B 字典；gray 配合 gray_rate 灰度放量 F-005）。

inactive 规则不参与调度。

### PATCH /api/v1/rules/:id/gray-rate
灰度比例调整。Body: `{ gray_rate: 50 }`。

### GET /api/v1/rules/:id/versions
规则版本历史。Query: `?page=&pageSize=`。

### POST /api/v1/rules/:id/rollback
回滚至指定版本。Body: `{ version: 3 }`。

---

## 六、同义词管理

### POST /api/v1/synonyms
新增同义词映射。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| origin_word | string | ✓ | 标准词 |
| synonym_word | string | ✓ | 同义词 |
| priority | int | | 优先级，默认 0 |

### GET /api/v1/synonyms
同义词列表。Query: `?origin_word=&status=&page=&pageSize=`。

### PUT /api/v1/synonyms/:id
编辑同义词。

### DELETE /api/v1/synonyms/:id
删除同义词（软删除，status=inactive）。

---

## 七、会话管理

### POST /api/v1/sessions
创建会话。Body: `{ context_data: {...} }`（可选，初始上下文）。
**Response:** `{ session_id: "uuid", status: "active", expire_time }`。

### GET /api/v1/sessions/:sessionId
获取会话状态与当前上下文数据。

### POST /api/v1/sessions/:sessionId/interact
会话交互——核心调度接口。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_input | string | ✓ | 用户输入文本 |
| context_params | object | | 附加上下文参数 |

**Response:**
```json
{
  "session_id": "...",
  "intent": { "type": "rule_match", "rule_id": "...", "confidence": 0.92 },
  "matched_rules": [{ "rule_code", "rule_name", "confidence" }],
  "response": { "type": "text", "content": "..." },
  "context_state": { ... }
}
```

后端流程：意图识别 → 同义词匹配 → 规则调度 → 响应生成 → 上下文更新。

### PUT /api/v1/sessions/:sessionId/context
更新会话上下文。Body: `{ context_data: {...} }`。

### POST /api/v1/sessions/:sessionId/renew
续连会话，延长过期时间。

### DELETE /api/v1/sessions/:sessionId
主动结束会话。

---

## 八、日志审计

### GET /api/v1/logs/requests
请求日志列表。Query: `?session_id=&request_type=&request_status=&start_time=&end_time=&page=&pageSize=`。

### GET /api/v1/logs/requests/:id
单条请求日志详情（含请求内容、响应内容、规则匹配结果）。

### GET /api/v1/logs/operations
操作日志列表（租户/用户/规则/同义词的 CRUD 记录）。Query: `?actor_id=&resource_type=&action=&start_time=&end_time=`。

### GET /api/v1/logs/errors
异常日志列表。Query: `?severity=&start_time=&end_time=&page=&pageSize=`。

---

## 九、自进化任务

### GET /api/v1/evolution/tasks
自进化任务列表。Query: `?task_type=&status=&page=&pageSize=`。

任务类型：`rule_clustering`（规则聚类）/ `rule_generation`（自动生成）/ `snapshot_archive`（快照归档）/ `sample_collection`（样本采集）。

### POST /api/v1/evolution/tasks/trigger
手动触发自进化任务。Body: `{ task_type: "rule_clustering", params: {...} }`。

**Response:** `{ task_id, status: "pending" }`

### GET /api/v1/evolution/tasks/:id
自进化任务执行状态与结果。

### POST /api/v1/evolution/tasks/:id/approve
审核 AI 生成的候选规则。Body: `{ action: "approve" | "reject", comment: "..." }`。

---

## 十、错误码体系

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `AUTH_INVALID_CREDENTIALS` | 401 | 用户名或密码错误 |
| `AUTH_TOKEN_EXPIRED` | 401 | Token 过期 |
| `TENANT_NOT_FOUND` | 404 | 租户不存在 |
| `TENANT_INACTIVE` | 403 | 租户已停用 |
| `FORBIDDEN` | 403 | 权限不足 |
| `RULE_NOT_FOUND` | 404 | 规则不存在 |
| `RULE_SYNTAX_ERROR` | 422 | 规则语法错误 |
| `RULE_CIRCULAR_REF` | 422 | 规则循环引用 |
| `SESSION_EXPIRED` | 410 | 会话已过期 |
| `SYNONYM_CONFLICT` | 409 | 同义词冲突 |
| `VALIDATION_ERROR` | 422 | 参数校验失败 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
