# 柔电科技 Git 分支与提交规范 V1.0

## 一、分支策略

采用 **Trunk-based Development**（主干开发）结合 Feature Branch。

```
main          ← 生产就绪代码，每次合并 = 一次上线
  ├── feat/xxx   ← 功能分支 (从 main 拉出，合并回 main)
  ├── fix/xxx    ← Bug 修复分支
  ├── hotfix/xxx ← 紧急修复 (从 main 拉出，直接合并 main + cherry-pick 到开发分支)
  └── chore/xxx  ← 配置/依赖/工具类变更
```

## 二、分支命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能 | `feat/<模块>-<简述>` | `feat/goal-breakdown-tree` |
| 修复 | `fix/<模块>-<简述>` | `fix/task-delayed-status` |
| 紧急 | `hotfix/<简述>` | `hotfix/db-connection-leak` |
| 杂项 | `chore/<简述>` | `chore/upgrade-nestjs-v10` |

- 全小写，单词用 `-` 分隔
- 简述部分 ≤ 5 个单词

## 三、Commit 规范

### 3.1 格式

```
<type>: <subject>

<optional body>
```

Type: `feat` | `fix` | `refactor` | `docs` | `test` | `chore` | `perf` | `ci`

### 3.2 示例

```
feat: 目标拆解支持多级树形结构

- 新增 GoalTree 递归查询
- 前端 GoalTree 组件支持展开/折叠
- 数据库增加 parent_id 索引
```

```
fix: 任务延期检测未处理时区偏移

根因：due_time 与 NOW() 对比时未考虑 UTC+8
修复：统一使用 TIMESTAMPTZ + AT TIME ZONE 'Asia/Shanghai'
```

```
chore: 升级 NestJS 至 v10.4
```

### 3.3 规则

- Subject ≤ 72 字符
- Subject 用中文（业务相关）/ 英文（纯技术）
- Body 解释 What & Why（非 How）
- 每条 Commit 是一个最小的逻辑变更单元
- 禁止 `WIP` / `fix bug` / `update` 等无意义 message

---

## 四、合并策略

- Feature → main：Squash Merge（保持 main 历史干净）
- Hotfix → main：Merge Commit（保留完整上下文）
- 合并前必须通过 CI（lint + test + build）

---

## 五、代码评审

- 所有合并至 main 的 PR 必须 ≥ 1 人 Approve
- 关键模块（认证/权限/支付）必须 ≥ 2 人 Approve
- PR 描述含：变更摘要、测试说明、影响范围、相关 Issue 链接
