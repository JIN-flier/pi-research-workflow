# Pi Agent research project

This repository is a research workflow skeleton. The scientific problem, data, source code, and experiment command are not yet supplied; use `.research/PROJECT.md` as the project-specific source of truth.

## Start or resume

Read `.research/PROJECT.md`, then `.research/STATE.md`. Search `.research/DECISIONS.md`, `.research/HYPOTHESES.md`, and only the relevant experiment/failure records. Load a Skill in `.pi/skills/` only when that stage is active. Never load all literature or experiments by default.

## Environment and layout

- Pi 1.4.0 and Node.js 24 are available in the current environment.
- `.pi/agents/` contains three named agent types for `pi-dynamic-workflows`.
- `.research/experiments/EXP-XXXX/` stores a round's plan, review, implementation, execution, results, and decision.
- `scripts/research-workflow.mjs` enforces state and Git checks. `outputs/EXP-XXXX/` holds run logs.
- Python research projects use uv; select the Python version and dependencies for the actual project, commit the environment configuration and lockfile, and ignore `.venv`.

## Experiment and Git rules

Fill `PLAN.md` and `RUN.json`, commit both, then run `node scripts/research-workflow.mjs submit-plan`. Human review uses `.pi/workflows/plan-review.workflow.js` in a foreground Pi workflow; no response or headless mode must abort. Record the explicit result with `record-plan-review`, including a reason and the workflow run ID. Do not run an implementation agent until `PLAN_APPROVED`.

Worker commits only the approved code changes and calls `record-implementation MODEL`. Reviewer examines the exact commit and approved plan using `independent-code-reviewer`, then calls `record-review VERDICT MODEL SUMMARY`. A PASS for the current commit is required before `run`. Up to two CHANGES_REQUIRED rounds are allowed. A changed plan requires a new plan review; changed code requires a new independent review. Do not modify a baseline or silently change `RUN.json` after approval.

The reviewer has read-only Pi tools; the runner is instructed to use only the gated `run` command. Pi tool allowlists are not an OS sandbox. Treat commands outside `scripts/research-workflow.mjs` as outside the formal experiment workflow.

## Missing project specifics

Before the first plan, the researcher must fill scientific question, data, baseline, metrics, risks, and a real `RUN.json` command. When STATE.md is IDLE with no current experiment, create the experiment using the state helper's `new` command. Never fabricate results or mark the placeholder plan approved.
