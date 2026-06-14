# ADR-0010：向量库 + RAG + 聚类采用 pgvector + BGE-M3（schema-per-tenant）

- **Status**：Accepted
- **Date**：2026-06-14
- **Decision Makers**：技术负责人 / 架构师 / 安全负责人 / DBA
- **阶段限定**：MVP 内测期为主力方案（BGE-M3 本地）；正式商用前可叠加 OpenAI text-embedding-3-large 作为英文场景 A/B 通道，不替换本地主力

## Context

Prolog 需求清单 V1.2（`docs/Prolog AgentTeam 智能交互工厂 - 需求清单与需求基线文档（V1.2）.md:53-56`）要求自进化能力：

| 编号 | 名称 | 优先级 | 关键约束 |
|---|---|---|---|
| F-017 | 规则聚类分析（自动识别相似规则建议合并） | P2 | 离线批处理，相似规则归簇 |
| F-018 | 规则自动生成（基于样本） | P2 | LLM 生成候选规则，进 F-020 审核 |
| F-019 | 版本快照自动归档 | P1 | 规则变更触发快照 |
| F-020 | 规则审核工作流 | P1 | AI 生成规则人工审核后上线 |

需求文档 :72 明确：「**不做 AI 模型自训练，仅做规则层面的聚类和生成**」→ embedding 模型只能作为**冻结 encoder** 使用，禁止 fine-tune。

现状缺口（对抗验证报告 `docs/RESEARCH/block-f-vector-rag-clustering.md` §1.2）：
- XCDOS（NestJS+Prisma）/ Prolog（Spring Boot+Hibernate）当前文档体系完全无向量能力设计：DB Design V1.2、TDD V1.0、ARD V2 均无 `vector` 类型、无 embedding 服务、无 ANN 索引、无聚类流水线。
- F-017/F-018 是 P2 离线批处理任务，但样本来自 `request_log`（**保留 7 天**，`docs/Prolog AgentTeam 智能交互工厂 - 数据库详细设计文档（DB Design V1.2）.md:64`），必须在这 7 天窗口内完成向量化并落到永久表，否则样本丢失。
- 现有 ADR-0001~0008 未覆盖向量组件选型，本 ADR 即为补缺。

## Decision

**向量库采用 pgvector v0.8.2（PostgreSQL 扩展，复用现有 PG，零新独立服务）；embedding 主选 BGE-M3 本地 ONNX（1024 维）；ANN 索引 HNSW；schema 强制遵 ADR-0004 schema-per-tenant（向量表落在每租户 schema 内，非单表带 tenant_id）。**

### 主选方案

```
向量存储：pgvector v0.8.2（halfvec(1024) + HNSW）
Embedding：BGE-M3 本地 ONNX（MIT，1024 维，8192 token，中英双语 SOTA）
聚类算法：HDBSCAN（cosine，min_cluster_size=5）
向量化职责归属：XCDOS/Prolog 业务层独立 embedding 微服务（非 sub2api）
```

### license 与版本（GitHub API 2026-06-14 实拉）

| 组件 | repo | license（实拉 SPDX） | 最新版 | stars |
|---|---|---|---|---:|
| pgvector | `pgvector/pgvector` | NOASSERTION（实质 PostgreSQL License = BSD-like，LICENSE 原文已核验：UC Regents + PGDG，自 1996 商用无争议） | v0.8.2 | 21,742 |
| BGE-M3 | HF `BAAI/bge-m3`（GitHub `FlagOpen/FlagEmbedding`） | MIT（FlagEmbedding 仓库 + HF 模型卡均 MIT） | FlagEmbedding v1.4.0（2026-04-22） | FlagEmbedding 11,820 / HF 下载 21.7M 次 |

两者均落在 ADR-0006 license 直通区（Apache/MIT/BSD/MPL/PostgreSQL-License），无 LGPL/AGPL/GPL 风险。

### 架构分层

