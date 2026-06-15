# Xcc-DOS

**企业决策与执行操作系统** (Enterprise Decision & Execution Operating System)

基于"拆-推-评-算"模型的智能决策闭环：目标 → 问题 → 决策方案 → 执行任务 → 强制反馈 → 数据看板。

## 技术栈

- **前端**: React + Next.js + TypeScript, Arco Design, 深蓝三色 Design Token
- **后端**: NestJS + TypeScript, DDD + CQRS Lite
- **数据**: PostgreSQL, Redis + BullMQ
- **AI Agent**: Agent Runtime + Tool Router + Trace

## 项目结构

```
├── docs/                # 设计文档基线
│   ├── XCDOS_PRD_V1     # 产品需求文档
│   ├── XCDOS_TDD_V1     # 技术设计文档
│   ├── XCDOS_ARD_V2     # 领域架构 (DDD + Event Storming)
│   ├── XCDOS_UI_Spec    # 前端 UI 设计规范
│   └── Prolog_*         # Prolog AgentTeam 智能交互工厂
├── CLAUDE.md            # Claude Code 操作指南
├── LICENSE              # Apache-2.0
└── README.md
```

## 文档索引

详细设计文档见 `docs/` 目录：

| 文档 | 说明 |
|------|------|
| `XCDOS_PRD_V1_*.html` | 产品需求文档 V1.0 |
| `XCDOS_TDD_V1_*.html` | 技术设计文档 V1.0 |
| `XCDOS_ARD_V2_*.html` | 领域模型、DDD 聚合、Agent Runtime、ER、Event Storming V2.0 |
| `XCDOS_深蓝三色专业版_*.html` | 前端 UI 设计规范 |
| `Prolog AgentTeam 智能交互工厂 - 总体技术方案（V1.2）.md` | Prolog 系统总体技术方案 |
| `Prolog AgentTeam 智能交互工厂 - 数据库详细设计文档（DB Design V1.2）.md` | Prolog 数据库设计 |
| `柔电科技内部研发规范*.md` | 内部研发规范、产研交付流程、上线标准 |

## 开发状态

设计阶段，代码开发尚未启动。当前仓库存储完整的设计文档基线。

## 本地一键起

后端与前端都已补齐容器化启动文件，可直接在仓库根目录执行 `docker compose up --build`。启动后 API 默认监听 `http://localhost:3000/api`，Web 默认监听 `http://localhost:3001`，Compose 内会自动拉起 PostgreSQL、Redis，并在 API 启动时执行 `prisma migrate deploy`。

如果继续使用宿主机模式，保持根目录 `.env` 中的 `DATABASE_URL`、`REDIS_URL`、`JWT_SECRET` 可用后，后端执行 `npm run prisma:generate && npm run build && npm run start`，前端在 `web/` 目录执行 `npm run build && npm run start -- --port 3001` 即可。
