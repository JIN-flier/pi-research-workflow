---
name: research-decision
description: 依据已记录证据，判断研究方向应继续、修改、放弃或暂缓。
---
# 研究决策

## 目标
选择有依据的下一步研究行动，不夸大证据。

## 必需输入
假设、已批准方案、代码审查、执行记录、结果、历史决策和项目约束。

## 步骤
1. 将结果与预先登记的预测及替代解释进行比较。
2. 结论存在方法或推断争议时按需调用 `aris-research-review` 或 `aris-result-to-claim`，使用独立审计证据核对主张与竞争解释；不得据此改变已记录结果。同家族审计的 provisional 不得写为 ARIS 跨家族 accepted。
3. 选择 CONTINUE、REVISE、ABANDON 或 INCONCLUSIVE，解释理由及何种证据会改变该选择。
4. 更新实验的 `DECISION.md`、项目的 `DECISIONS.md`、`HYPOTHESES.md` 和 `STATE.md`，记录下一步行动。

## 输出
用简体中文记录包含证据与 commit 链接的实验决策，并更新项目记忆。决策枚举、状态字段、路径和 commit 保持原样。

## 约束
不得把执行失败改称科学上的否定结果；没有新证据时不得重新采用已否决的方向。

## 完成标准
后续会话能够明确知道作出了什么决定、为什么，以及由哪个实验支持。
