# Block F — 向量库 + RAG + 聚类（对抗验证报告）

> 调研日期：2026-06-14
> 执行：Block F 对抗验证者（Claude Code 直查，gh api + WebSearch + 源码核验）
> 数据源：GitHub API 实拉（stars/license/tags/pushed）+ LICENSE 原文 base64 解码 + sub2api 源码 grep + Prisma/Hibernate 官方文档
> 前置 ADR：ADR-0001（PG14+）/ADR-0002（Prisma 5.x + multiSchema）/ADR-0004（schema-per-tenant）/ADR-0005（BullMQ+Outbox）/ADR-0006（license 红线）/ADR-0008（sub2api LLM 网关）

---

## 1. 领域与现状缺口

### 1.1 需求边界（实查 Prolog 需求清单 V1.2）

| 编号 | 模块 | 名称 | 优先级 | 文档行 |
|---|---|---|---|---|
| F-017 | 自进化任务 | 规则聚类分析（自动识别相似规则建议合并） | **P2** | `Prolog AgentTeam - 需求清单与需求基线文档（V1.2）.md:53` |
| F-018 | 自进化任务 | 规则自动生成（基于样本） | **P2** | 同上 :54 |
| F-019 | 自进化任务 | 版本快照自动归档 | P1 | 同上 :55 |
| F-020 | 自进化任务 | 规则审核工作流（AI 生成规则人工审核后上线） | P1 | 同上 :56 |

**关键约束**（需求文档 :72）："不做 AI 模型自训练，仅做规则层面的聚类和生成" → embedding 模型必须作为**冻结 encoder** 使用，禁止 fine-tune。

### 1.2 现状缺口

- XCDOS（NestJS+Prisma）/ Prolog（Spring Boot+Hibernate）当前文档体系**完全无向量能力设计**：DB Design V1.2、TDD V1.0、ARD V2 均无 `vector` 类型、无 embedding 服务、无 ANN 索引、无聚类流水线。
- F-017/F-018 是 P2 离线批处理任务，但样本来自 `request_log`（**保留 7 天**，`DB Design V1.2:64`），必须在这 7 天窗口内完成向量化并落到永久表，否则样本丢失。
- 现有 ADR-0001~0008 未覆盖向量组件选型，本报告即为补 ADR-0009（待立项）的调研底座。

---

## 2. 候选开源对比（GitHub API 2026-06-14 实拉）

> 所有 license/stars/tag 均为实拉结果，**与深挖结论 JSON 的差异已在脚注标出**。

| 名称 | repo | license（实拉 SPDX） | 最新版（实拉 tag） | star（实拉） | fitScore | 关键能力 |
|---|---|---|---|---:|:---:|---|
| pgvector | `pgvector/pgvector` | NOASSERTION（实质 PostgreSQL License = BSD-like，LICENSE 原文已核验） | **v0.8.2** | **21,742** | **9** | HNSW+IVFFlat、halfvec/bit/sparse、vector(2000)/halfvec(4000)、L2/cosine/IP/Hamming/Jaccard |
| BGE-M3 | HF `BAAI/bge-m3`（GitHub 仓库在 `FlagOpen/FlagEmbedding`，大写 O） | MIT（FlagEmbedding 仓库 + 模型卡） | FlagEmbedding **v1.4.0**（2026-04-22） | FlagEmbedding 11,820 / HF 模型下载 21.7M 次、3,109 likes | **9** | dense+sparse+multi-vector、xlm-roberta 100+ 语种、8192 token、ONNX/TensorRT 导出 |
| pgvectorscale | `timescale/pgvectorscale` | **PostgreSQL**（单一，非"Apache-2.0 可选"）[脚注¹] | **0.9.0**（2025-11-04，非"0.7.x"）[脚注²] | **3,054**（非"约5k"）[脚注³] | **7** | StreamingDiskANN 索引、与 pgvector 共存、>1M 向量生产规模 |
| Qdrant | `qdrant/qdrant` | Apache-2.0 | v1.18.2（2026-06-04） | 32,207 | **5** | Rust 单二进制、payload 过滤、scalar/binary/product 量化、gRPC+REST |
| Weaviate | `weaviate/weaviate` | BSD-3-Clause | v1.38.0（2026-06-05） | 16,322 | **4** | GraphQL+REST、原生 multi-tenancy、hybrid search（BM25+dense）、内置 vectorizer |
| Milvus | `milvus-io/milvus` | Apache-2.0 | v2.6.18（2026-06-05） | 44,772 | **3** | 亿级分布式、K8s Operator、IVF_FLAT/HNSW/DISKANN、组件多运维重 |
| Chroma | `chroma-core/chroma` | Apache-2.0 | 1.5.9（2026-05-05） | 28,421 | **3** | 嵌入式+server、Python-first、Rust 内核、无原生多租户 |
| OpenAI text-embedding-3-large | 闭源 API | 专有付费 | 持续可用 | N/A | **4** | 3072 维（可 Matryoshka 降维）、MTEB 64.6、$0.13/M tokens、必须外网 |
| Cohere embed-v4 / Voyage-3.5 | 闭源 API | 专有付费 | embed-v4 / voyage-3.5 | N/A | **3** | 多模态/量化、MTEB 65.2 当前第一、$0.12-0.18/M tokens、数据出境 |

