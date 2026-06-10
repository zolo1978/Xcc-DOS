# XCDOS + Prolog AgentTeam 安全设计文档 V1.0

## 一、文档说明

| 属性 | 内容 |
|------|------|
| 文档名称 | XCDOS + Prolog AgentTeam 安全设计文档 |
| 版本 | V1.0 |
| 编写人 | 安全负责人 / 架构师 |
| 审核人 | 安全团队 |
| 最后更新 | 2026-06-11 |
| 前置依赖 | XCDOS TDD V1.0 (ch.10), ARD V2.0 (ch.8), Prolog 总体方案 V1.2 (ch.6) |

---

## 二、安全设计总则

### 2.1 设计原则

- **纵深防御**：接入层→网关层→应用层→数据层，每层独立安全控制
- **最小权限**：用户/Agent/服务账号仅授予完成工作所必需的最小权限
- **默认拒绝**：未明确授权的访问一律拒绝
- **审计全覆盖**：所有操作可追溯至具体用户/Agent/时间/IP
- **安全左移**：需求阶段即嵌入安全设计，不做事后补丁

### 2.2 威胁模型（STRIDE）

| 威胁类型 | 本系统关键风险 | 缓解措施 |
|---------|-------------|---------|
| Spoofing (仿冒) | 用户凭证泄露、租户身份伪造 | JWT + 租户 Header 双重校验 |
| Tampering (篡改) | API 请求/响应篡改 | HTTPS + 请求签名 + 防重放 |
| Repudiation (抵赖) | 管理员操作无迹可寻 | 审计日志全覆盖 |
| Information Disclosure | 跨租户数据泄露、日志泄露敏感字段 | 租户隔离 + 数据脱敏 |
| Denial of Service | API 被刷爆 | 限流 + 熔断 + 降级 |
| Elevation of Privilege | 员工越权访问老板数据 | RBAC + 数据范围过滤 |

---

## 三、认证与鉴权

### 3.1 认证体系

| 层级 | 方式 | 说明 |
|------|------|------|
| 用户认证 | JWT (RS256) | Access Token 24h, Refresh Token 7d |
| 服务间认证 | API Key / mTLS | 内部服务调用使用固定 API Key，生产推荐 mTLS |
| Agent 身份 | Agent API Key | 每个 Agent 类型独立 Key，L1-L5 权限 |
| 第三方接入 | OAuth 2.0 Client Credentials | 对外 API 使用 client_id + client_secret |

### 3.2 Token 安全

- Token 签名算法：RS256（非对称，公钥可分发至各服务验证）
- Token Payload：`{ sub, role, tenant_id, org_id, exp, iat, jti }`
- 防重放：jti (JWT ID) + Redis 黑名单（登出/过期 Token 加入）
- Token 传输：仅通过 HTTPS Header `Authorization: Bearer <token>`，禁止 URL 参数传递

### 3.3 RBAC 权限模型

| 角色 | 等级 | 权限范围 | 关键限制 |
|------|------|---------|---------|
| boss | 5 | 全组织驾驶舱 + 只读决策 | 不可增删改数据 |
| admin | 4 | 全系统管理 | 可管理用户/组织/Agent 配置 |
| manager | 3 | 本组织全量 CRUD | 不可跨组织操作 |
| employee | 2 | 自己的任务/反馈 | 不可查看他人数据 |
| agent | 1-3 | 按 L1-L5 等级 | 高风险写操作需人工确认 |

---

## 四、网络安全

### 4.1 传输安全

- 全站 HTTPS，最低 TLS 1.2，推荐 TLS 1.3
- HSTS (max-age=31536000; includeSubDomains)
- 数据库连接强制 TLS
- Redis 连接生产环境强制 TLS

### 4.2 API 安全

| 措施 | 实现 | 覆盖范围 |
|------|------|---------|
| 限流 | 令牌桶算法 | 全部接口 |
| 防重放 | Nonce + Timestamp (5min 窗口) | 写操作接口 |
| 请求体大小限制 | 10MB | 全部接口 |
| CORS | 白名单 Origin | 前端 API |
| CSRF | SameSite=Strict + CSRF Token | 状态变更接口 |

