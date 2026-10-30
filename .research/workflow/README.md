# Workflow state

`../STATE.md` is the recovery entry point. The state helper is `scripts/research-workflow.mjs`; use its commands for transitions. The Pi approval script is `.pi/workflows/plan-review.workflow.js` and must be run in the foreground.

## Routine command reference

Run `node scripts/research-workflow.mjs COMMAND` from the project root. Read this reference instead of the helper's implementation during normal operations.

| Command and arguments | Required state | Result |
| --- | --- | --- |
| `status` | Any | Print STATE.md without changing it |
| `new EXP-0002` | IDLE | Create templates and enter PLAN_DRAFT |
| `submit-plan` | PLAN_DRAFT | Check committed PLAN.md/RUN.json and enter PLAN_REVIEW |
| `record-plan-review DECISION human "checkpoint RUN_ID: reason"` | PLAN_REVIEW | Record the actual APPROVE, REVISE or REJECT response |
| `record-implementation MODEL` | PLAN_APPROVED or IMPLEMENTATION_REVISION | Check the approved plan and clean code commit; enter CODE_REVIEW |
| `record-review VERDICT MODEL "summary"` | CODE_REVIEW | Record the actual independent PASS, CHANGES_REQUIRED or NEEDS_HUMAN_REVIEW |
| `check-run` | READY_TO_RUN | Check plan hash, clean code and equality of HEAD/implementation/review commits |
| `run` | READY_TO_RUN | Execute the approved RUN.json command and save logs/exit status |
| `decide VERDICT "evidence"` | ANALYSIS, REJECTED, EXECUTION_FAILED or HUMAN_INTERVENTION | Record CONTINUE, REVISE, ABANDON or INCONCLUSIVE and return to IDLE |

Human approval runs the complete `.pi/workflows/plan-review.workflow.js` through the `workflow` tool with `background: false`. Pass `{ experimentId, planCommit, planSha256 }` from STATE.md; keep `export const meta` as the script's first statement. This script contains no model agent calls. Human confirmation is supplied by Pi's foreground UI.

Use the installed workflow-authoring Skill for API details. Inspect implementation JS only when a concrete error cannot be resolved from this reference or the Skill. Keep workflow infrastructure fixes in separate commits; `.pi/` changes remain part of the implementation review diff against the approved plan commit.
