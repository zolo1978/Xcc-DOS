# XCDOS + Prolog AgentTeam 运维手册 V1.0

> **适用范围声明（P0-10）**：本手册当前命令与镜像示例仅覆盖 **XCDOS**（NestJS / PostgreSQL / BullMQ / Prisma / Next.js）。**Prolog**（Spring Boot / PostgreSQL / Quartz / Vue3 + Langflow 容器）专属运维 SOP 见下方「Prolog 差异速查」，完整拆分版随 V1.2 发布。

## Prolog 差异速查（待部署验证，不含具体阈值）

| 维度 | XCDOS | Prolog 差异 |
|------|-------|------|
| 健康检查 | Next.js `/api/health` | Spring Actuator `/actuator/health` `/actuator/info` |
| 进程指标 | Node event-loop lag | JVM heap / GC 暂停 / 线程池（Actuator + Micrometer） |
| 定时任务 | BullMQ 队列深度 | Quartz misfire 计数 / trigger 状态 |
| LLM 编排 | — | Langflow 容器存活 / flow 调用延迟 / API 网关回源 |
| 日志路径 | pm2 / docker logs | logback 文件 + 滚动归档 |
| 部署单元 | Node 镜像 | JVM 镜像（堆内存与容器 limit 对齐 -XX:MaxRAMPercentage） |

## 一、文档说明

| 属性 | 内容 |
|------|------|
| 文档名称 | XCDOS + Prolog AgentTeam 运维手册 |
| 版本 | V1.0 |
| 编写人 | 运维负责人 / 开发配合 |
| 最后更新 | 2026-06-11 |
| 前置依赖 | XCDOS TDD V1.0 (ch.11), Prolog 部署架构 V1.2 |

本手册分三部分：**部署运维手册**、**日常运维手册**、**应急运维手册（SOP）**。

---

## 二、部署运维手册

### 2.1 环境概览

| 环境 | 部署方式 | 节点配置 | 用途 |
|------|---------|---------|------|
| 研发 | Docker Compose 单机 | 4C8G, 100G SSD | 本地开发 + 单元测试 |
| 测试 | Docker Compose 单机 | 8C16G, 200G SSD | 集成测试 + QA |
| 预发 | K8s 集群 (2 节点) | 16C32G × 2 | 灰度验证 + 性能测试 |
| 生产 | K8s 集群 (≥3 节点) | 16C32G × 3, DB 16C64G | 正式环境 |
| 边缘离线 | Bare-metal 单机 | 4C8G min | 离线场景 |

### 2.2 编译打包

```bash
# XCDOS 前端
cd xcdos-web && npm ci && npm run build
# 产物：out/ (Next.js static export) 或 .next/ (SSR)

# XCDOS 后端
cd xcdos-server && npm ci && npm run build
# 产物：dist/

# Docker 镜像构建
docker build -t xcdos-server:${VERSION} -f Dockerfile.server .
docker build -t xcdos-web:${VERSION} -f Dockerfile.web .
docker push registry.rouddian.com/xcdos-server:${VERSION}
```

### 2.3 环境变量配置

```bash
# XCDOS Server 关键环境变量
DATABASE_URL=postgresql://user:pass@host:5432/xcdos
REDIS_URL=redis://:pass@host:6379/0
JWT_PUBLIC_KEY_PATH=/etc/xcdos/jwt-public.pem
JWT_PRIVATE_KEY_PATH=/etc/xcdos/jwt-private.pem
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.openai.com/v1
LOG_LEVEL=info
NODE_ENV=production
```

### 2.4 启动与停止

```bash
# K8s 部署
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/deployment-server.yaml
kubectl apply -f k8s/deployment-web.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# 启动
kubectl scale deployment xcdos-server --replicas=3

# 停止（零流量优雅下线）
kubectl scale deployment xcdos-server --replicas=0

# 重启（滚动重启）
kubectl rollout restart deployment xcdos-server

# 查看状态
kubectl get pods -n xcdos -w
kubectl logs -f deployment/xcdos-server -n xcdos
```

### 2.5 数据库迁移

```bash
# TypeORM
npm run migration:run

# 回滚最近一次迁移
npm run migration:revert
```

---

## 三、日常运维手册

### 3.1 常规巡检项（每日）

