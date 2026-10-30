# Hypotheses

| ID | Hypothesis | Falsification criterion | Status | Evidence |
| --- | --- | --- | --- | --- |

Before creating a new hypothesis, search this table and rejected decisions for equivalent ideas.
| H-0001 | 在固定 3 epoch、每模型 ≤100,000 参数、2 线程 CPU、seed 42 的预算下，CNN（16/32 卷积 + 48 单元 MLP 头）的测试准确率 ≥0.98，且最终验证准确率高于 784→96→10 MLP 基线。 | CNN 一次性测试准确率 <0.98，或 CNN 最终验证准确率 ≤ MLP 最终验证准确率。 | supported (single seed/config) | `.research/experiments/EXP-0001/PLAN.md`；`RESULTS.md`；`outputs/EXP-0001/metrics.json`；execution commit `b578aef217891d13d15697547562fdcb07d7a859`。CNN test 0.9868、val 0.9856；MLP test 0.9677、val 0.9660。仅 seed 42 的一次运行，不声称统计显著或普遍性；未做重复 seed。 |
