# Prolog AgentTeam 智能交互工厂 \- 数据库详细设计文档（DB Design V1\.2）

## 一、文档概述

### 1\.1 文档基础信息

|字段|内容|
|---|---|
|文档名称|Prolog AgentTeam 智能交互工厂 数据库详细设计文档|
|文档版本|V1\.2|
|对应迭代|V1\.2 全能力投产迭代|
|前置依赖文档|《PRD V1\.2》《需求基线 V1\.2》《总体技术设计文档 TDD V1\.2》|
|适用场景|数据库建表、开发编码、DBA评审、数据迁移、运维归档、合规审计|
|设计状态|基线锁定、正式投产版|

### 1\.2 设计目标

遵循字节跳动数据库开发规范，围绕**多租户强隔离、高并发读写、低延迟、可扩展、可审计、合规可控**核心目标设计。适配系统规则调度、会话管理、自进化反哺、运维管控、日志追溯全业务场景，支撑公网集群、内网单机、边缘离线三种部署模式，保障数据一致性、安全性、可运维性。

### 1\.3 设计约束与规范

- **数据库选型**：生产环境优先 MySQL 8\.0 / PostgreSQL 14\+，InnoDB 存储引擎，UTF8MB4 字符集，支持所有emoji及特殊字符存储

- **通用字段规范**：所有业务表强制携带 tenant\_id、create\_time、update\_time、delete\_flag 四大通用字段，用于租户隔离、数据溯源、逻辑删除

- **主键规范**：统一采用自增主键\+雪花ID混合模式，核心业务表使用雪花ID，避免自增ID暴露业务量级

- **索引规范**：高频查询场景建立联合索引，杜绝冗余索引、无效索引，禁止大字段建立索引

- **删除规范**：全部采用逻辑删除，禁止物理删除业务数据，保障数据可追溯、可恢复

- **脱敏规范**：隐私数据（手机号、身份证、地址等）数据库层面脱敏存储，无明文留存

- **字段命名**：小写蛇形命名，语义清晰、无歧义，所有字段、表名必须配备详细注释

## 二、整体数据架构设计

### 2\.1 数据分层架构

整体分为四层数据存储体系，各司其职、解耦存储，避免单表膨胀、冷热数据混杂

1. **核心业务数据层**：租户、用户、权限、规则、同义词、会话核心业务数据，高频读写、高一致性要求

2. **日志行为数据层**：请求日志、兜底日志、操作审计日志，海量写入、低频查询

3. **自进化任务数据层**：聚类任务、规则生成记录、版本快照、审核记录，定时任务驱动

4. **缓存临时数据层**：Redis 承载会话状态、热点规则、限流计数、临时缓存数据，提升并发性能

### 2\.2 多租户数据隔离方案

兼容双隔离模式，一键切换，适配不同合规与运营场景

- **共享库行级隔离（默认）**：所有租户共用一套数据库实例，通过 tenant\_id 字段做行级隔离，低成本、易运维，适配中小规模SaaS场景

- **独立物理库隔离（高阶）**：单租户独立数据库实例，完全物理隔离，满足金融、政务等高合规、高安全场景

全链路强制租户条件拦截，所有CRUD操作必须携带 tenant\_id，杜绝跨租户数据串扰、越权查询。

### 2\.3 数据生命周期规范

- **实时业务数据**：永久保留，仅逻辑删除，支持手动恢复

- **实时请求日志**：保留7天，到期自动归档至冷存储

- **归档日志数据**：冷存储保留90天，到期自动物理清理

- **规则版本快照**：单租户最大保留50份，超出自动清理最旧版本

- **过期会话数据**：会话超时24小时后自动物理清理，释放存储资源

## 三、全局通用字段定义

所有业务数据表强制复用以下通用字段，统一规范、统一查询条件

|字段名|数据类型|是否必填|默认值|字段说明|
|---|---|---|---|---|
|tenant\_id|bigint|是|0|租户ID，0代表系统超级管理员，所有业务数据隔离唯一标识|
|create\_time|datetime|是|CURRENT\_TIMESTAMP|数据创建时间，自动生成|
|update\_time|datetime|是|CURRENT\_TIMESTAMP ON UPDATE CURRENT\_TIMESTAMP|数据更新时间，自动更新|
|delete\_flag|tinyint|是|0|逻辑删除标识：0\-正常，1\-已删除|

