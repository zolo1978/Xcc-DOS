# 工具层选型卡：Codex Bridge 替代方案

> 调研日期：2026-06-11
> 调研执行：Claude Code 直接调研（WebSearch + GitHub API），**未经过 codex-bridge-agent**
> 关联 ADR：ADR-0006（能用现成就不要自己造）
> 触发背景：原 `codex-bridge-agent` 在 Block B / Block C（两次）/ 本工具调研 agent 中累计失败 ≥ 4 次，远超"连续两次"阈值，按工作流契约 escape hatch 转为 Claude Code 直接执行，记 `CODEX_FALLBACK`。

---

## 1. 旧 bridge 的失败根因

`codex-bridge-agent` 是 subagent，通过 shell 调用 `codex exec` 子进程并手动管理：
- 进程生命周期（多并发即被 ChatGPT 端回收，单串行也在 2-3 次调用后死亡）
- 完成通知（频繁漏推，需主动 `ls` 轮询产物）
- 任务包格式（需写极细，回报易撑爆主上下文）

结论：问题不在并发，而在"subagent 包 `codex exec`"这个架构本身不可靠。

---

## 2. 候选清单（GitHub API 实拉，2026-06-11）

| 仓库 | Star | License | 最近 push | 语言 | 判定 |
|---|---:|---|---|---|---|
| **原生 `codex mcp-server`** | N/A（OpenAI 官方，随 codex-cli 0.139.0 内置）| OpenAI 官方 | 随 CLI 发布 | Rust | ✅ **主选** |
| SeemSeam/claude_codex_bridge | 2944 | NOASSERTION | 2026-06-11 | Python | ❌ License 不明确（红线一票否决）+ tmux 多智能体团队，过重 |
| tuannvm/codex-mcp-server | 487 | NONE | 2026-05-25 | TS | ❌ 无 License（红线） |
| cexll/codex-mcp-server | 176 | MIT | 2026-06-06 | TS | ✅ 合规活跃，**备选** |
| ZhangYiqun018/claude-codex-bridge | 10 | MIT | 2026-03-29 | Python | star 太低 |
| Dunqing/claude-codex-bridge | 3 | NONE | 2026-02-11 | TS | ❌ |
| jackcongmac/claude-codex-bridge | 1 | MIT | 2026-06-11 | Python | 太新无验证 |

---

## 3. 推荐方案

### 主选：原生 `codex mcp-server`

**理由**（对齐 ADR-0006 优先级"直接用 > 二开 > fork > 自研"）：
1. **OpenAI 官方内置**，随 codex-cli 0.139.0 分发，无需安装第三方代码
2. **零 License 风险**（不引入任何第三方仓库）
3. **零维护**（随 codex CLI 升级）
4. **根治旧 bridge 病根**：Claude Code 作为标准 MCP client 直接管持久 stdio 连接，无 subagent 中间层 → 不会被 kill、不会漏通知
5. 复用现有 ChatGPT 账户登录态（与 `codex exec` 同源）

### 备选：cexll/codex-mcp-server（MIT, 176★）

仅当原生 `codex mcp-server` 暴露的工具能力不足（如缺少特定 session 控制）时启用。MIT 合规、TypeScript、活跃。

### 一票否决

- SeemSeam（NOASSERTION）、tuannvm（NONE）、Dunqing（NONE）：License 红线。

---

## 4. 安装与启用步骤

已执行（项目级，写入 `.mcp.json`）：

```bash
claude mcp add codex -s project -- codex mcp-server
```

生成配置：

```json
{
  "mcpServers": {
    "codex": { "type": "stdio", "command": "codex", "args": ["mcp-server"], "env": {} }
  }
}
```

**待用户操作**：项目级 MCP server 首次需批准（当前状态 `⏸ Pending approval`）。批准并重连后，`mcp__codex__*` 工具出现，即可直接调用，彻底退役 `codex-bridge-agent`。

---

## 5. 迁移影响

| 项 | 旧（codex-bridge-agent） | 新（原生 codex MCP server） |
|---|---|---|
| 调用方式 | spawn subagent → shell `codex exec` | Claude Code 直接调 `mcp__codex__*` 工具 |
| 并发风险 | 高（被 kill） | 无（持久 stdio 连接） |
| 通知 | 常漏 | MCP 同步返回，无需轮询 |
| 上下文占用 | 任务包 + 回报易爆 | 单次工具调用，可控 |
| 退役动作 | —— | 后续 Block 全部改用 codex MCP，停用 codex-bridge-agent |

---

## 6. 后续动作

1. 用户批准 codex MCP server（`⏸ Pending approval` → 连接）
2. 重连后用 `mcp__codex__*` 重跑：Block Z（产品整套 base 对标：Dify / FastGPT 等）
3. 原 10 原子块路线（Block B/C/E/F/H/I/J）按 ADR-0006 + 整套 base 战略**作废**
4. `/tmp` 下 Block C 半成品（codex-c1/c2-out）丢弃
