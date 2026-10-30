---
name: research-understanding
description: Recover this project's current research status from memory, code and relevant evidence.
---
# Research understanding

## Objective
Reconstruct the current scientific question, verified findings, open uncertainties and next task.

## Required Inputs
`.research/PROJECT.md`, `.research/STATE.md`, relevant rows of `DECISIONS.md` and `HYPOTHESES.md`, current experiment, and only related code/failure records.

## Procedure
1. Read the two entry files; inspect the current experiment and related past decisions.
2. Distinguish recorded evidence from assumptions. Search rejected hypotheses before suggesting directions.
3. Identify missing project information and the stage's allowed next action.

## Output
Write `.research/RESEARCH_STATUS.md` with question, evidence, uncertainty, current state, next action and file/commit references.

## Constraints
Do not infer scientific results from plans; do not read all history by default; do not advance state.

## Completion Criteria
Another session can recover the current state and find each supporting record without the conversation history.