## 四、核心数据表详细设计

### 4\.1 租户信息表（sys\_tenant）

存储所有租户基础信息，SaaS多租户核心基础表

|字段名|数据类型|长度|是否主键|是否为空|默认值|字段说明|
|---|---|---|---|---|---|---|
|id|bigint|\-|是|否|雪花ID|租户唯一主键ID|
|tenant\_name|varchar|64|否|否|\-|租户名称|
|tenant\_code|varchar|32|否|否|\-|租户唯一编码，全局唯一|
|isolate\_type|tinyint|\-|否|否|1|隔离模式：1\-行级共享，2\-物理独立库|
|status|tinyint|\-|否|否|1|租户状态：0\-禁用，1\-正常|
|expire\_time|datetime|\-|否|是|null|租户过期时间，null为永久有效|
|contact\_person|varchar|32|否|是|null|租户联系人|
|contact\_phone|varchar|16|否|是|null|联系人电话，脱敏存储|
|remark|varchar|256|否|是|null|租户备注信息|
|tenant\_id|bigint|\-|否|否|0|通用租户字段，系统级数据|
|create\_time|datetime|\-|否|否|CURRENT\_TIMESTAMP|创建时间|
|update\_time|datetime|\-|否|否|CURRENT\_TIMESTAMP ON UPDATE CURRENT\_TIMESTAMP|更新时间|
|delete\_flag|tinyint|\-|否|否|0|逻辑删除标识|

**索引设计**：唯一索引\(tenant\_code\)、普通索引\(status、expire\_time\)

### 4\.2 系统用户表（sys\_user）

存储后台运维、管理员账号信息，关联租户权限体系

|字段名|数据类型|长度|是否主键|是否为空|默认值|字段说明|
|---|---|---|---|---|---|---|
|id|bigint|\-|是|否|雪花ID|用户主键ID|
|username|varchar|32|否|否|\-|登录账号，租户内唯一|
|password|varchar|128|否|否|\-|加密密码，MD5\+盐值加密，不存储明文|
|nickname|varchar|32|否|否|\-|用户昵称|
|role\_level|tinyint|\-|否|否|1|角色等级：1\-只读，2\-运营，3\-管理员|
|status|tinyint|\-|否|否|1|账号状态：0\-禁用，1\-正常|
|last\_login\_time|datetime|\-|否|是|null|最后登录时间|
|tenant\_id|bigint|\-|否|否|0|所属租户ID，0为超级管理员|
|create\_time|datetime|\-|否|否|CURRENT\_TIMESTAMP|创建时间|
|update\_time|datetime|\-|否|否|CURRENT\_TIMESTAMP ON UPDATE CURRENT\_TIMESTAMP|更新时间|
|delete\_flag|tinyint|\-|否|否|0|逻辑删除标识|

**索引设计**：联合唯一索引\(tenant\_id、username\)、普通索引\(status、role\_level\)

### 4\.3 Prolog规则配置表（rule\_prolog）

存储所有业务Prolog规则、流程节点、状态机配置，系统核心业务表

|字段名|数据类型|长度|是否主键|是否为空|默认值|字段说明|
|---|---|---|---|---|---|---|
|id|bigint|\-|是|否|雪花ID|规则唯一ID|
|rule\_name|varchar|64|否|否|\-|规则名称，业务语义化命名|
|rule\_code|varchar|64|否|否|\-|规则唯一编码，全局唯一|
|rule\_content|text|\-|否|否|\-|Prolog规则源码内容|
|rule\_type|tinyint|\-|否|否|1|规则类型：1\-流程规则，2\-校验规则，3\-路由规则|
|parent\_id|bigint|\-|否|否|0|父规则ID，0为顶级规则|
|status|tinyint|\-|否|否|0|规则状态：0\-未生效，1\-已生效，2\-灰度中|
|version|int|\-|否|否|1|规则版本号，用于热更新、回滚|
|is\_auto\_gen|tinyint|\-|否|否|0|是否自动生成：0\-人工创建，1\-系统自进化生成|
|gray\_rate|int|\-|否|否|100|灰度放量比例，0\-100|
|remark|varchar|512|否|是|null|规则业务说明|
|tenant\_id|bigint|\-|否|否|0|所属租户ID|
|create\_time|datetime|\-|否|否|CURRENT\_TIMESTAMP|创建时间|
|update\_time|datetime|\-|否|否|CURRENT\_TIMESTAMP ON UPDATE CURRENT\_TIMESTAMP|更新时间|
|delete\_flag|tinyint|\-|否|否|0|逻辑删除标识|