### 4.3 限流规则

| 接口分类 | 限制 | 维度 |
|---------|------|------|
| 登录 | 10 req/min | per IP |
| 普通查询 | 100 req/min | per user |
| 写操作 | 30 req/min | per user |
| Agent Run | 20 req/min | per tenant |
| 规则调度 (Prolog) | 300 req/min | per tenant |

---

## 五、数据安全

### 5.1 传输加密

全部 API 通信基于 HTTPS/TLS 1.3。

### 5.2 存储加密

| 数据 | 方式 | 说明 |
|------|------|------|
| 用户密码 | bcrypt (cost=12) | 加盐哈希 |
| 手机号 | AES-256-GCM | 应用层加密存储 |
| 反馈内容 | 访问控制 | 仅本人+直属上级可读 |
| 数据库文件 | TDE (生产) | PostgreSQL 透明数据加密 |

### 5.3 数据脱敏

| 字段 | 脱敏规则 | 适用场景 |
|------|---------|---------|
| email | `u***@domain.com` | 日志/非本人查看 |
| phone | `138****1234` | 日志/API 响应 |
| password_hash | `***` (永不输出) | 全场景 |
| feedback content | 仅上级可见 | API 响应 |

### 5.4 租户数据隔离

- **独立 Schema 模式**：物理隔离，每个租户独立 PostgreSQL Schema
- **共享 Schema 模式**：逻辑隔离，所有查询强制 `WHERE tenant_id = $current_tenant`
- 网关层拦截：`X-Tenant-Id` 缺失或无效 → 401
- 禁止跨租户查询：代码层禁止 JOIN 跨 tenant_id

---

## 六、注入与 XSS 防护

### 6.1 SQL 注入

- 100% 参数化查询（TypeORM / Prisma）
- 禁止拼接 SQL 字符串
- 代码评审强制检查

### 6.2 XSS 防护

- 前端输出统一转义（React 默认安全）
- 富文本内容（如有）使用 DOMPurify 清洗
- CSP Header: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`

### 6.3 命令注入

- 不执行系统命令（无 exec/spawn）
- 规则引擎（Prolog）运行在沙箱环境，禁止文件系统/网络访问

---

## 七、Agent 安全

### 7.1 Agent 权限分级

| 等级 | 允许操作 | 需人工确认 |
|------|---------|-----------|
| L1 | 读取数据、分析推理 | 否 |
| L2 | 生成评分、建议 | 否 |
| L3 | 创建任务/方案 | 是（可配置关闭） |
| L4 | 修改数据、关闭异常 | 是（强制） |
| L5 | 删除数据、系统配置 | 禁止 Agent 执行 |

### 7.2 Agent 输出审计

- 每次 Agent Run 全量记录：input_summary, output_summary, tool_calls
- Agent 输出在人工确认前不生效（L3+）
- Agent Run 日志保留 180 天

---

## 八、审计与监控

### 8.1 审计日志覆盖

所有以下操作写入 `audit_logs` 表：
- 登录/登出
- CRUD 操作（含变更前后值）
- 权限变更
- Agent Run 触发与结果
- 规则上线/回滚
- 租户状态变更

### 8.2 安全事件告警

| 事件 | 告警级别 | 响应 |
|------|---------|------|
| 同一 IP 连续登录失败 5 次 | P1 | 冻结该 IP 15min |
| 跨租户查询尝试 | P0 | 立即告警 + 阻断 |
| Agent 尝试 L5 操作 | P0 | 阻断 + 告警 |
| 审计日志写入失败 | P0 | 阻断操作 + 告警 |
| Token 黑名单命中 | P1 | 记录 + 通知用户 |

---

## 九、安全开发规范

1. **依赖扫描**：每次 CI 执行 `npm audit` / `pip audit`，高危漏洞阻断构建
2. **SAST**：SonarQube 扫描，Critical/Blocker 清零
3. **Secret 扫描**：git-secrets / truffleHog，禁止提交含密钥的代码
4. **镜像扫描**：生产镜像通过 Trivy 扫描，高危 CVE 务必修复
5. **定期渗透测试**：上线前 + 每季度一次
