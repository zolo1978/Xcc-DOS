-- XCDOS PostgreSQL 14+ DDL（可执行事实源，Gate 1）
-- 生成：2026-06-12  对齐 ADR-0001/0003/0004/0005 + 评审 P0-01/02/03/04/06
-- 约定：所有业务表含 created_at/updated_at(NOT NULL default now())、deleted_at(nullable default NULL)
--      软删除查询默认条件 deleted_at IS NULL（P0-01）
-- 多租户：MVP 单库多 schema（public）；Tier 化隔离见 ADR-0004，迁移走影子库工作流

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- updated_at 自动维护触发器
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============ 组织域 ============
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  parent_id   UUID REFERENCES organizations(id),
  type        VARCHAR(20) NOT NULL DEFAULT 'department' CHECK (type IN ('company','department','team')),
  status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  role_id       UUID NOT NULL REFERENCES roles(id),
  name          VARCHAR(50) NOT NULL,
  email         VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,  -- Argon2id 标准编码（ADR-0003）
  status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','locked')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_users_email ON users(email) WHERE deleted_at IS NULL;

-- ============ 目标域 ============
CREATE TABLE goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id),
  owner_id    UUID NOT NULL REFERENCES users(id),
  parent_id   UUID REFERENCES goals(id),
  title       VARCHAR(200) NOT NULL,
  metric      VARCHAR(100),
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  start_date  DATE NOT NULL,
  deadline    DATE NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','cancelled')),
  version     INTEGER NOT NULL DEFAULT 0,  -- 乐观锁（P1-08）
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_goals_owner ON goals(owner_id) WHERE deleted_at IS NULL;

-- ============ 决策域 ============
CREATE TABLE problems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     UUID REFERENCES goals(id),
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE decision_cases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id  UUID NOT NULL REFERENCES problems(id),
  title       VARCHAR(200) NOT NULL,
  stage       VARCHAR(20) NOT NULL DEFAULT 'dismantle'
              CHECK (stage IN ('dismantle','hypothesize','evaluate','calculate','report')),
  status      VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE hypotheses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES decision_cases(id),
  content         TEXT NOT NULL,
  evidence_score  NUMERIC(5,2),
  confidence      NUMERIC(5,2),
  counter_example TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','validated','rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- 推演（P0-03）：版本化，不覆盖
CREATE TABLE forecasts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             UUID NOT NULL REFERENCES decision_cases(id),
  version             INTEGER NOT NULL,
  input_hypothesis_ids UUID[] NOT NULL DEFAULT '{}',
  scenarios           JSONB NOT NULL,  -- [{name,probability,outcome,impact,assumptions}]
  model_source        VARCHAR(50) NOT NULL,  -- agent:<model-id> | manual
  confidence          NUMERIC(5,2),
  revised_by          UUID REFERENCES users(id),
  agent_run_id        UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  CONSTRAINT uq_forecast_case_ver UNIQUE (case_id, version)
);

CREATE TABLE evaluations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES decision_cases(id),
  resource_score    NUMERIC(5,2),
  time_score        NUMERIC(5,2),
  risk_score        NUMERIC(5,2),
  feasibility_score NUMERIC(5,2),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE roi_simulations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES decision_cases(id),
  cost        NUMERIC NOT NULL,
  revenue     NUMERIC NOT NULL,
  roi         NUMERIC,
  payback_days INTEGER,
  assumptions JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- 执行方案（P0-02）：状态机 + 审批
CREATE TABLE plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES decision_cases(id),
  owner_id        UUID NOT NULL REFERENCES users(id),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','submitted','approved','rejected','executing','completed')),
  submitted_at    TIMESTAMPTZ,
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  rejected_reason TEXT,
  version         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  -- 审批职责分离：审批人不得为方案 owner
  CONSTRAINT chk_plan_approver_segregation CHECK (approved_by IS NULL OR approved_by <> owner_id)
);

-- ============ 执行域 ============
CREATE TABLE standards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(200) NOT NULL,
  content     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES plans(id),   -- 仅 approved plan 可引用（应用层校验，P0-02）
  goal_id     UUID REFERENCES goals(id),
  owner_id    UUID NOT NULL REFERENCES users(id),
  standard_id UUID REFERENCES standards(id),
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  due_time    TIMESTAMPTZ NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo','in_progress','done','delayed','cancelled')),
  version     INTEGER NOT NULL DEFAULT 0,  -- 乐观锁（P1-08）
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_tasks_owner ON tasks(owner_id) WHERE deleted_at IS NULL;

-- 反馈（P0-04）：不可篡改修订链 + 同日生效唯一
CREATE TABLE feedbacks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  today_goal    TEXT,
  result        TEXT,
  blocker       TEXT,
  next_action   TEXT,
  quality_score NUMERIC(5,2),
  business_date DATE NOT NULL,
  revision      INTEGER NOT NULL DEFAULT 1,
  superseded_by UUID REFERENCES feedbacks(id),
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 同日仅一条生效反馈（并发兜底，P0-04/P1-06）
CREATE UNIQUE INDEX uq_fb_current ON feedbacks(task_id, user_id, business_date) WHERE superseded_by IS NULL;
CREATE INDEX idx_fb_user_date ON feedbacks(user_id, submitted_at DESC);

CREATE TABLE exceptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES users(id),
  severity    VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status      VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  title       VARCHAR(200) NOT NULL,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- ============ Agent 与可靠事件域（ADR-0005）============
CREATE TABLE agent_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type  VARCHAR(30) NOT NULL,  -- dismantle/evaluate/report/feedback_quality
  trigger_type VARCHAR(20) NOT NULL DEFAULT 'manual',
  status      VARCHAR(20) NOT NULL DEFAULT 'running'
              CHECK (status IN ('running','succeeded','failed','cancelled')),
  input       JSONB,
  output      JSONB,
  tool_calls  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactional Outbox（ADR-0005）
CREATE TABLE outbox_events (
  event_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    VARCHAR(80) NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  aggregate_type VARCHAR(50) NOT NULL,
  aggregate_id  UUID NOT NULL,
  payload       JSONB NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','retry','published','dead')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at     TIMESTAMPTZ,
  locked_by     VARCHAR(80),
  published_at  TIMESTAMPTZ,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbox_poll ON outbox_events(status, next_attempt_at) WHERE status IN ('pending','retry');

-- 消费端去重
CREATE TABLE outbox_consumed (
  consumer_name VARCHAR(80) NOT NULL,
  event_id      UUID NOT NULL,
  consumed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  result_status VARCHAR(20) NOT NULL DEFAULT 'ok',
  PRIMARY KEY (consumer_name, event_id)
);

-- 接口幂等记录（ADR-0005）
CREATE TABLE idempotency_keys (
  idempotency_key VARCHAR(120) PRIMARY KEY,
  request_fingerprint VARCHAR(128) NOT NULL,
  response_snapshot JSONB,
  status        VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);

-- updated_at 触发器挂载（含 deleted_at 的业务表）
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','roles','users','goals','problems','decision_cases',
    'hypotheses','forecasts','evaluations','roi_simulations','plans','standards','tasks',
    'feedbacks','exceptions','agent_runs']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

COMMIT;

-- 验证：psql -f xcdos_schema.sql 应零错误；软删除查询恒附 WHERE deleted_at IS NULL