**索引设计**：联合唯一索引\(tenant\_id、rule\_code\)、联合索引\(status、rule\_type、version\)、普通索引\(parent\_id\)

### 4\.4 规则版本快照表（rule\_snapshot）

存储规则历史版本快照，支撑一键回滚、版本追溯、灰度发布

|字段名|数据类型|长度|是否主键|是否为空|默认值|字段说明|
|---|---|---|---|---|---|---|
|id|bigint|\-|是|否|雪花ID|快照主键ID|
|rule\_id|bigint|\-|否|否|\-|关联规则ID|
|rule\_content|text|\-|否|否|\-|快照版本规则源码|
|version|int|\-|否|否|1|当前快照对应版本号|
|change\_desc|varchar|512|否|是|null|版本变更说明|
|create\_user|bigint|\-|否|否|0|创建人ID，0为系统自动生成|
|tenant\_id|bigint|\-|否|否|0|所属租户ID|
|create\_time|datetime|\-|否|否|CURRENT\_TIMESTAMP|快照生成时间|
|delete\_flag|tinyint|\-|否|否|0|逻辑删除标识|

**索引设计**：联合索引\(tenant\_id、rule\_id、version\)、普通索引\(create\_time\)

### 4\.5 同义词配置表（rule\_synonym）

存储用户输入同义词映射关系，支撑输入预处理、意图匹配

|字段名|数据类型|长度|是否主键|是否为空|默认值|字段说明|
|---|---|---|---|---|---|---|
|id|bigint|\-|是|否|雪花ID|主键ID|
|origin\_word|varchar|64|否|否|\-|原始标准词|
|synonym\_word|varchar|64|否|否|\-|同义词、用户口语化输入|
|priority|int|\-|否|否|50|匹配优先级，数值越大优先级越高|
|status|tinyint|\-|否|否|1|状态：0\-禁用，1\-正常|
|tenant\_id|bigint|\-|否|否|0|所属租户ID|
|create\_time|datetime|\-|否|否|CURRENT\_TIMESTAMP|创建时间|
|update\_time|datetime|\-|否|否|CURRENT\_TIMESTAMP ON UPDATE CURRENT\_TIMESTAMP|更新时间|
|delete\_flag|tinyint|\-|否|否|0|逻辑删除标识|

**索引设计**：联合唯一索引\(tenant\_id、origin\_word、synonym\_word\)、普通索引\(status、priority\)

### 4\.6 用户会话表（user\_session）

存储用户在线会话状态、上下文信息，支撑会话续连、状态恢复、超时销毁

|字段名|数据类型|长度|是否主键|是否为空|默认值|字段说明|
|---|---|---|---|---|---|---|
|id|bigint|\-|是|否|雪花ID|会话主键ID|
|session\_id|varchar|64|否|否|\-|全局唯一会话ID，UUID生成|
|user\_ip|varchar|32|否|否|\-|用户登录IP|
|current\_state|varchar|64|否|否|init|当前会话状态，对应状态机节点|
|context\_data|text|\-|否|是|null|会话上下文数据，JSON格式存储|
|last\_active\_time|datetime|\-|否|否|CURRENT\_TIMESTAMP|最后活跃时间，用于超时判断|
|expire\_time|datetime|\-|否|否|\-|会话过期时间，默认30分钟有效期|
|session\_status|tinyint|\-|否|否|1|会话状态：1\-正常，2\-超时，3\-主动退出|
|tenant\_id|bigint|\-|否|否|0|所属租户ID|
|create\_time|datetime|\-|否|否|CURRENT\_TIMESTAMP|会话创建时间|
|delete\_flag|tinyint|\-|否|否|0|逻辑删除标识|

**索引设计**：唯一索引\(session\_id\)、联合索引\(tenant\_id、session\_status、expire\_time\)、普通索引\(last\_active\_time\)

### 4\.7 请求日志表（request\_log）

存储全量用户请求日志，用于问题排查、数据分析、自进化样本采集

|字段名|数据类型|长度|是否主键|是否为空|默认值|字段说明|
|---|---|---|---|---|---|---|
|id|bigint|\-|是|否|雪花ID|日志主键ID|

> （注：文档部分内容可能由 AI 生成）
