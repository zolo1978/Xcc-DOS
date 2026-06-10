# Prolog AgentTeam 智能交互工厂 - 规则引擎编写规范（V1.2）

## 一、文档说明

| 属性 | 内容 |
|------|------|
| 文档名称 | Prolog AgentTeam 智能交互工厂 规则引擎编写规范 |
| 版本 | V1.2 |
| 编写人 | 规则引擎负责人 |
| 审核人 | 架构师 / 技术负责人 |
| 最后更新 | 2026-06-11 |
| 前置依赖 | Prolog 总体技术方案 V1.2 (ch.4.2), DB 设计 V1.2 (rule_prolog 表) |

---

## 二、Prolog 语法约束

### 2.1 基本结构

每条 Prolog 规则必须包含三个部分：

```prolog
% === 规则声明 ===
% @rule_code: RULE_XXX_001
% @rule_name: 规则名称（中文）
% @version: 1
% @priority: 100
% @author: 作者名
% @description: 规则的业务含义说明

% === 条件部分 ===
条件_1(变量) :-
    前提谓词1(变量, 参数),
    前提谓词2(变量, 参数).

% === 结论部分 ===
结果谓词(变量) :-
    条件_1(变量),
    动作谓词(变量, 结果).
```

### 2.2 命名规范

| 元素 | 规范 | 示例 |
|------|------|------|
| 规则编码 | `RULE_{模块}_{序号}` | `RULE_TENANT_001`, `RULE_SESSION_005` |
| 谓词名 | snake_case，英文 | `validate_tenant_status`, `match_user_intent` |
| 变量名 | 小写英文，含义清晰 | `TenantId`, `UserInput`, `SessionState` |
| 常量 | 大写 + 下划线 | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT` |

### 2.3 必须包含的元数据注释

每条规则文件头部必须包含：

```prolog
% @rule_code:      唯一规则编码（必填）
% @rule_name:      规则中文名称（必填）
% @version:         整数，递增（必填）
% @priority:        0-1000，越大越优先（必填）
% @author:          编写人（必填）
% @description:     规则业务含义（必填）
% @dependencies:    依赖的其他规则编码，无则填 none（必填）
% @trigger_condition: 触发条件说明（必填）
% @fallback_rule:   兜底规则编码，无则填 none（必填）
```

---

## 三、禁止写法

### 3.1 死循环（CRITICAL）

```prolog
% ❌ 禁止：自引用导致死循环
bad_loop(X) :- bad_loop(X).

% ❌ 禁止：间接死循环
a(X) :- b(X).
b(X) :- a(X).

% ✅ 正确：有终止条件
safe_recursion(X, 0) :- base_case(X).
safe_recursion(X, N) :- N > 0, step(X, X1), N1 is N - 1, safe_recursion(X1, N1).
```

### 3.2 无效规则

```prolog
% ❌ 禁止：永远为真的前提（通配规则）
catch_all(_) :- true.

% ❌ 禁止：引用不存在的谓词
broken_rule(X) :- undefined_predicate(X).

% ❌ 禁止：未声明依赖的外部数据源
implicit_dep(X) :- call_external_api(X).
```

### 3.3 性能陷阱

```prolog
% ❌ 禁止：全表扫描式查询
bad_search(X) :- tenant(T), user(T, X).  % 无索引条件

% ❌ 禁止：深度递归 > 100 层
% ✅ 正确：限制递归深度，或以迭代替代

% ❌ 禁止：规则文件超过 500 行
% ✅ 正确：拆分为多个子规则，通过 rule_code 组合
```

---

## 四、规则编写最佳实践

### 4.1 规则拆分原则

- **单一职责**：一条规则只处理一种业务场景
- **原子化**：复杂逻辑拆分为多个小规则，通过优先级 + 组合模式串联
- **分层设计**：
  - L1: 意图识别规则（将用户输入归类）
  - L2: 调度规则（根据意图 + 上下文选择处理器）
  - L3: 执行规则（具体业务逻辑）

### 4.2 规则组合模式

```prolog
% 父规则：组合子规则
parent_rule(Input, Output) :-
    rule_child_1(Input, Intermediate1),   % 意图识别
    rule_child_2(Intermediate1, Intermediate2), % 上下文补充
    rule_child_3(Intermediate2, Output).   % 响应生成
```

### 4.3 兜底策略

每条场景链路必须配备兜底规则（优先级最低）：

```prolog
% @rule_code: RULE_FALLBACK_001
% @priority: 0
% @description: 通用兜底——当所有具体规则未命中时返回默认响应
fallback_response(UserInput, Response) :-
    Response = "抱歉，我暂时无法理解您的问题。请尝试换个方式描述，或联系管理员。"
```

---

## 五、规则版本管理

### 5.1 版本号规范

- 格式：正整数，从 1 开始递增
- 每次修改规则内容（包括元数据、条件、结论）→ version + 1
- 旧版本自动存入 `rule_snapshot` 表
- 每条规则的版本历史可通过 `GET /api/v1/rules/:id/versions` 查询

### 5.2 灰度发布

- 新规则上线默认 `gray_rate = 0`（不生效，仅记录匹配日志）
- 逐步提升：0 → 10% → 30% → 50% → 100%
- 每个灰度阶段观察 ≥ 4 小时（含一个业务高峰）
- 灰度期间旧版本规则继续运行
- 灰度期异常 → 立即回滚至 0

### 5.3 回滚

- 规则任意历史版本均可回滚
- 回滚操作：`POST /api/v1/rules/:id/rollback { version: N }`
- 回滚前自动保存当前版本快照
- 回滚后 version = max(version) + 1（不回退版本号）

---

## 六、规则测试要求

### 6.1 单规则测试（开发阶段必做）

- 正向用例：预期命中的输入 → 规则应正确匹配并返回预期结果
- 负向用例：预期不命中的输入 → 规则应正确跳过
- 边界用例：输入为空、超长、特殊字符 → 规则不崩溃
- 性能用例：单条规则推理耗时 < 50ms

### 6.2 规则组合测试（集成阶段必做）

- 多条规则按优先级竞争 → 优先级高的先匹配
- 父规则组合子规则 → 中间数据正确传递
- 兜底规则 → 无规则命中时正确触发

---

## 七、规则安全约束

1. **禁止文件系统访问**：规则引擎运行在沙箱环境，禁止 read/write 文件
2. **禁止网络调用**：规则内不可发起 HTTP/TCP 请求
3. **禁止系统命令**：不可执行 shell 命令
4. **禁止无限循环**：运行时限制单次推理最大步数 1000 步，超出强制终止
5. **禁止操作其他租户数据**：规则引擎的 fact base 仅加载当前租户数据

---

## 八、规则审核流程

```
编写规则 → 自测（单规则 + 组合） → 提交审核
  → 规则负责人 Review（语法/性能/安全）
  → 测试环境部署（gray_rate=0，采集匹配日志）
  → 验证匹配准确率 ≥ 95%
  → 灰度上线 → 全量
```

审核检查清单：
- [ ] 元数据注释完整
- [ ] 无禁止写法（死循环/无效规则/性能陷阱）
- [ ] 有兜底规则
- [ ] 正向/负向/边界测试通过
- [ ] 性能达标（< 50ms）
- [ ] 无跨租户数据引用
