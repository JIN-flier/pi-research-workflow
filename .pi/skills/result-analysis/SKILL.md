---
name: result-analysis
description: Analyze completed experiment outputs against the approved plan and baselines.
---
# Result analysis

## Objective
Determine what the measured results support, including failures and uncertainty.

## Required Inputs
Approved plan, execution record and logs, raw outputs, baseline results, metric definitions and run commit.

## Procedure
1. Verify exit status, execution commit and data provenance.
2. Recompute or verify metrics and compare against the predeclared baseline and falsification criterion.
3. Examine variance, confounders, leakage, deviations and failure cases.

## Output
Write `RESULTS.md` under the experiment with tables, commands, output paths, uncertainty, limitations and direct evidence references.

## Constraints
Do not quietly change metrics or exclude failed runs. Do not infer success from exit code alone.

## Completion Criteria
The reported numbers can be regenerated from named outputs and the plan's metric definition.
