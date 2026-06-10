# XCDOS + Prolog AgentTeam 全链路埋点文档 V1.0

## 一、文档说明

| 属性 | 内容 |
|------|------|
| 文档名称 | XCDOS + Prolog AgentTeam 全链路埋点文档 |
| 版本 | V1.0 |
| 编写人 | 前端负责人 / 数据负责人 |
| 最后更新 | 2026-06-11 |
| 前置依赖 | XCDOS PRD V1.0 (ch.9 指标体系), 前端专项开发规范 (ch.2 埋点) |

---

## 二、埋点体系概述

统一 XCDOS + Prolog AgentTeam 双项目埋点标准。采用**无埋点 + 代码埋点**混合方案：

- **无埋点**（自动采集）：页面 PV/UV、路由切换、JS 报错、接口请求耗时
- **代码埋点**（手动）：业务事件（按钮点击、流程节点、Agent Run）、自定义属性

上报方式：前端 SDK 批量上报 → 数据网关 → ClickHouse（二期）/ PostgreSQL（MVP）

---

## 三、公共参数（所有事件必带）

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `event_id` | UUID | 事件唯一 ID | `evt_a1b2c3d4` |
| `event_time` | timestamp | 事件触发时间 | `2026-06-11T14:30:00+08:00` |
| `project` | string | 项目标识 | `xcdos` / `prolog` |
| `user_id` | UUID | 用户 ID（未登录为 anonymous） | |
| `tenant_id` | UUID | 租户 ID（Prolog 必传） | |
| `session_id` | UUID | 会话 ID | |
| `page_url` | string | 当前页面 URL | |
| `referrer` | string | 来源页面 | |
| `user_agent` | string | 浏览器 UA | |
| `screen_res` | string | 屏幕分辨率 | `1920x1080` |

---

## 四、页面埋点

### 4.1 XCDOS 页面

| 页面 | 路由 | 埋点事件名 | 额外属性 |
|------|------|-----------|---------|
| 老板驾驶舱 | /dashboard/boss | `page_view_dashboard` | `kpi_visible_count`, `exception_count` |
| 目标列表 | /goals | `page_view_goals` | `filter_status`, `filter_owner` |
| 目标详情 | /goals/:id | `page_view_goal_detail` | `goal_id`, `goal_status`, `has_children` |
| 拆推评算 | /decision-cases | `page_view_decision` | `case_count` |
| 决策详情 | /decision-cases/:id | `page_view_decision_detail` | `case_id`, `stage`, `status` |
| 任务列表 | /tasks | `page_view_tasks` | `filter_status`, `filter_owner` |
| 反馈提交 | /feedback | `page_view_feedback` | `pending_feedback_count` |
| Agent Run | /agent-runs | `page_view_agent_runs` | - |

### 4.2 Prolog 页面

| 页面 | 路由 | 埋点事件名 | 额外属性 |
|------|------|-----------|---------|
| 租户管理 | /tenants | `page_view_tenants` | `tenant_count` |
| 用户管理 | /users | `page_view_users` | `role_level_filter` |
| 规则配置 | /rules | `page_view_rules` | `rule_type_filter`, `rule_count` |
| 规则编辑 | /rules/:id | `page_view_rule_edit` | `rule_id`, `rule_status`, `version` |
| 同义词管理 | /synonyms | `page_view_synonyms` | `synonym_count` |
| 会话查看 | /sessions | `page_view_sessions` | `active_session_count` |
| 日志审计 | /logs | `page_view_logs` | `log_type` |
| 自进化任务 | /evolution | `page_view_evolution` | `task_type` |

---

## 五、行为埋点（核心业务事件）

### 5.1 XCDOS 业务事件

