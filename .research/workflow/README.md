# Workflow state

`../STATE.md` is the recovery entry point. The state helper is `scripts/research-workflow.mjs`; use its commands for transitions. The Pi approval script is `.pi/workflows/plan-review.workflow.js` and must be run in the foreground.

## Routine command reference

Run `node scripts/research-workflow.mjs COMMAND` from the project root. Read this reference instead of the helper's implementation during normal operations.

| Command and arguments | Required state | Result |
| --- | --- | --- |
| `status` | Any | Print STATE.md without changing it |
| `new EXP-0001` | IDLE | Create the first experiment's templates and enter PLAN_DRAFT; use an unused ID for later rounds |
| `submit-plan` | PLAN_DRAFT | Check committed PLAN.md/RUN.json and enter PLAN_REVIEW |
| `record-plan-review DECISION human "checkpoint RUN_ID: reason"` | PLAN_REVIEW | Record the actual APPROVE, REVISE or REJECT response |
| `record-implementation MODEL` | PLAN_APPROVED or IMPLEMENTATION_REVISION | Check the approved plan and clean code commit; enter CODE_REVIEW |
| `record-review VERDICT MODEL RECEIPT_PATH "summary"` | CODE_REVIEW or unexecuted READY_TO_RUN | Validate the host-captured report/session evidence and record the actual verdict |
| `reopen-review "reason"` | CODE_REVIEW or READY_TO_RUN | Immediately revoke the previous PASS before a fresh independent review |
| `check-run` | READY_TO_RUN | Check plan hash, clean code and equality of HEAD/implementation/review commits |
| `run` | READY_TO_RUN | Acquire the exclusive run lock, enter RUNNING, stream stdout/stderr, then record exit/signal and ANALYSIS or EXECUTION_FAILED |
| `recover-run "reason"` | RUNNING, or READY_TO_RUN with stale lock | Refuse while the recorded owner or child process group is alive; otherwise record interruption as failure without restarting |
| `decide VERDICT "evidence"` | ANALYSIS, REJECTED, EXECUTION_FAILED or HUMAN_INTERVENTION | Record CONTINUE, REVISE, ABANDON or INCONCLUSIVE and return to IDLE |

Human approval runs the complete `.pi/workflows/plan-review.workflow.js` through the `workflow` tool with `background: false`. Pass `{ experimentId, planCommit, planSha256 }` from STATE.md; keep `export const meta` as the script's first statement. This script contains no model agent calls. Human confirmation is supplied by Pi's foreground UI.

Use the installed workflow-authoring Skill for API details. Inspect implementation JS only when a concrete error cannot be resolved from this reference or the Skill. Keep workflow infrastructure fixes in separate commits; `.pi/` changes remain part of the implementation review diff against the approved plan commit.

## SDK compatibility and review evidence

`.pi/extensions/research-workflow.ts` is the single project entry point for the pinned 3.14.0 plugin. The package entry in `.pi/settings.json` disables its upstream extension while retaining its skills; the local entry uses the existing native-ESM host SDK factory seam. It does not patch global packages. Before each named role's prompt it enforces the declared model, requested/effective thinking and final tool set. Reviewer gets exactly read/grep/find/ls, including tools omitted by Pi 1.4's default createCodingTools, and excludes upstream shared-store tools. Unknown tool or thinking mismatches abort before the prompt.

Defaults: Captain/Worker/Runner DeepSeek Flash / low; Reviewer DeepSeek V4 Pro / high (explicit user choice after SDK inspection showed V4 Pro supports off/high/max). Preserve the `Research role:` markers in agent bodies. Do not run with `--no-extensions` for normal workflow orchestration: that also disables the compatibility adapter. When changing Pi/plugin versions, rerun the SDK integration tests before claiming compatibility.

Prepare the exact implementation diff, then run the complete `.pi/workflows/code-review.workflow.js` using workflow with `background:false` and the current experiment/implementation/plan/hash/diff arguments. Do not use `thread` for independent reviews. Host capture writes `reviews/UUID.json`, `.md` and `.events.jsonl` under the current experiment. Captain locates the receipt with read-only listing, examines its actual active tools, calls, model, requested/effective thinking, commit and report, then passes its path to record-review. Missing, modified, overprivileged, wrong-model/commit or incomplete evidence cannot authorize a run. check-run revalidates the receipt/report/events hashes. Receipts are audit records for trusted workflow participants, not an OS sandbox or a signature against a malicious writer.

## Live execution and interrupted runs

Read STATE.md/status and `outputs/EXP-XXXX/stdout.log` / `stderr.log` during RUNNING. The helper also streams both outputs through the invoking tool. Never append `echo`, pipelines or success fallbacks to run. A duplicate start refuses without truncating the first run's logs. Existing stdout/stderr files are not overwritten. SIGINT/SIGTERM are forwarded to the experiment process group and recorded as failure; a forced owner kill leaves a lock requiring explicit recovery after the recorded processes stop. Do not delete the lock to retry an experiment.

## Verification

`node --test tests/*.test.mjs` includes real SDK sessions and workflow execution against an in-process synthetic provider; no paid model or network is required. `node tests/manual/pi-workflow-smoke.mjs` is an explicit opt-in paid DeepSeek smoke harness in a temporary synthetic project; a new invocation saves its inputs and outputs under outputs/workflow-hardening. It is not part of the automatic suite. Project-specific Python code, environment configuration and tests belong to the actual research project, which is currently unconfigured.

Current hardening verification status is recorded in [HARDENING.md](HARDENING.md). Research memory and experimental output logs are empty; a previous green suite does not verify later adapter edits.