**脚注修正（对抗验证阶段发现的 JSON 错误）**：
1. pgvectorscale license 实拉 SPDX = `PostgreSQL`（单一），JSON 说"PostgreSQL License (Apache-2.0 可选)"中"Apache-2.0 可选"无依据。
2. pgvectorscale 最新 release 实查 = `0.9.0`（2025-11-04），JSON 说"0.7.x (2026 活跃)"过时近一年；2026-04-30 仍有 commit（pg_catalog schema 限定修复），社区活跃度可。
3. pgvectorscale stars 实拉 = 3,054，JSON 说"约5k"高估 64%。

---

## 3. 推荐方案 + 理由

### 3.1 主选方案

```
向量存储：pgvector v0.8.2（HNSW + halfvec(1024)）
Embedding 模型：BGE-M3（本地 ONNX 权重，1024 维）
```

**理由（按优先级）**：

1. **零新独立服务，与 ADR-0001 单库叙事对齐**
   pgvector 是 PG 扩展，`CREATE EXTENSION vector` 后 `halfvec(1024)` 列直接落在现有 PG14+ 实例，复用 `pg_dump`/`pgbouncer`/`wal-g` 全套工具链，不引入新备份/监控/租户隔离逻辑。pgvectorscale 基准（50M 向量 471 QPS@99% recall vs 单 pgvector 41 QPS）证明在远超本项目规模的场景下吞吐仍优于独立向量库，但 **F-017/F-018 是 P2 离线批处理**，pgvector HNSW 召回完全够用，pgvectorscale 留作商用期 >1M 向量时的可选增强。

2. **license 全直通 ADR-0006**
   - pgvector = PostgreSQL License（LICENSE 原文已核验：`Portions Copyright (c) 1996-2026, PostgreSQL Global Development Group` + UC Regents，免责条款与 BSD-2-Clause 实质等同，自 1996 起广泛商用无争议）。
   - BGE-M3 = MIT（FlagEmbedding 仓库 `FlagOpen/FlagEmbedding` + HF 模型卡 `BAAI/bge-m3` 均 MIT）。
   - 两者均落在 ADR-0006 直通区（Apache/MIT/BSD/MPL/PostgreSQL-License），无 LGPL/AGPL/GPL 风险。

3. **BGE-M3 中英双语 SOTA，契合三栈部署模式**
   1024 维（vs OpenAI text-3-large 3072 省 3x 存储）、8192 token 长上下文（规则文本+决策案例全量入库）、sentence-transformers+ONNX 导出支持纯 CPU 推理。Prolog 三种部署模式（公网集群 / 内网单机 / **边缘离线 E-004**）全可本地化，满足"数据不出租户"硬约束。

