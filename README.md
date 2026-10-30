# Pi Agent research workflow (Phase 2–4)

中文入门：跟随 [uv 浮点求和教学实验](docs/tutorial-uv.md)，从方案审核走到结果记录和新 Session 恢复。

This repository provides project memory, five research Skills, three Pi agent types, and two gates: human plan approval and independent code review. It does **not** supply a scientific question, dataset, baseline, or automated research loop.

## Prepare

1. Fill `.research/PROJECT.md` with the real research problem, data and constraints.
2. Open Pi from this directory and trust the project resources (`pi -a` for this run, or accept the trust prompt). The project pins `@quintinshaw/pi-dynamic-workflows@3.14.0`.
3. Configure an OpenRouter key in Pi for reviewer model `openrouter/openai/gpt-5.4`. The current Pi profile has DeepSeek but no OpenRouter credentials. Keep worker and reviewer from different model families; change the frontmatter and state records together if choosing different models.

## One experiment

The initial round is `EXP-0001` in `PLAN_DRAFT`. For later rounds, call `node scripts/research-workflow.mjs new EXP-0002` after the previous round is closed.

1. Fill all ten sections in `.research/experiments/EXP-0001/PLAN.md`; put the exact intended executable and arguments in `RUN.json`. Commit both. Run `node scripts/research-workflow.mjs submit-plan`.
2. In an interactive Pi session, use `/research-plan-review` or ask Research Captain to run the script in `.pi/workflows/plan-review.workflow.js` through the `workflow` tool with `background: false`. This uses two foreground confirmation checkpoints: approve, otherwise reject or revise. Headless/no answer aborts. Research Captain records the returned decision and reason with `record-plan-review`.
3. Only after approval, call the `implementation-worker` agent with the approved plan commit. It commits changes and records its commit. Research Captain sends the exact diff, plan, and commit to `independent-code-reviewer` in a fresh context, then records PASS, CHANGES_REQUIRED, or NEEDS_HUMAN_REVIEW. Two automatic CHANGES_REQUIRED rounds are the maximum.
4. With PASS on the current clean HEAD, call `node scripts/research-workflow.mjs check-run` and `node scripts/research-workflow.mjs run`. The runner executes only the approved `RUN.json` command; logs go to `outputs/EXP-0001/`, and `EXECUTION.md` records status and commit.
5. Fill `RESULTS.md`, then call `node scripts/research-workflow.mjs decide CONTINUE "evidence summary"` (or REVISE, ABANDON, INCONCLUSIVE). Update `HYPOTHESES.md` with the actual finding.

The command helper checks workflow state, plan hash, review model family, revision count, clean code tree and commit equality. Pi's agent tool restrictions are process-level tool filtering, not filesystem permissions. A human must review both the plan and the final result before relying on research conclusions.

## Verify

Run `node tests/workflow.test.mjs` and `node tests/pi-config.test.mjs` from this directory. The workflow test uses temporary Git repositories under `/tmp` and performs one harmless `node -e` test run.
