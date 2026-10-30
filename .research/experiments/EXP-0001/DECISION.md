# DECISION — EXP-0001

- Date: 2026-10-30
- Experiment: EXP-0001
- Decision: **CONTINUE**（结束本轮；只保留未来研究建议，不自动发起下一轮）
- Evidence commit: `b578aef217891d13d15697547562fdcb07d7a859`（implementation = reviewed = executed）
- Approved plan: `b71c3fe135362856f950392eb395963c55c8543f`，SHA256 `da7401c5b07e169ed9fa4d5e2ef137c44eee281dda0dfb78ef82a8579f52f2c3`
- Results: [RESULTS.md](./RESULTS.md)
- Raw outputs: `outputs/EXP-0001/metrics.json`、`stdout.log`、`stderr.log`
- Execution record: [EXECUTION.md](./EXECUTION.md)
- Review records: [CODE_REVIEW.md](./CODE_REVIEW.md)、[REVIEW-b578aef-readonly-cli.md](./REVIEW-b578aef-readonly-cli.md)

## 决策理由

1. **主目标达成**：CNN 一次性测试准确率 `0.9868`，不低于计划阈值 `0.98`；证伪条件 1 未触发。
2. **同预算基线比较方向一致**：CNN 最终验证准确率 `0.9856` 高于 MLP `0.9660`；证伪条件 2 未触发。测试准确率差值同为正向（`0.9868` vs `0.9677`）。
3. **协议有效**：参数量、epoch、线程、固定划分、单次 final 测试读取与执行 commit 均有记录且符合批准计划；未发现泄漏或批准后改动 RUN/PLAN。
4. **证据强度有限**：只有 seed 42 的一次运行，没有方差估计；因此结论只能是“H-0001 在本次 seed 与配置下得到支持”，不能升级为统计显著或普遍结论。

## 为什么不是其他 verdict

- **不是 REVISE**：没有发现协议违规、数据泄漏、实现与批准计划的行为偏离，也没有必须在同一科学问题下修正后才能解释结果的缺陷。
- **不是 ABANDON**：主目标与基线比较均朝支持假设的方向完成，没有证伪证据。
- **不是 INCONCLUSIVE**：执行成功且主指标、基线指标、协议检查都可用；不确定性来自单 seed 的范围限制，而不是结果缺失。若未来需要估计方差或做统计推断，应另立有预注册重复次数的实验，而不是把本轮标为无结论。

## 对未来研究的建议（不自动执行）

- 若要检验稳健性，可在**新实验、预注册重复 seed/运行次数**的前提下估计方差；不得把重复测试集读取当作补救手段。
- 若要比较收敛行为，可在**新预算**下预注册更多 epoch；本轮 3 epoch 结果不能外推。
- 若继续使用当前实现，优先修复审查指出的非阻塞实现问题（配置字段未真正驱动运行、digest 字节序未注明等），但这些修复不改变本轮科学结论，也不在本轮擅自进行。
- **本轮到此结束，不启动下一轮实验，不训练、不重跑、不调参。**

## 必须同时保留的 workflow 事实

科学结果成功**不等于** workflow 全流程无缺陷：

- 初版 named reviewer 的“只读工具”策略在 Pi 1.4 + pi-dynamic-workflows 3.14.0 下未真正限制内置工具，实际发生了成功 `bash` 调用；该插件缺陷未修复，只通过显式 CLI 只读复审做了补充证据。见 `.research/failures/FAIL-0001-reviewer-tool-policy.md` 与 `.research/WORKFLOW_VALIDATION.md`。
- `run` helper 使用同步子进程，运行期间 STATE 仍停在 `READY_TO_RUN`，日志与状态在结束后才落盘；这是进度可见性局限，未做并发实验，也未声称已修复。
- 最终 `docs` 提交只归档研究记录，不改变已记录的 `execution_commit = b578aef…`。
- 2026-10-30T14:11:21.283Z | EXP-0001 | CONTINUE | execution_commit=b578aef217891d13d15697547562fdcb07d7a859 | EXP-0001: CNN one-time test accuracy 0.9868 >= 0.98 and final val 0.9856 > MLP 0.9660 (test 0.9677); protocol checks passed at commit b578aef. H-0001 supported only for seed 42 / fixed 3-epoch, 2-thread, <=100k-parameter configuration; single seed, no statistical significance. No new experiment started. Workflow caveat: reviewer tool-policy defect FAIL-0001 remains unfixed (contained by explicit read-only CLI review); run helper progress visibility remains limited. Evidence: RESULTS.md, DECISION.md, outputs/EXP-0001/metrics.json, EXECUTION.md, WORKFLOW_VALIDATION.md.