4. **OpenAI/Cohere/Voyage 商用 API 全部降级为备选**
   原因：(a) 必须外网+API Key，边缘离线不可用；(b) 3072 维存储成本 3x；(c) 与"成本可控、数据不出租户"硬约束冲突。仅作为商用期英文决策案例的 A/B 通道，**不作为主力**。

### 3.2 备选方案

- **pgvectorscale 0.9.0**（PostgreSQL License）：当 XCDOS 决策案例 + Prolog 规则向量总量破百万、单 pgvector 吞吐不足时引入。仍是 PG 扩展，不破坏单库叙事。当前 F-017/F-018 P2 优先级下大概率不需要。
- **OpenAI text-embedding-3-large**：商用期英文决策案例补充通道，走 sub2api `/v1/embeddings` 透传（见 §5）。

### 3.3 明确否决

- **Milvus / Qdrant / Weaviate / Chroma（独立向量库）**：MVP/内测期一律不引入。原因：
  - 与 ADR-0001 单 PG 库叙事冲突，新增独立服务 = 多一套备份/监控/租户隔离逻辑。
  - ADR-0006 license 红线虽全直通，但"独立组件 + 1000+ 租户运维"违反 §三"1000+ schema 元数据膨胀"已识别的运维负担。
  - F-017/F-018 是离线批处理，不需要 Weaviate 实时混合检索或 Qdrant 高 QPS 能力。
  - 仅在"向量与关系数据强解耦 + QPS 超过 pgvectorscale 上限"场景（当前无此需求）才重新评估。

---

## 4. XCDOS / Prolog 落地设计

> **本节已根据对抗验证修正 schema-per-tenant 合规性问题**（详见 §6 风险 R3）。

### 4.1 schema 扩展（修正版，符合 ADR-0004 schema-per-tenant）

```sql
-- 0. 扩展安装（每租户 schema 均需，或放共享 schema + 公共扩展）
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector 0.8.2

-- ============================================================
-- A. Prolog 侧：每个租户 schema 内（如 tenant_acme.rule_embeddings）
--    符合 ADR-0004 Tier-B schema-per-tenant 默认模式
-- ============================================================
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
-- HNSW 索引：租户内单索引，无 tenant_id 过滤问题
CREATE INDEX idx_rule_emb_hnsw ON {{tenant_schema}}.rule_embeddings
  USING hnsw (embedding halfvec_cosine_ops) WITH (m=16, ef_construction=64);

-- ============================================================
-- B. XCDOS 侧：每个租户 schema 内（如 tenant_acme.case_embeddings）
-- ============================================================
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

-- ============================================================
-- C. 聚类结果表（F-017 产物，租户 schema 内）
-- ============================================================
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

**为何删除 JSON 原方案的 `tenant_id` 列**：
ADR-0004 Tier-B 默认 schema-per-tenant，表本身在租户 schema 内，`tenant_id` 列冗余且违反 ADR-0004。Tier-A（物理独立库）/Tier-C（RLS）的场景由 ADR-0004 框架承载，本报告不重复设计。

### 4.2 API 埋点

```
POST /v1/embed  {text, source_type, ref_id, tenant_jwt}
  -> {embedding_id, dim:1024}            # XCDOS/Prolog 业务层调本地 BGE-M3 服务

POST /v1/search {query_text, tenant_jwt, top_k=10, source_type, threshold=0.78}
  -> [{ref_id, score}]                   # 半径内相似检索

POST /v1/cluster/run {tenant_jwt, algorithm:'hdbscan', min_cluster_size:5}
  -> {run_id, cluster_count}             # F-017, 异步 via BullMQ outbox per ADR-0005

GET  /v1/cluster/{run_id}/result
  -> 候选合并规则对                       # F-017 输出，进 F-020 审核工作流

