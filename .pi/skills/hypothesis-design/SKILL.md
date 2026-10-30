---
name: hypothesis-design
description: Design one falsifiable hypothesis and the smallest decisive experiment plan.
---
# Hypothesis design

## Objective
Produce one reviewable experiment that can support or falsify a specific mechanism.

## Required Inputs
Project goal, related work, prior hypotheses, available data, baseline, resources and constraints.

## Procedure
1. Search `HYPOTHESES.md` and rejected decisions for duplicates.
2. State mechanism, competing explanations and a measurable falsification criterion.
3. Specify intervention, baseline/control, data split, metrics, seed, statistical comparison, expected outcomes, cost and risks.
4. Fill `PLAN.md` and immutable intended command in `RUN.json`; commit both and call `submit-plan`.

## Output
`.research/experiments/EXP-XXXX/PLAN.md` with the ten sections in the template and a committed `RUN.json` command.

## Constraints
Do not change source code or run the formal experiment. Any edit after submission invalidates approval.

## Completion Criteria
An independent human can approve, revise or reject the plan and its exact command without asking what will be run.
