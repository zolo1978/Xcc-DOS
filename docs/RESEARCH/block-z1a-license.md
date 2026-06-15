# Z-1a License 红线初筛

时间：2026-06-12  
标准：ADR-0006。Apache-2.0 / MIT / BSD / MPL-2.0 直通；AGPL / GPL / 未声明否决；附加条款禁止多租户 SaaS 运营为本项目致命否决。

> Star 与最近提交为快查口径，来源优先 GitHub 仓库页 / GitHub API / LICENSE / README。

| 平台 | GitHub URL | Star | 最近提交 | License SPDX | 附加条款要点 | 红线判定 |
|---|---:|---:|---|---|---|---|
| Dify | https://github.com/langgenius/dify | 约 117k | 2026-06 | Apache-2.0 + 附加条款 | Dify Open Source License 基于 Apache-2.0，但附加限制要求生产界面保留 Dify logo / copyright；多租户 SaaS 场景触发商业授权；不得用作与 Dify 云服务竞争的托管服务。 | ❌ 一票否决 |
| FastGPT | https://github.com/labring/FastGPT | 约 26k | 2026-06 | Apache-2.0 + 附加条款 | FastGPT License 基于 Apache-2.0，但商业版功能、品牌/版权标识移除、面向第三方提供 SaaS / 多租户运营等触发商业授权；需保留 FastGPT 标识。 | ❌ 一票否决 |
| Flowise | https://github.com/FlowiseAI/Flowise | 约 44k | 2026-06 | Apache-2.0 | 未见额外禁多租户 SaaS、强制 logo 或商业授权触发条款；按 Apache-2.0 处理。 | ✅ 直通 |
| Bisheng | https://github.com/dataelement/bisheng | 约 9k | 2026-06 | Apache-2.0 + 附加条款 | Bisheng 开源协议基于 Apache-2.0，但附加商业限制覆盖多租户 SaaS / 对外运营、去除 logo / copyright、商业化服务等场景；需保留品牌标识，触发商业授权。 | ❌ 一票否决 |
| Langflow | https://github.com/langflow-ai/langflow | 约 100k | 2026-06 | MIT | MIT License；未见额外禁多租户 SaaS、强制 logo 或商业授权触发条款。 | ✅ 直通 |
| RAGFlow | https://github.com/infiniflow/ragflow | 约 67k | 2026-06 | Apache-2.0 | Apache-2.0；未见额外禁多租户 SaaS、强制 logo 或商业授权触发条款。 | ✅ 直通 |
| Botpress | https://github.com/botpress/botpress | 约 14k | 2026-06 | MIT | 当前 botpress/botpress 仓库为 MIT；未见额外禁多租户 SaaS、强制 logo 或商业授权触发条款。注意历史 Botpress v12 曾采用 AGPL / 商业授权双许可，若复用 v12 代码需另行否决。 | ✅ 直通 |

## 快查来源

- Dify: https://github.com/langgenius/dify, https://github.com/langgenius/dify/blob/main/LICENSE
- FastGPT: https://github.com/labring/FastGPT, https://github.com/labring/FastGPT/blob/main/LICENSE
- Flowise: https://github.com/FlowiseAI/Flowise, https://github.com/FlowiseAI/Flowise/blob/main/LICENSE.md
- Bisheng: https://github.com/dataelement/bisheng, https://github.com/dataelement/bisheng/blob/main/LICENSE
- Langflow: https://github.com/langflow-ai/langflow, https://github.com/langflow-ai/langflow/blob/main/LICENSE
- RAGFlow: https://github.com/infiniflow/ragflow, https://github.com/infiniflow/ragflow/blob/main/LICENSE
- Botpress: https://github.com/botpress/botpress, https://github.com/botpress/botpress/blob/master/LICENSE

结论：存活候选清单：Flowise、Langflow、RAGFlow、Botpress。否决：Dify、FastGPT、Bisheng。