POST /v1/rule/generate-from-cluster {cluster_id}
  -> 候选规则草案                         # F-018, LLM 调用走 sub2api ADR-0008
```

### 4.3 向量化职责归属

```
┌─────────────────────────────────────────────────────────┐
│  业务层（独立轻量 embedding 微服务，FastAPI/TEI/Infinity）│
│   └─ 加载本地 BGE-M3 ONNX 权重（1024 维）              │
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
   │  └─ tenant_acme.rule_embeddings (halfvec)    │
   │  └─ tenant_acme.case_embeddings  (halfvec)   │
   │  └─ tenant_acme.rule_clusters               │
   └──────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────┐
   │ sub2api（ADR-0008 LLM 网关，LGPLv3 不 fork）│
   │  └─ /v1/chat/completions  ← F-018 规则生成  │
   │  └─ /v1/embeddings        ← 仅商用期 OpenAI │
   └──────────────────────────────────────────────┘
```

**关键修正（对抗验证发现）**：
原 JSON 论据"sub2api 上游订阅号无 embedding 端点"是**错的**。实查 `/tmp/sub2api/backend/internal/handler/openai_embeddings.go:23` 与 `internal/server/routes/gateway.go:92`，sub2api **已实现 `POST /v1/embeddings`**（OpenAI 兼容，透传上游 OpenAI/Cohere 账号）。

**修正后的论据**：BGE-M3 走本地 embedding 微服务的真实原因有四：
1. **离线**：Prolog E-004 边缘离线模式无外网，sub2api `/v1/embeddings` 依赖上游账号不可用。
2. **免费**：sub2api 透传的是付费上游 API，BGE-M3 本地权重零边际成本。
3. **中文 SOTA**：上游 OpenAI text-3-large 中文优势不明显且 3072 维存储 3x。
4. **数据不出租户**：BGE-M3 本地推理满足合规清单 V1.0 硬约束；sub2api `/v1/embeddings` 仅在商用期作为 OpenAI 通道的 A/B 备选。

**结论方向不变**（BGE-M3 本地为主），但**论据必须修正**，不能以错误事实支撑正确结论。

### 4.4 流水线伪代码（request_log → embedding → 聚类 → 候选规则）

```python
# F-017 + F-018 离线流水线（BullMQ outbox 调度，ADR-0005）
# 每租户 schema 独立运行，避免跨租户聚合

async def rule_evolution_pipeline(tenant_schema: str):
    # 1. 采样：request_log 仅保留 7 天（DB Design V1.2:64），必须窗口内向量化和落库
    samples = await db.fetch_all(f"""
      SELECT rl.id, rl.request_content, rl.response_content, rl.hit_rule_id
      FROM {tenant_schema}.request_log rl
      LEFT JOIN {tenant_schema}.rule_embeddings re ON re.id = rl.id
      WHERE rl.is_sample = TRUE AND re.id IS NULL
      LIMIT 500
    """)

    # 2. 文本归一化（去 PII per 合规清单 V1.0）
    texts = [normalize_and_strip_pii(s) for s in samples]

    # 3. 向量化：调本地 BGE-M3 服务（1024 维 halfvec）
    embeddings = await bge_m3_client.embed(texts, model="bge-m3-v1")

    # 4. 幂等写入（text_hash 去重）
    await db.execute_many(f"""
      INSERT INTO {tenant_schema}.rule_embeddings
        (id, rule_id, source_type, text_hash, embedding, model_version)
      VALUES ($1, $2, 'request_log', $3, $4, 'bge-m3-v1')
      ON CONFLICT (text_hash, model_version) DO NOTHING
    """, [(s.id, s.hit_rule_id, sha256(t), e) for s, t, e in zip(samples, texts, embeddings)])

    # 5. 聚类：per-tenant HDBSCAN（cosine, min_cluster_size=5）
    all_emb = await db.fetch_all(f"SELECT id, rule_id, embedding FROM {tenant_schema}.rule_embeddings")
    labels = hdbscan.fit(all_emb.emb, metric='cosine', min_cluster_size=5)

    # 6. 候选生成：每簇 centroid 附近 top-3 样本 → sub2api LLM 生成候选规则（F-018）
    for cluster_id, members in group_by_cluster(labels):
        if cluster_id == -1:  # noise
            continue
        representatives = top_n_near_centroid(members, n=3)
        draft_rule = await sub2api_client.chat(
            model="claude-sonnet",
            prompt=build_rule_synthesis_prompt(representatives),
            # ADR-0008: 走 sub2api sk-xxx key，不直接接触上游凭证
        )
        await db.execute(f"""
          INSERT INTO {tenant_schema}.rule_clusters
            (run_id, algorithm, cluster_label, centroid, member_rule_ids, status)
          VALUES ($1, 'hdbscan', $2, $3, $4, 'proposed')
        """, (run_id, cluster_id, centroid, member_ids))
        await save_rule_draft(draft_rule, status='draft')  # 进 F-020 审核

    # 全链路在 agent_runs 留痕（agent_type='rule_cluster'/'rule_generate'）
    # cost_cents 由 sub2api 回填
