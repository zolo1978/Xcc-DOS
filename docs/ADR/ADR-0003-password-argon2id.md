# ADR-0003：密码方案统一为 Argon2id

- **Status**：Accepted
- **Date**：2026-06-11
- **Decision Makers**：安全负责人 / 技术负责人

## Context

评审报告 P0-07 指出：

- Prolog 总体方案与数据库设计（DB Design V1.2 第 115 行）规定 `password` 使用 MD5+盐。
- 联合安全文档又规定 bcrypt cost=12。

基线自相矛盾。**MD5+盐不适合密码存储**（GPU/ASIC 每秒可计算数十亿次 MD5，盐无法阻止单点击破）。

## Decision

XCDOS、Prolog 双系统统一为 **Argon2id**，参数如下：

| 参数 | 值 | 说明 |
|---|---|---|
| memoryCost | 64 MiB (2^16 KiB) | 抵抗 GPU 内存带宽攻击 |
| timeCost | 3 | 单次校验 ~50ms 量级 |
| parallelism | 4 | 多核校验 |
| saltLength | 16 字节 | 加密随机 |
| hashLength | 32 字节 | |

实现建议：
- Node.js：`argon2` 包（原生 binding）
- Java：`de.mkammerer:argon2-jvm`

数据库字段：`password_hash VARCHAR(255) NOT NULL`，存储 Argon2 标准编码（`$argon2id$v=19$m=65536,t=3,p=4$...$...`）。

## Consequences

### Positive

- 符合 OWASP ASVS L2 推荐与 PHC（Password Hashing Competition）2015 获胜方案。
- 抵抗 GPU/ASIC 暴力破解；内存硬性参数显著提高离线破解成本。
- 标准编码自带算法、版本与参数，未来调参不破坏历史哈希。

### Negative

- 单次校验成本 ~50ms（参数下），登录接口必须叠加并发限流（建议租户 + IP 双维度滑动窗口）。
- 历史 MD5 密码无法升级哈希（明文不可逆），需要在首次登录时强制改密；改密期间 MD5 校验通道临时保留，加固限流与告警。
- 服务器 CPU 与内存预算需在 Step 2 容量规划阶段重新核算。

## Alternatives Considered

| 方案 | 结论 | 理由 |
|---|---|---|
| bcrypt cost=12 | 放弃 | 密码长度上限 72 字节，未来支持中文长 passphrase 时有截断风险；非内存硬 |
| scrypt | 放弃 | 社区采用度不如 Argon2id；参数调优经验薄 |
| MD5+盐 | 拒绝 | 不满足密码存储要求，禁止用于任何新写入 |

## Related

- 评审报告：P0-07
- 文档行号：`Prolog AgentTeam - 数据库详细设计文档（DB Design V1.2）.md:115`
- 后续动作：
  - Prolog DB Design 字段类型改写
  - 联合安全文档统一为 Argon2id 参数表
  - 登录接口补充限流（关联 P1-14）
  - 历史 MD5 用户首次登录强制改密流程