| 巡检项 | 检查命令 | 正常范围 |
|--------|---------|---------|
| Pod 状态 | `kubectl get pods -n xcdos` | 全部 Running，重启次数 < 3 |
| CPU 使用率 | `kubectl top pods -n xcdos` | < 70% |
| 内存使用率 | `kubectl top pods -n xcdos` | < 80% |
| 数据库连接数 | `SELECT count(*) FROM pg_stat_activity` | < 50 |
| Redis 内存 | `redis-cli INFO memory` | used_memory < maxmemory * 0.8 |
| 磁盘使用率 | `df -h` | < 70% |
| 慢查询 | `SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10` | 无 > 1s 的查询 |
| 队列堆积 | BullMQ Dashboard 面板 | waiting < 100 |

### 3.2 日志查看

```bash
# 应用日志
kubectl logs -f deployment/xcdos-server -n xcdos --tail=200

# 错误日志
kubectl logs deployment/xcdos-server -n xcdos | grep ERROR

# 审计日志（数据库）
SELECT * FROM audit_logs WHERE created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 100;
```

### 3.3 日志级别切换

```bash
# 动态切换日志级别（无需重启）
curl -X POST https://api.xcdos.com/admin/log-level \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"level": "debug"}'  # info / warn / error / debug
```

### 3.4 常用运维操作

```bash
# 规则批量导入
curl -X POST https://api.xcdos.com/api/v1/rules/batch-import \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@rules_export_20260611.json"

# 会话管理——查看活跃会话
SELECT session_id, tenant_id, created_at, expire_time FROM user_session WHERE session_status='active';

# 清理过期会话
UPDATE user_session SET session_status='expired' WHERE expire_time < NOW() AND session_status='active';
```

---

## 四、应急运维手册（SOP）

### 4.1 故障响应流程

```
告警触发 → 值班 SRE 确认 (5min) → 故障定级 P0/P1/P2
  → P0: 拉群(CTO+TECH+SRE) → 按 SOP 执行 → 30min 内恢复
  → P1: 通知技术负责人 → 排查 → 2h 内恢复
  → P2: 登记 Jira → 下一工作日修复
  → 故障恢复 → 写 Postmortem → 复盘改进
```

### 4.2 常见故障处理

#### 故障 1：API 全站 500

**排查路径**：
```bash
# 1. 检查 Pod 状态
kubectl get pods -n xcdos

# 2. 查看最近日志
kubectl logs deployment/xcdos-server -n xcdos --tail=100 | grep -E "ERROR|FATAL"

# 3. 检查数据库连接
kubectl exec -it deployment/xcdos-server -n xcdos -- \
  node -e "const {Pool}=require('pg');new Pool().connect().then(()=>console.log('OK')).catch(e=>console.error(e))"

# 4. 检查 Redis 连接
kubectl exec -it deployment/xcdos-server -n xcdos -- \
  node -e "const Redis=require('ioredis');new Redis().ping().then(()=>console.log('OK'))"
```

**常见原因与处理**：
- DB 连接耗尽 → 重启应用 Pod（`kubectl rollout restart`）
- Redis 不可用 → 检查 Redis 进程/内存，必要时重启 Redis
- 代码 Bug → 立即回滚到上一个稳定版本（见回滚预案）

#### 故障 2：驾驶舱 KPI 不更新

**排查**：
1. 检查 BullMQ 事件队列是否堆积
2. 手动触发达看板缓存刷新：`POST /api/admin/cache/invalidate dashboard`
3. 检查 Redis 缓存状态：`redis-cli --scan --pattern 'dashboard:*'`（生产禁用 KEYS，阻塞主线程；用 SCAN，P2-12）

#### 故障 3：Agent Run 全部失败

**排查**：
1. 检查 LLM API 连通性：`curl -I $LLM_BASE_URL`
2. 检查 API Key 是否过期/余额不足
3. 查看 AgentRun 错误日志：`SELECT * FROM agent_runs WHERE status='failed' ORDER BY created_at DESC LIMIT 10`
4. 临时关闭 Agent 功能：`FEATURE_AGENT_ASSIST=OFF`

### 4.3 一键处理命令

```bash
# 熔断——关闭 Agent 功能
kubectl set env deployment/xcdos-server FEATURE_AGENT_ASSIST=OFF -n xcdos

# 降级——开启维护模式
kubectl set env deployment/xcdos-server MAINTENANCE_MODE=ON -n xcdos

# 限流——降低全局限流阈值
kubectl set env deployment/xcdos-server RATE_LIMIT_REQ_PER_MIN=30 -n xcdos

# 重启所有 Pod
kubectl rollout restart deployment/xcdos-server -n xcdos

# 节点摘除
kubectl cordon <node-name> && kubectl drain <node-name> --ignore-daemonsets

# 扩容
kubectl scale deployment xcdos-server --replicas=5 -n xcdos
```