```

### 4.5 Prisma / Hibernate 真实摩擦（JSON 未充分说明）

**Prisma（XCDOS 侧，ADR-0002）真实摩擦**：
- Prisma ORM **截至 2026-06 仍无原生 `vector`/`halfvec` 类型**（官方博客"Native pgvector support coming soon"，当前为 Early Access for Prisma Postgres，不覆盖自托管 PG）。
- `schema.prisma` 内只能写 `embedding Unsupported("halfvec(1024)")`，Prisma Client 不生成该字段的类型化访问器。
- HNSW 索引、`CREATE EXTENSION vector`、`halfvec_cosine_ops` 必须**走 raw migration**（`prisma migrate dev --create-only` 后手写 SQL）。
- 查询时必须 `$queryRaw` 或 TypedSQL，无法用 Prisma Client 链式 API。
- **结论**：摩擦真实存在但可接受（F-017/F-018 是 P2 离线任务，热路径不走向量检索）。JSON "无新客户端"表述过于乐观，应改为"raw migration + `$queryRaw` 即可，无新独立服务"。

**Hibernate（Prolog 侧）适配度**：
- Hibernate 6.4+ 提供 `hibernate-vector` 模块，`org.hibernate.vector.Vector` 类型自动映射 pgvector `vector` 列（火山引擎、Spring AI Reference 实证）。
- Spring AI 内置 PgVectorStore，与 Spring Boot 集成度优于 Prisma+pgvector。
- **结论**：Prolog 侧零摩擦，XCDOS 侧有 raw migration 代价。

---

## 5. 与 sub2api / 已有 ADR 的关系

### 5.1 sub2api 约束如何满足（ADR-0008）

| ADR-0008 约束 | 本方案如何满足 |
|---|---|
| 不 fork sub2api 源码（LGPLv3 传染）| BGE-M3 是**业务层独立 embedding 微服务**，与 sub2api 无源码耦合，纯 HTTP 调用（F-018 规则生成走 sub2api `/v1/chat/completions`） |
| 业务层只持 sub2api 分发的 sk-xxx Key | F-018 LLM 调用经 sub2api，业务层不直接接触上游凭证 |
| 计费数据由 sub2api 回传写入 agent_runs | F-018 规则生成 cost_cents 由 sub2api 回填（ADR-0008 §接入方式） |
| 内测期订阅号 ToS 风险自担 | F-017 聚类是纯本地计算不走 LLM；F-018 生成走 sub2api，符合内测期声明 |

**重要修正**：原 JSON 说"sub2api 是 LLM 网关 chat/messages，上游订阅号无 embedding 端点"——**实查错误**。`/tmp/sub2api/backend/internal/handler/openai_embeddings.go:23` + `routes/gateway.go:92` 证明 sub2api **有 `POST /v1/embeddings` 端点**（透传上游 OpenAI 账号）。但本方案仍**不使用 sub2api 做 embedding**，原因见 §4.3（离线/免费/中文 SOTA/数据不出租户），而非"sub2api 没端点"。商用期 OpenAI text-3-large A/B 通道可走 sub2api `/v1/embeddings`。

### 5.2 与 ADR-0001~0007 一致性

| ADR | 约束 | 一致性 |
|---|---|---|
| ADR-0001 | PG14+ 单库 | ✅ pgvector 0.8.2 是 PG 扩展，复用现有实例；注意 parallel HNSW build 需 PG15+，当前 PG14 可顺序建索引 |
| ADR-0002 | Prisma 5.x + multiSchema | ⚠️ 有摩擦：vector/halfvec 须 `Unsupported` + raw migration + `$queryRaw`，但可接受 |
| ADR-0004 | schema-per-tenant（Tier-B 默认）| ✅ **已修正**：rule_embeddings/case_embeddings 放每租户 schema 内，删除冗余 tenant_id 列 |
| ADR-0005 | BullMQ + Outbox | ✅ F-017 聚类/F-018 生成走 BullMQ outbox 异步调度 |
| ADR-0006 | license 红线 | ✅ pgvector=PostgreSQL License（BSD-like）/BGE-M3=MIT，全直通 |
| ADR-0007 | Prolog 混合方案（业务自建+Langflow 嵌入）| ✅ 本方案是业务底座自建的一部分，与 Langflow LLM 编排子系统并行 |
| ADR-0008 | sub2api 独立部署不 fork | ✅ 见 §5.1 |

---

## 6. 风险与开放问题

### 6.1 风险

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | **pgvector HNSW 索引内存占用** | 1024 维 halfvec 单向量 2KB，10 万条 ≈ 200MB 索引内存，挤占 `shared_buffers` | MVP 用 `m=16/ef_construction=64` 折中；监控 `pg_stat_user_indexes` 命中率；超 50 万向量评估 pgvectorscale |
| R2 | **BGE-M3 ONNX CPU 推理延迟** | 单条 ~50-100ms（8192 token），批量 500 条离线任务 1-2 分钟 | 边缘离线无 GPU 时评估夜间批处理窗口是否充裕；商用期上 TEI/Infinity 推理服务或单卡 |
| R3 | **halfvec(fp16) 精度损失** | 极端 cosine 相似度 >0.99 时有精度损失 | F-017 规则合并阈值设 0.85-0.92 区间，避开精度边缘 |
| R4 | **request_log 7 天保留期**（DB Design V1.2:64）| 自进化样本必须在 7 天窗口内完成向量化并落 rule_embeddings | BullMQ 定时任务每 6 小时扫描未向量化的 sample；rule_embeddings 永久保留（生命周期策略待定） |
| R5 | **pgvector 0.8.x 在 PG14 的 parallel HNSW 限制** | 顺序建索引慢，百万向量建索引可能分钟级 | 当前 ADR-0001 锁 PG14+；如需并行建索引评估 PG15+ 升级（需新 ADR） |
| R6 | **BGE-M3 权重体积** | fp32 2.27GB / fp16 1.1GB，边缘设备存储/内存受限 | 用 ONNX 量化版压到 ~600MB |
| R7 | **pgvector license 法务确认** | SPDX=NOASSERTION，虽实质 BSD-like 但部分公司法务需书面确认函 | 附 LICENSE 原文（UC Regents + PGDG，自 1996 商用无争议先例），提请法务出具确认函 |
| R8 | **schema-per-tenant 下向量表数量膨胀** | ADR-0004 §Negative：schema 数 >1000 时 PG 元数据查询变慢 | 与 ADR-0004 已识别风险合并管理；超 1000 租户评估 Tier-A 物理独立库分流 |
| R9 | **Prisma 无原生 vector 类型** | XCDOS 侧 raw migration 维护成本，团队需熟悉 `$queryRaw` | 封装向量操作为 Repository 层（patterns.md §Repository Pattern），隔离 raw SQL |

### 6.2 开放问题

1. **聚类频率**：F-017 是按租户每日跑一次，还是按 F-019 规则变更事件触发自动重聚类？影响 BullMQ 调度设计（ADR-0005 outbox 事件契约）。
2. **BGE-M3 部署形态**：Infinity（Rust 推理服务）/ Text Embeddings Inference（HuggingFace TEI）/ Xinference 三选一。Prolog 是 Java 栈，选 HTTP 调用最简方案（TEI 部署最轻、与 HF 生态最近）。
3. **XCDOS 决策案例相似检索的 top_k 与阈值**：PRD/TDD 未定义"相似"标准。建议 top_k=10、cosine >= 0.78 起步，需产品确认。
4. **商用期是否引入 pgvectorscale**：取决于向量总量是否破百万。当前 F-017/F-018 P2 优先级下大概率不需要；XCDOS 决策案例全量向量化后可能超预期。
5. **Tier-A（物理独立库）/ Tier-C（RLS）下的向量表迁移**：ADR-0004 Tier 间迁移需走"影子库→双写→校验→切流"工作流，向量表的 HNSW 索引重建成本需纳入迁移 SOP。

---

## 7. 工期估算（人天）

| 阶段 | 工作项 | 人天 |
|---|---|---:|
| PoC | pgvector + BGE-M3 本地跑通（含 halfvec/HNSW 基准） | 2 |
| PoC | Prisma raw migration + Repository 封装（XCDOS 侧） | 1.5 |
| PoC | Hibernate VectorType 集成（Prolog 侧） | 1 |
| 实现 | schema 扩展（rule_embeddings/case_embeddings/rule_clusters） | 2 |
| 实现 | embedding 微服务（TEI 部署 BGE-M3 ONNX） | 3 |
| 实现 | F-017 聚类流水线（HDBSCAN + BullMQ outbox 调度） | 4 |
| 实现 | F-018 规则生成（sub2api `/v1/chat/completions` 集成） | 2 |
| 实现 | F-020 审核工作流候选规则接入（status=draft→review） | 2 |
| 测试 | 单测（聚类阈值/幂等/PII 脱敏）+ 集成测试 | 3 |
| 文档 | ADR-0009 立项 + 回写 DB Design/TDD | 1.5 |
| **合计** | | **22.5** |

> 仅 F-017/F-018 主链路。pgvectorscale 引入、OpenAI A/B 通道、Tier-A/C 迁移 SOP 不含在内，按需另立任务。

---

## 8. 对抗验证结论

### 8.1 JSON 结论中**成立**的部分

- 主选 pgvector + BGE-M3 方向正确（零新独立服务、license 直通、中文 SOTA、离线可跑）。
- license 复核方向正确（pgvector=BSD-like、BGE-M3=MIT 均直通 ADR-0006）。
- Milvus/Qdrant/Weaviate/Chroma 否决理由正确（独立服务 + 与单库叙事冲突 + 过度设计）。
- F-017/F-018 是 P2 离线批处理的判断正确（需求文档 :53-54 实证）。

### 8.2 JSON 结论中**必须修正**的错误

1. **pgvectorscale stars 3,054（非"约5k"）**——高估 64%，影响"社区活跃度"判断（虽然 2026-04-30 仍有 commit，活跃度可接受）。
2. **pgvectorscale 最新版 0.9.0（非"0.7.x"）**——过时近一年。
3. **pgvectorscale license 单一 PostgreSQL（非"Apache-2.0 可选"）**——无依据表述。
4. **FlagEmbedding 正确路径 `FlagOpen/FlagEmbedding`（非 `flagopen` 小写）**——大小写影响引用准确性。
5. **sub2api 有 `/v1/embeddings` 端点**（openai_embeddings.go:23）——JSON 论据"sub2api 无 embedding 端点"事实错误。结论方向对（BGE-M3 本地为主）但论据必须换成离线/免费/中文/数据不出租户四条。
6. **schema 设计违反 ADR-0004**——Tier-B 默认 schema-per-tenant，原方案 `prolog.rule_embeddings` 单表带 tenant_id 不合规，应放每租户 schema 内（已修正 §4.1）。
7. **Prisma 真实摩擦未充分说明**——截至 2026-06 无原生 vector 类型，须 `Unsupported` + raw migration + `$queryRaw`，非"零摩擦"。
8. **fitScore 微调**：pgvector 10→9（Prisma 摩擦扣 1）、pgvectorscale 9→7（license 单一性 + stars 高估修正后社区规模下调）、Qdrant 6→5、Weaviate 5→4、Milvus 3 不变、Chroma 4→3。

### 8.3 最终建议（给主决策者）

**采纳主选方案**：pgvector v0.8.2（HNSW + halfvec(1024)）+ BGE-M3 本地 ONNX。理由充分、license 直通、与 ADR-0001/0004/0005/0006/0008 全部兼容。**前置条件**：先按 §4.1 修正 schema 设计（schema-per-tenant），按 §4.3 修正 embedding 职责归属论据，按 §4.5 接受 Prisma raw migration 代价。**立项 ADR-0009**（向量组件选型）回写 DB Design V1.2 与 TDD V1.0。F-017/F-018 工期 22.5 人天，建议 Sprint 2-3 启动。

---

## 9. 引用清单

**repo + 版本（GitHub API 2026-06-14 实拉）**：
- `pgvector/pgvector` v0.8.2，stars 21,742，license=NOASSERTION（PostgreSQL License，LICENSE 原文核验）
- `FlagOpen/FlagEmbedding` v1.4.0（2026-04-22），stars 11,820，license=MIT
- HF `BAAI/bge-m3`：downloads 21,703,981、likes 3,109、license=mit
- `timescale/pgvectorscale` 0.9.0（2025-11-04），stars 3,054，license=PostgreSQL
- `qdrant/qdrant` v1.18.2（2026-06-04），stars 32,207，license=Apache-2.0
- `weaviate/weaviate` v1.38.0（2026-06-05），stars 16,322，license=BSD-3-Clause
- `milvus-io/milvus` v2.6.18（2026-06-05），stars 44,772，license=Apache-2.0
- `chroma-core/chroma` 1.5.9（2026-05-05），stars 28,421，license=Apache-2.0

**源码引用**：
- `/tmp/sub2api/backend/internal/handler/openai_embeddings.go:23`（Embeddings handler，证明有 `/v1/embeddings`）
- `/tmp/sub2api/backend/internal/server/routes/gateway.go:92`（路由注册 `gateway.POST("/embeddings")`）

**文档引用（file:line）**：
- `docs/ADR/ADR-0001-prolog-primary-db.md:15`（PG14+ 锁定）
- `docs/ADR/ADR-0002-xcdos-orm-prisma.md:13`（Prisma 5.x + multiSchema）
- `docs/ADR/ADR-0004-multi-tenant-schema-per-tenant.md:18`（schema-per-tenant 默认）
- `docs/ADR/ADR-0005-workflow-bullmq-outbox.md:19`（BullMQ + Outbox）
- `docs/ADR/ADR-0006-use-existing-not-rewrite.md:34`（license 红线）
- `docs/ADR/ADR-0008-llm-gateway-sub2api.md:19`（sub2api 独立部署不 fork）
- `docs/Prolog AgentTeam 智能交互工厂 - 需求清单与需求基线文档（V1.2）.md:53-56`（F-017~F-020）
- `docs/Prolog AgentTeam 智能交互工厂 - 数据库详细设计文档（DB Design V1.2）.md:64`（request_log 保留 7 天）
