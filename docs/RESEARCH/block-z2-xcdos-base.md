# Block Z-2：XCDOS 整套开源 base 对标

> 调研日期：2026-06-12
> 执行：Claude Code 直接调研（`CODEX_FALLBACK`：codex 中转 sub2.heekgoo.com 连续 2 次 503——ADR-0007 任务 + Z-2 任务均失败）
> 数据源：GitHub API 实拉 + LICENSE 原文核验

---

## 1. BI 看板层（XCDOS 数据看板/老板驾驶舱）

| 项目 | Star | License | 判定 |
|---|---:|---|---|
| **apache/superset** | 73,260 | **Apache-2.0**（纯，ASF 项目）| ✅ **唯一合规选** |
| metabase/metabase | 47,653 | **核心 AGPL** + enterprise 商业协议（LICENSE.txt 原文核验：非 enterprise 目录全 AGPL）| ❌ 红线 |

**推荐：Apache Superset。** 嵌入方式：Embedded Dashboard（iframe + guest token JWT），与 XCDOS JWT 体系对接；连 PostgreSQL 原生。
盲区（待 PoC）：guest token 与 ADR-0004 租户隔离的行级过滤（RLS filter per tenant）；Superset 自身多租户较弱，建议平台级单实例 + dataset 行级过滤。

## 2. 任务/项目管理域（决策→任务执行）

| 项目 | Star | License | 最近 push | 判定 |
|---|---:|---|---|---|
| makeplane/plane | 50,726 | **AGPL-3.0** | 活跃 | ❌ 红线 |
| go-vikunja/vikunja | 4,501 | **AGPL-3.0** | 活跃 | ❌ 红线 |
| mattermost-community/focalboard | 26,230 | NOASSERTION（Mattermost 双层）| 2026-05（社区弃管模式）| ❌ 弃管+协议不清 |
| taigaio/taiga-back | 834 | MPL-2.0 ✅ | 2026-05 | ⚠️ 合规但弱：星级低 + Python/Django 与 NestJS 不亲和 |

**判定：任务域全军覆没 → 自建。**
理由补强：XCDOS 任务模型本就特殊——任务由决策方案派生（planId 必填）、强制反馈闭环（每日反馈+不可篡改 revision）、与 Agent Run 联动。通用项目管理工具的任务模型（看板/迭代）不匹配，硬嵌反而打架。按 PRD 自研，套用 Block A（多租户）+ Block D（Outbox/乐观锁/反馈幂等）已有选型。

## 3. OKR 域（目标层）

不单列引入。XCDOS 目标模型 = "拆-推-评-算"闭环（目标→拆解→推演→评估→量化），与通用 OKR 工具（目标+关键结果打分）结构不同。目标域自研，OKR 工具仅作交互参考（无引入计划，无 License 风险）。

## 4. 决策模型域（拆-推-评-算核心）

**无现成开源。自研。** 这是 XCDOS 的产品差异化核心，本就不该外采。Forecast/DecisionCase 聚合按 ARD V2 设计，评审报告 P0-02/P0-03（Plan/Forecast 契约缺失）仍需在 Step 4 补齐。

## 5. 总装配建议

```
XCDOS = NestJS 自建核心（目标/决策/任务/反馈四域 + Agent Runtime）
      + Apache Superset 嵌入（数据看板，guest token JWT 对接）
      + Block A 多租户底座（nestjs-cls + panva/jose + 自研路由层）
      + Block D 可靠事件（Prisma outbox + BullMQ + node-idempotency）
```

与 Prolog 混合方案（ADR-0007）同构：**自建业务核心 + 合规开源件做子能力嵌入**。

## 6. 回写清单

| 文档 | 改动 |
|---|---|
| `XCDOS_TDD_V1` §二 技术栈选型 | 增 "BI 层 = Apache Superset 嵌入（Embedded Dashboard + guest token）"，删自研看板若有 |
| `XCDOS_TDD_V1` §架构分层 | Client 层增 Superset iframe 嵌入边界；BFF 增 guest token 签发端点 |
| `XCDOS_PRD_V1` 看板模块 | 标注实现载体 = Superset，验收标准补"租户数据隔离过滤" |
| `XCDOS_部署/回滚文档` | 增 Superset 容器资源水位 + 升级回滚策略 |
| `docs/ADR/` 新增 ADR-0008 | "XCDOS BI 层采用 Superset 嵌入"（可与本文件互引） |

## 7. 调研证据

- GitHub API 实拉 7 仓（superset/metabase/plane/vikunja/focalboard/taiga/+z1 四仓复用）
- Metabase LICENSE.txt 原文逐段核验（AGPL 坐实）
- `CODEX_FALLBACK` 记录：codex 中转（sub2.heekgoo.com）连续 503 × 2，按契约转直接执行
- 盲区：Superset guest token 租户级 RLS 过滤需 PoC；Superset 离线/内网部署资源水位需实测
