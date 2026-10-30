# Research decisions

Record each consequential decision with date, experiment ID, evidence files, commit, alternatives, and reason. Do not treat an unrun hypothesis as a conclusion.

## 2026-10-30 — Infrastructure: reviewer independence rule (authorized)

- Decision: Reviewer is `deepseek/deepseek-v4-pro`; implementation worker and experiment runner remain `deepseek/deepseek-flash`. The code-review gate now requires a different concrete model (case-insensitive, with the `openrouter/` routing prefix normalized), replacing the previous cross-vendor family comparison. No other gate changed.
- Authorization: the user explicitly authorized adapting the workflow to different concrete models and completing the validation ("允许修改为不同具体模型，继续完整验证"). No global Pi configuration or credentials were modified.
- Trade-off: reviewer and worker can share one vendor's training and preferences, so independence is weaker than cross-family review. Mitigations kept: fresh independent context, read-only reviewer tools, review of the exact commit, and the human plan-approval gate.
- Evidence: `tests/workflow.test.mjs` (same-vendor different model accepted; same model via route or case rejected), `scripts/research-workflow.mjs`, `.pi/agents/independent-code-reviewer.md`, `README.md`.
- Commit: this infrastructure commit; its hash is reported from Git history rather than embedded here.

## 2026-10-30 — EXP-0001 result: CONTINUE, close the round

- Decision: EXP-0001 ends with **CONTINUE** for the research direction. H-0001 is **supported only under seed 42, the fixed 3-epoch/2-thread/≤100k-parameter configuration**. No new experiment is started now; "CONTINUE" records a future option, not an automatic next run.
- Evidence: CNN one-time test accuracy **0.9868** (≥0.98 target met) and final validation **0.9856** > MLP **0.9660**; MLP test **0.9677**. Execution/reviewed/implementation commit `b578aef217891d13d15697547562fdcb07d7a859`; approved plan `b71c3fe135362856f950392eb395963c55c8543f`; raw outputs `outputs/EXP-0001/metrics.json`, `stdout.log`, `stderr.log`; analysis `.research/experiments/EXP-0001/RESULTS.md`; decision `.research/experiments/EXP-0001/DECISION.md`.
- Why not REVISE/ABANDON/INCONCLUSIVE: protocol checks passed, the falsification criteria for the primary target and the validation comparison were not triggered, and usable evidence exists. The unresolved limitation is the single seed, which limits scope rather than making the run uninterpretable.
- Alternatives: repeating seeds would estimate variance but is a **new** experiment with a new pre-registration; it was not started here. Reusing the test set for "confirmation" is forbidden.
- Workflow caveat: the scientific result does not clear the workflow of defects. The reviewer tool-policy defect (FAIL-0001) remains unfixed and was only contained by an explicit read-only CLI supplementary review; the synchronous `run` helper also gives no in-progress visibility. See `.research/WORKFLOW_VALIDATION.md`.
- Commit: the final docs-only commit; it does not change the recorded execution commit.
- 2026-10-30T14:11:21.283Z | EXP-0001 | CONTINUE | execution_commit=b578aef217891d13d15697547562fdcb07d7a859 | EXP-0001: CNN one-time test accuracy 0.9868 >= 0.98 and final val 0.9856 > MLP 0.9660 (test 0.9677); protocol checks passed at commit b578aef. H-0001 supported only for seed 42 / fixed 3-epoch, 2-thread, <=100k-parameter configuration; single seed, no statistical significance. No new experiment started. Workflow caveat: reviewer tool-policy defect FAIL-0001 remains unfixed (contained by explicit read-only CLI review); run helper progress visibility remains limited. Evidence: RESULTS.md, DECISION.md, outputs/EXP-0001/metrics.json, EXECUTION.md, WORKFLOW_VALIDATION.md.