```
┌─────────────────────────────────────────────────────────┐
│  业务层（独立轻量 embedding 微服务，TEI/Infinity）       │
│   └─ 加载本地 BGE-M3 ONNX 权重（1024 维 halfvec）       │
│   └─ HTTP: POST /v1/embed                               │
└─────────────────────────────────────────────────────────┘
              ▲                          ▲
              │ HTTP                    │ HTTP（/v1/chat/completions, ADR-0008）
              │                         │
   ┌──────────┴────────┐      ┌─────────┴──────────┐
   │ XCDOS NestJS      │      │ Prolog Spring Boot │
   │ (Prisma $queryRaw)│      │ (Hibernate Vector) │
   └───────────────────┘      └────────────────────┘
              │                         │
              ▼                         ▼
   ┌──────────────────────────────────────────────┐
   │ PostgreSQL 14+（ADR-0001，pgvector 0.8.2）   │
   │  └─ tenant_acme.rule_embeddings (halfvec)    │  ← ADR-0004 schema-per-tenant
   │  └─ tenant_acme.case_embeddings  (halfvec)   │
   │  └─ tenant_acme.rule_clusters               │
   └──────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────┐
   │ sub2api（ADR-0008 LLM 网关，LGPLv3 不 fork）│
   │  └─ /v1/chat/completions  ← F-018 规则生成  │
   │  └─ /v1/embeddings        ← 仅商用期 OpenAI │
   └──────────────────────────────────────────────┘
```

### schema 扩展（符合 ADR-0004 schema-per-tenant）

