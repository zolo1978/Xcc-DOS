# ADR-0007：Prolog 采用混合方案 — 业务底座自建 + Langflow 子能力嵌入

- **Status**：Accepted
- **Date**：2026-06-12
- **Decision Makers**：项目负责人 / 技术负责人

## Context

Block Z-1 整套 base 对标调研（block-z1a-license.md + block-z1b-matrix.md）结论：

1. Dify / FastGPT / Bisheng 因"多租户 SaaS 触发商业授权"附加条款一票否决（本项目即多租户 SaaS）。
2. Botpress 自托管仅 v12（AGPL 红线），现行主仓为 Cloud 工具链，出局。
3. 存活者 Langflow / RAGFlow / Flowise 均为 LLM-flow 工具，对 Prolog 六大模块（租户权限 / 规则配置 / 同义词 / 会话 / 审计 / 自进化）覆盖度为零或部分，无候选覆盖 ≥2 个核心模块。
4. "整套 base 二开"路线对规则调度型 SaaS 不成立。

## Decision

Prolog AgentTeam 采用混合方案：

1. **业务底座（六大模块）**：Spring Boot 自建。多租户套用 Block A 选型（Hibernate MultiTenantConnectionProvider + Flyway per-tenant），可靠事件套用 Block D 选型（Spring Modulith Events + Hibernate @Version）。
2. **LLM 编排子系统**：嵌入 **Langflow**（MIT，149k+ star，每 flow 暴露 API/MCP），独立容器部署，经 Spring 网关调用，不与业务库混储。
3. **RAG 子能力（可选）**：RAGFlow（Apache-2.0），按需引入。
4. **备选嵌入件**：Flowise（开源部分 Apache-2.0；enterprise 目录商业协议禁用，引用前法务复核边界）。

## Consequences

### Positive
- License 零风险（MIT/Apache-2.0 纯协议）。
- 业务核心自主可控，LLM 能力借力 149k star 社区。
- Langflow flow 即 API/MCP，与 Spring 网关天然对接。

### Negative
- Langflow 无原生多租户，租户隔离策略需自行设计（每租户独立 flow 命名空间或独立实例，待 PoC）。
- 边缘离线部署（E-004）中 Langflow 离线包可行性未验证，需 PoC。
- 自建六模块工作量不因引入 base 而减少（约 110-130 人日，见 z1b 矩阵）。

## Alternatives Considered

| 方案 | 结论 | 理由 |
|---|---|---|
| Dify 整套二开 | 拒绝 | 附加条款禁多租户 SaaS |
| Flowise 整套二开 | 拒绝 | 多租户/RBAC/SSO 全锁 enterprise 商业目录 |
| 全自研（含 LLM 编排）| 拒绝 | 违反 ADR-0006，LLM 编排重复造轮子 |

## Related

- 证据：docs/RESEARCH/block-z1a-license.md、docs/RESEARCH/block-z1b-matrix.md
- 关联 ADR：ADR-0001（PG）、ADR-0004（多租户）、ADR-0005（Outbox）、ADR-0006（现成优先）
- 后续：Langflow 多租户隔离 PoC、边缘离线 PoC、回写 Prolog 总体方案 §二/§三 与部署文档