| 事件名 | 触发时机 | 属性 |
|--------|---------|------|
| `goal_create` | 目标创建成功 | `goal_id`, `metric_type`, `has_parent` |
| `goal_breakdown` | 目标拆解子目标 | `parent_goal_id`, `child_goal_id` |
| `goal_status_change` | 目标状态变更 | `goal_id`, `from_status`, `to_status` |
| `problem_create` | 问题录入 | `problem_id`, `goal_id`, `severity`, `source_type` |
| `hypothesis_add` | 假设添加 | `case_id`, `evidence_score`, `confidence` |
| `evaluation_submit` | 评估提交 | `case_id`, `avg_score` (4 维均值) |
| `roi_simulate` | ROI 试算 | `case_id`, `roi_value` |
| `decision_report_generate` | 决策报告生成 | `case_id`, `total_duration_minutes` |
| `task_create` | 任务创建 | `task_id`, `plan_id`, `goal_id`, `has_standard` |
| `task_status_change` | 任务状态变更 | `task_id`, `from_status`, `to_status`, `is_delayed` |
| `feedback_submit` | 反馈提交 | `task_id`, `char_count` (内容总字符数), `has_blocker` |
| `feedback_quality_scored` | 反馈质量评分完成 | `feedback_id`, `quality_score` |
| `exception_create` | 异常产生 | `exception_id`, `severity`, `goal_id` |
| `exception_resolve` | 异常解决 | `exception_id`, `resolve_duration_hours` |

### 5.2 Prolog 业务事件

| 事件名 | 触发时机 | 属性 |
|--------|---------|------|
| `tenant_create` | 租户创建 | `tenant_id`, `isolate_type` |
| `rule_create` | 规则创建 | `rule_id`, `rule_type`, `priority` |
| `rule_edit` | 规则编辑 | `rule_id`, `old_version`, `new_version` |
| `rule_status_change` | 规则状态变更 | `rule_id`, `from_status`, `to_status` |
| `rule_gray_update` | 灰度比例调整 | `rule_id`, `old_gray_rate`, `new_gray_rate` |
| `rule_rollback` | 规则回滚 | `rule_id`, `from_version`, `to_version` |
| `synonym_create` | 同义词创建 | `synonym_id`, `origin_word` |
| `session_create` | 会话创建 | `session_id`, `has_context` |
| `session_interact` | 会话交互 | `session_id`, `intent_type`, `matched_rule_id`, `confidence` |
| `session_expire` | 会话过期 | `session_id`, `duration_minutes` |
| `evolution_task_trigger` | 自进化任务触发 | `task_id`, `task_type` |
| `evolution_task_approve` | 自进化结果审核 | `task_id`, `action: approve/reject` |

---

## 六、异常与兜底埋点

| 事件名 | 触发时机 | 属性 |
|--------|---------|------|
| `js_error` | 前端 JS 异常 | `error_message`, `error_stack`, `component_name` |
| `api_error` | API 返回 4xx/5xx | `api_path`, `http_status`, `error_code`, `duration_ms` |
| `agent_run_failed` | Agent Run 失败 | `agent_type`, `error_message`, `duration_ms` |
| `rule_match_fallback` | 规则兜底命中 | `session_id`, `user_input_preview` (前 100 字符) |
| `rate_limit_hit` | 触发限流 | `api_path`, `user_id`, `current_rate` |

---

## 七、上报策略

| 策略 | 说明 |
|------|------|
| 批量上报 | 每 5s 或累积 20 条事件上报一次 |
| 实时上报 | P0 异常事件（js_error / agent_run_failed）立即上报 |
| 离线缓存 | 网络断开时存入 localStorage，恢复后补报，最多缓存 500 条 |
| 采样率 | 页面 PV：100%；点击事件：100%；性能数据：10% 采样 |

---

## 八、看板指标映射

| 产品指标 (PRD ch.9) | 埋点事件源 | 计算方式 |
|-------------------|-----------|---------|
| 目标完成率 | `goal_status_change` | count(status=completed) / count(all) |
| 任务执行率 | `task_status_change` | count(status=done) / count(all) |
| 反馈及时率 | `feedback_submit` | count(submitted_at 当日) / count(应有反馈用户) |
| 异常数 | `exception_create` - `exception_resolve` | net count |
| 规则命中率 | `session_interact` | count(intent_type=rule_match) / count(all) |
| 兜底率 | `rule_match_fallback` | count(fallback) / count(session_interact) |