```sql
-- 0. 扩展安装（每租户 schema 均需，或放共享 schema + 公共扩展）
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector 0.8.2

-- A. Prolog 侧：每租户 schema 内（如 tenant_acme.rule_embeddings）
CREATE TABLE {{tenant_schema}}.rule_embeddings (
  id              BIGINT PRIMARY KEY,            -- = request_log.id（1:1）
  rule_id         BIGINT,                         -- NULL=未命中规则的请求
  source_type     VARCHAR(20) NOT NULL,           -- 'request_log'|'rule_text'|'synonym'
  text_hash       VARCHAR(64) NOT NULL,           -- sha256(归一化文本)，幂等去重
  embedding       halfvec(1024) NOT NULL,         -- BGE-M3, halfvec 省 50% 存储
  model_version   VARCHAR(40) NOT NULL,           -- 'bge-m3-v1'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(text_hash, model_version)
);
CREATE INDEX idx_rule_emb_hnsw ON {{tenant_schema}}.rule_embeddings
  USING hnsw (embedding halfvec_cosine_ops) WITH (m=16, ef_construction=64);

-- B. XCDOS 侧：每租户 schema 内（如 tenant_acme.case_embeddings）
CREATE TABLE {{tenant_schema}}.case_embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES {{tenant_schema}}.decision_cases(id),
  chunk_type      VARCHAR(20) NOT NULL,           -- 'case_full'|'hypothesis'|'plan'
  chunk_ref_id    UUID,                            -- hypotheses/plans 的 id
  embedding       halfvec(1024) NOT NULL,
  model_version   VARCHAR(40) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_emb_hnsw ON {{tenant_schema}}.case_embeddings
  USING hnsw (embedding halfvec_cosine_ops);

-- C. 聚类结果表（F-017 产物，租户 schema 内）
CREATE TABLE {{tenant_schema}}.rule_clusters (
  id              BIGSERIAL PRIMARY KEY,
  run_id          UUID NOT NULL,                   -- 聚类批次
  algorithm       VARCHAR(20) NOT NULL,            -- 'hdbscan'|'kmeans'
  cluster_label   INTEGER,                         -- -1 = noise (HDBSCAN)
  centroid        halfvec(1024),
  member_rule_ids BIGINT[] NOT NULL,               -- 成员 rule_id 列表
  similarity_avg  NUMERIC(5,4),
  status          VARCHAR(20) NOT NULL DEFAULT 'proposed', -- proposed/merged/rejected
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **关键合规性说明**：原调研 JSON 方案曾把向量表放 `prolog.rule_embeddings` 单表带 `tenant_id` 列，违反 ADR-0004 Tier-B 默认 schema-per-tenant（`docs/ADR/ADR-0004-multi-tenant-schema-per-tenant.md:18`）。已修正：向量表落每租户 schema 内，删除冗余 `tenant_id` 列；Tier-A（物理独立库）/Tier-C（RLS）由 ADR-0004 框架承载，本 ADR 不重复设计。

### API 埋点

```
POST /v1/embed   {text, source_type, ref_id, tenant_jwt}    -> {embedding_id, dim:1024}
POST /v1/search  {query_text, tenant_jwt, top_k=10, source_type, threshold=0.78} -> [{ref_id, score}]
POST /v1/cluster/run {tenant_jwt, algorithm:'hdbscan', min_cluster_size:5} -> {run_id, cluster_count}   # F-017 异步 via BullMQ outbox per ADR-0005
GET  /v1/cluster/{run_id}/result                                          -> 候选合并规则对（进 F-020 审核）
POST /v1/rule/generate-from-cluster {cluster_id}                          -> 候选规则草案（F-018, LLM 走 sub2api ADR-0008）
```

### 阶段化策略（参考 ADR-0008 写法）

| 阶段 | embedding 主力 | LLM 生成（F-018） | 合规性 |
|---|---|---|---|
| MVP 内测（当前） | BGE-M3 本地 ONNX（1024 维，免费、离线、数据不出租户） | 走 sub2api 订阅号转 API（同 ADR-0008 内测期声明） | ✅ 向量本地；⚠️ LLM 上游 ToS 风险自担（仅内部） |
| 正式商用前 | BGE-M3 本地（主力不变） | sub2api 切官方 API Key | ✅ 全合规；英文决策案例可叠加 OpenAI text-embedding-3-large（3072 维）A/B 通道，走 sub2api `/v1/embeddings` 透传 |

### 向量化职责归属（关键修正）

向量化由 **XCDOS/Prolog 业务层独立 embedding 微服务**承担，**不**由 sub2api 承担。

**真实原因**（对抗验证已修正原调研 JSON 的错误论据）：
1. **离线**：Prolog E-004 边缘离线模式无外网（`docs/Prolog AgentTeam 智能交互工厂 - 需求清单与需求基线文档（V1.2）.md:65`），sub2api `/v1/embeddings` 依赖上游账号不可用。
2. **免费**：sub2api 透传的是付费上游 API（OpenAI/Cohere），BGE-M3 本地权重零边际成本。
3. **中文 SOTA**：上游 OpenAI text-3-large 中文优势不明显，且 3072 维存储成本 3x。
4. **数据不出租户**：BGE-M3 本地推理满足合规清单 V1.0 硬约束。

> **重要修正**：原调研 JSON 称「sub2api 上游订阅号无 embedding 端点」是**事实错误**。实查 `/tmp/sub2api/backend/internal/handler/openai_embeddings.go:23` + `internal/server/routes/gateway.go:92`，sub2api **已实现 `POST /v1/embeddings`**（OpenAI 兼容，透传上游 OpenAI/Cohere 账号）。本 ADR 不使用 sub2api 做 embedding 是基于上述四条真实理由，而非"sub2api 没端点"。结论方向不变（BGE-M3 本地为主），但论据必须正确。

## Consequences

### Positive

- **零新独立服务，与 ADR-0001 单库叙事对齐**：pgvector 是 PG 扩展，`CREATE EXTENSION vector` 后 `halfvec(1024)` 列直接落在现有 PG14+ 实例，复用 `pg_dump`/`pgbouncer`/`wal-g` 全套工具链，不引入新备份/监控/租户隔离逻辑。
- **license 全直通 ADR-0006**：pgvector=PostgreSQL License（BSD-like）、BGE-M3=MIT，无传染风险。
- **BGE-M3 中英双语 SOTA，契合三栈部署模式**：1024 维（vs OpenAI 3072 省 3x 存储）、8192 token 长上下文（规则文本+决策案例全量入库）、ONNX 导出支持纯 CPU 推理。Prolog 三种部署模式（公网集群/内网单机/边缘离线 E-004）全可本地化，满足"数据不出租户"硬约束。
- **schema-per-tenant 合规**：向量表落每租户 schema 内，租户内单 HNSW 索引无 tenant_id 过滤问题，与 ADR-0004 一致。
- **F-017 聚类纯本地计算**：不走 LLM，内测期不引入上游 ToS 风险；F-018 规则生成走 sub2api（同 ADR-0008），计费回填 `agent_runs.cost_cents`。
- **F-017/F-018 P2 离线批处理判断**（需求文档 :53-54 实证），pgvector HNSW 召回完全够用，无需独立向量库的高 QPS 能力。
- **不 fork sub2api**：BGE-M3 是业务层独立 embedding 微服务，与 sub2api 无源码耦合，纯 HTTP 调用，守住 LGPLv3 边界（ADR-0008）。

### Negative

- **Prisma 无原生 vector 类型（XCDOS 侧真实摩擦，非零摩擦）**：Prisma ORM 截至 2026-06 仍无原生 `vector`/`halfvec` 类型（官方博客"Native pgvector support coming soon"，当前仅 Prisma Postgres Early Access，不覆盖自托管 PG）。`schema.prisma` 内只能写 `embedding Unsupported("halfvec(1024)")`，Prisma Client 不生成类型化访问器；HNSW 索引、`CREATE EXTENSION vector`、`halfvec_cosine_ops` 必须走 **raw migration**（`prisma migrate dev --create-only` 后手写 SQL）；查询必须 `$queryRaw` 或 TypedSQL，无法用 Prisma Client 链式 API。**缓解**：封装向量操作为 Repository 层（`~/.claude/rules/common/patterns.md` §Repository Pattern），隔离 raw SQL；F-017/F-018 是 P2 离线任务，热路径不走向量检索，摩擦可接受。
- **Hibernate（Prolog 侧）适配度较好但有差异**：Hibernate 6.4+ `hibernate-vector` 模块 `org.hibernate.vector.Vector` 类型自动映射 pgvector `vector` 列，Spring AI 内置 PgVectorStore。但默认映射是 `vector` 非 `halfvec`，需自定义 `UserType` 或显式 DDL 才能用 `halfvec(1024)`；Prolog 侧零原生摩擦，XCDOS 侧承担 raw migration 代价。
- **pgvector HNSW 索引内存占用**：1024 维 halfvec 单向量 2KB，10 万条 ≈ 200MB 索引内存，挤占 `shared_buffers`。MVP 用 `m=16/ef_construction=64` 折中；监控 `pg_stat_user_indexes` 命中率；超 50 万向量评估 pgvectorscale。
- **BGE-M3 ONNX CPU 推理延迟**：单条 ~50-100ms（8192 token），批量 500 条离线任务 1-2 分钟。边缘离线无 GPU 时评估夜间批处理窗口是否充裕；商用期上 TEI/Infinity 推理服务或单卡。
- **halfvec(fp16) 精度损失**：极端 cosine 相似度 >0.99 时有精度损失。F-017 规则合并阈值设 0.85-0.92 区间，避开精度边缘。
- **request_log 7 天保留期**：自进化样本必须在 7 天窗口内完成向量化并落 `rule_embeddings`，否则样本丢失。BullMQ 定时任务每 6 小时扫描未向量化的 sample；`rule_embeddings` 永久保留（生命周期策略待定）。
- **pgvector 0.8.x 在 PG14 的 parallel HNSW 限制**：顺序建索引慢，百万向量建索引可能分钟级。parallel HNSW build 需 PG15+，当前 ADR-0001 锁 PG14+；如需并行建索引评估 PG15+ 升级（需新 ADR）。
- **BGE-M3 权重体积**：fp32 2.27GB / fp16 1.1GB，边缘设备存储/内存受限。用 ONNX 量化版压到 ~600MB。
- **pgvector license 法务确认**：SPDX=NOASSERTION，虽实质 BSD-like 但部分公司法务需书面确认函。附 LICENSE 原文（UC Regents + PGDG，自 1996 商用无争议先例），提请法务出具确认函。
- **schema-per-tenant 下向量表数量膨胀**：与 ADR-0004 §Negative 已识别风险合并管理；schema 数 >1000 时 PG 元数据查询变慢，超 1000 租户评估 Tier-A 物理独立库分流。
- **新增运维组件**：embedding 微服务（TEI/Infinity 容器）需纳入监控（不同于 sub2api 的独立 PG/Redis，本服务无状态、权重只读）。

## Alternatives Considered

| 方案 | 结论 | 理由 |
|---|---|---|
| **pgvectorscale 0.9.0**（PostgreSQL License，3,054 stars） | 备选（商用期） | StreamingDiskANN 索引、>1M 向量生产规模（基准：50M 向量 471 QPS@99% recall vs 单 pgvector 41 QPS）。仍是 PG 扩展不破坏单库叙事。但 F-017/F-018 是 P2 离线批处理，pgvector HNSW 召回够用；当 XCDOS 决策案例 + Prolog 规则向量总量破百万、单 pgvector 吞吐不足时引入。 |
| **OpenAI text-embedding-3-large**（3072 维，$0.13/M tokens） | 备选（商用期英文 A/B） | MTEB 64.6，必须外网+API Key，边缘离线不可用；3072 维存储 3x。仅作为商用期英文决策案例补充通道，走 sub2api `/v1/embeddings` 透传，不作为主力。 |
| **Cohere embed-v4 / Voyage-3.5** | 否决 | MTEB 65.2 当前第一但专有付费、数据出境、边缘离线不可用，与"成本可控、数据不出租户"硬约束冲突。 |
| **Milvus**（Apache-2.0，44,772 stars） | 否决 | 亿级分布式、K8s Operator，组件多运维重；与 ADR-0001 单 PG 库叙事冲突，新增独立服务 = 多一套备份/监控/租户隔离逻辑；F-017/F-018 离线批处理不需要其分布式能力。 |
| **Qdrant**（Apache-2.0，32,207 stars） | 否决 | Rust 单二进制、payload 过滤、scalar/binary/product 量化；但独立向量库与单库叙事冲突，1000+ 租户运维负担重，F-017/F-018 不需要高 QPS。 |
| **Weaviate**（BSD-3-Clause，16,322 stars） | 否决 | GraphQL+REST、原生 multi-tenancy、hybrid search；但内置 vectorizer 不可控（必须外网），独立组件违反单库叙事。 |
| **Chroma**（Apache-2.0，28,421 stars） | 否决 | 嵌入式+server、Python-first、Rust 内核、无原生多租户；schema-per-tenant 隔离需自建，违反 ADR-0004。 |

> **独立向量库（Milvus/Qdrant/Weaviate/Chroma）统一否决原则**：MVP/内测期一律不引入。仅在"向量与关系数据强解耦 + QPS 超过 pgvectorscale 上限"场景（当前无此需求）才重新评估。

## Related

- 关闭评审项：补齐 XCDOS/Prolog 文档体系向量能力缺口（DB Design V1.2 / TDD V1.0 / ARD V2 均无 `vector` 类型设计）
- 相关 ADR：
  - [ADR-0001](./ADR-0001-prolog-primary-db.md)：PG14+ 单库（pgvector 是 PG 扩展，复用现有实例）
  - [ADR-0002](./ADR-0002-xcdos-orm-prisma.md)：Prisma 5.x + multiSchema（vector/halfvec 须 `Unsupported` + raw migration + `$queryRaw`，摩擦可接受）
  - [ADR-0004](./ADR-0004-multi-tenant-schema-per-tenant.md)：schema-per-tenant Tier-B 默认（向量表落每租户 schema 内）
  - [ADR-0005](./ADR-0005-workflow-bullmq-outbox.md)：BullMQ + Outbox（F-017 聚类/F-018 生成异步调度）
  - [ADR-0006](./ADR-0006-use-existing-not-rewrite.md)：license 红线（pgvector=PostgreSQL License、BGE-M3=MIT 全直通）
  - [ADR-0007](./ADR-0007-prolog-hybrid-langflow.md)：Prolog 混合方案（本方案是业务底座自建一部分，与 Langflow LLM 编排并行）
  - [ADR-0008](./ADR-0008-llm-gateway-sub2api.md)：sub2api 独立部署不 fork（F-018 规则生成走 sub2api `/v1/chat/completions`；不 fork 守 LGPLv3）
- 调研底座：[Block F 对抗验证报告](../RESEARCH/block-f-vector-rag-clustering.md)（深挖 + 对抗验证结论，含 schema 违 ADR-0004 修正 + sub2api `/v1/embeddings` 端点存在性事实修正）
- 需求溯源：`docs/Prolog AgentTeam 智能交互工厂 - 需求清单与需求基线文档（V1.2）.md:53-56`（F-017~F-020）、`:72`（不做模型自训练，仅冻结 encoder）
- 数据生命周期：`docs/Prolog AgentTeam 智能交互工厂 - 数据库详细设计文档（DB Design V1.2）.md:64`（request_log 保留 7 天，向量化窗口约束）
- 合规：[数据合规清单](../XCDOS_Prolog_数据合规清单_V1.0.md)「数据不出租户」硬约束（BGE-M3 本地推理满足）
- 切换条件：商用期向量总量破百万 → 评估 pgvectorscale；英文决策案例 → 叠加 OpenAI text-embedding-3-large A/B 通道（走 sub2api `/v1/embeddings`）
- 工期：F-017/F-018 主链路 22.5 人天（详见 Block F §7），建议 Sprint 2-3 启动

## 开放问题

1. **聚类频率**：F-017 按租户每日跑一次，还是按 F-019 规则变更事件触发自动重聚类？影响 BullMQ 调度设计（ADR-0005 outbox 事件契约）。
2. **BGE-M3 部署形态**：Infinity（Rust 推理服务）/ Text Embeddings Inference（HuggingFace TEI）/ Xinference 三选一。Prolog 是 Java 栈，选 HTTP 调用最简方案（TEI 部署最轻、与 HF 生态最近）。
3. **XCDOS 决策案例相似检索的 top_k 与阈值**：PRD/TDD 未定义"相似"标准。建议 top_k=10、cosine >= 0.78 起步，需产品确认。
4. **商用期是否引入 pgvectorscale**：取决于向量总量是否破百万。当前 F-017/F-018 P2 优先级下大概率不需要；XCDOS 决策案例全量向量化后可能超预期。
5. **Tier-A（物理独立库）/ Tier-C（RLS）下的向量表迁移**：ADR-0004 Tier 间迁移需走"影子库→双写→校验→切流"工作流，向量表的 HNSW 索引重建成本需纳入迁移 SOP。
