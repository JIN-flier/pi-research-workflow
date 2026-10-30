#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FIELDS = ['project_id', 'current_experiment', 'workflow_state', 'plan_status', 'implementation_status', 'code_review_status', 'execution_status', 'analysis_status', 'approved_plan_commit', 'approved_plan_sha256', 'implementation_commit', 'implementation_model', 'reviewed_commit', 'reviewer_model', 'execution_commit', 'revision_count', 'next_action'];
const statePath = root => join(root, '.research/STATE.md');
const expDir = (root, id) => join(root, '.research/experiments', id);
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const gitFile = (root, revision, path) => execFileSync('git', ['-C', root, 'show', `${revision}:${path}`], { encoding: 'utf8' });
const head = root => git(root, 'rev-parse', 'HEAD');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(path, 'utf8');

function load(root) {
  const path = statePath(root);
  if (!existsSync(path)) throw new Error('STATE.md missing; create an experiment first');
  const state = {};
  for (const line of read(path).split('\n')) {
    const match = line.match(/^([a-z0-9_]+):\s*(.*)$/);
    if (match && FIELDS.includes(match[1])) {
      try { state[match[1]] = JSON.parse(match[2]); }
      catch { state[match[1]] = match[2]; }
    }
  }
  return state;
}
function save(root, state) {
  mkdirSync(join(root, '.research'), { recursive: true });
  writeFileSync(statePath(root), `# Research state\n\n${FIELDS.map(key => {
    const value = state[key] ?? null;
    return `${key}: ${typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value) ? value : JSON.stringify(value)}`;
  }).join('\n')}\n`);
}
function requireState(state, ...allowed) {
  if (!allowed.includes(state.workflow_state)) throw new Error(`expected ${allowed.join(' or ')}, got ${state.workflow_state}`);
}
function appendRecord(root, file, text) {
  const path = join(expDir(root, load(root).current_experiment), file);
  writeFileSync(path, `${existsSync(path) ? read(path) : ''}${text}\n`);
}
function planPath(root, state) { return join(expDir(root, state.current_experiment), 'PLAN.md'); }
function verifyPlan(root, state) {
  const path = `.research/experiments/${state.current_experiment}/PLAN.md`;
  const committed = gitFile(root, state.approved_plan_commit, path);
  if (sha(read(planPath(root, state))) !== state.approved_plan_sha256 || sha(committed) !== state.approved_plan_sha256)
    throw new Error('approved plan changed; resubmit and obtain human approval again');
}
function codeDirty(root) {
  return git(root, 'status', '--porcelain', '--', '.', ':(exclude).research', ':(exclude)outputs');
}
function concreteModel(model) {
  // Normalize the routing prefix and case so the same underlying model cannot
  // pass the independence gate by taking another route or spelling.
  return model.trim().toLowerCase().replace(/^openrouter\//, '');
}

export function createExperiment(root, id) {
  if (!/^EXP-\d{4}$/.test(id)) throw new Error('experiment ID must be EXP-0001 format');
  if (existsSync(statePath(root)) && load(root).workflow_state !== 'IDLE') throw new Error('finish the current experiment first');
  const dir = expDir(root, id);
  if (existsSync(dir)) throw new Error('experiment already exists');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'PLAN.md'), '# Experiment plan\n\n## Scientific question\n\n## Hypothesis\n\n## Mechanism\n\n## Related work and novelty\n\n## Design\n\n## Baseline and controls\n\n## Metrics\n\n## Expected results\n\n## Falsification criteria\n\n## Cost and risks\n');
  writeFileSync(join(dir, 'RUN.json'), '{\n  "command": [],\n  "description": "Fill before plan review; command and plan must be committed together"\n}\n');
  for (const file of ['IMPLEMENTATION.md', 'CODE_REVIEW.md', 'EXECUTION.md', 'RESULTS.md', 'DECISION.md']) writeFileSync(join(dir, file), `# ${file.replace('.md', '')}\n\nPending.\n`);
  save(root, { project_id: 'PROJECT-001', current_experiment: id, workflow_state: 'PLAN_DRAFT', plan_status: 'draft', implementation_status: 'not_started', code_review_status: 'not_started', execution_status: 'not_started', analysis_status: 'not_started', revision_count: 0, next_action: 'complete_and_commit_plan' });
}

export function submitPlan(root) {
  const state = load(root);
  requireState(state, 'PLAN_DRAFT');
  const rel = `.research/experiments/${state.current_experiment}/PLAN.md`;
  const plan = read(planPath(root, state));
  const sections = ['Scientific question', 'Hypothesis', 'Mechanism', 'Related work and novelty', 'Design', 'Baseline and controls', 'Metrics', 'Expected results', 'Falsification criteria', 'Cost and risks'];
  for (const section of sections) {
    const match = plan.match(new RegExp(`^## ${section}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
    if (!match || !match[1].trim()) throw new Error(`plan is incomplete: ${section}`);
  }
  const committed = gitFile(root, 'HEAD', rel);
  if (committed !== plan) throw new Error('commit PLAN.md before submission');
  const runRel = `.research/experiments/${state.current_experiment}/RUN.json`;
  const run = JSON.parse(gitFile(root, 'HEAD', runRel));
  if (!Array.isArray(run.command) || !run.command.length || run.command.some(x => typeof x !== 'string' || !x)) throw new Error('commit a nonempty RUN.json command with the plan');
  state.approved_plan_commit = head(root);
  state.approved_plan_sha256 = sha(plan);
  state.workflow_state = 'PLAN_REVIEW';
  state.plan_status = 'pending';
  state.next_action = 'wait_for_human_approval';
  save(root, state);
  return state;
}

export function reviewPlan(root, decision, reviewer, reason) {
  const state = load(root);
  requireState(state, 'PLAN_REVIEW');
  if (!['APPROVE', 'REVISE', 'REJECT'].includes(decision)) throw new Error('invalid plan decision');
  if (reviewer !== 'human' || !reason?.trim()) throw new Error('explicit human approval and reason required');
  verifyPlan(root, state);
  appendRecord(root, 'PLAN_REVIEW.md', `- ${new Date().toISOString()} | ${decision} | plan_commit=${state.approved_plan_commit} | plan_sha256=${state.approved_plan_sha256} | reviewer=human | ${reason}`);
  if (decision === 'APPROVE') {
    state.workflow_state = 'PLAN_APPROVED'; state.plan_status = 'approved'; state.next_action = 'implement_approved_plan';
  } else if (decision === 'REVISE') {
    state.workflow_state = 'PLAN_DRAFT'; state.plan_status = 'revise'; state.next_action = 'revise_and_commit_plan';
    state.approved_plan_commit = null; state.approved_plan_sha256 = null;
  } else {
    state.workflow_state = 'REJECTED'; state.plan_status = 'rejected'; state.next_action = 'record_research_decision';
  }
  save(root, state);
}

export function recordImplementation(root, model) {
  const state = load(root);
  if (state.revision_count >= 2 && state.workflow_state !== 'PLAN_APPROVED') throw new Error('automatic revision limit reached; human intervention required');
  if (!['PLAN_APPROVED', 'IMPLEMENTATION_REVISION'].includes(state.workflow_state)) throw new Error('approved plan required before implementation');
  verifyPlan(root, state);
  if (codeDirty(root)) throw new Error('working tree has uncommitted code changes');
  if (head(root) === state.approved_plan_commit || head(root) === state.implementation_commit) throw new Error('new implementation commit required');
  const changedCode = git(root, 'diff', '--name-only', state.approved_plan_commit, 'HEAD', '--', '.', ':(exclude).research', ':(exclude)outputs');
  if (!changedCode) throw new Error('implementation commit contains no code changes');
  if (!model) throw new Error('implementation model required');
  state.implementation_commit = head(root); state.implementation_model = model;
  state.reviewed_commit = null; state.reviewer_model = null;
  state.implementation_status = 'committed'; state.code_review_status = 'pending';
  state.workflow_state = 'CODE_REVIEW'; state.next_action = 'independent_code_review';
  appendRecord(root, 'IMPLEMENTATION.md', `- commit=${state.implementation_commit} | model=${model} | approved_plan_commit=${state.approved_plan_commit}`);
  save(root, state);
}

export function recordReview(root, verdict, reviewerModel, summary) {
  const state = load(root);
  requireState(state, 'CODE_REVIEW');
  if (!['PASS', 'CHANGES_REQUIRED', 'NEEDS_HUMAN_REVIEW'].includes(verdict)) throw new Error('invalid review verdict');
  if (!reviewerModel || concreteModel(reviewerModel) === concreteModel(state.implementation_model)) throw new Error('reviewer must use a different concrete model (route prefixes are normalized)');
  if (!summary?.trim()) throw new Error('review summary required');
  verifyPlan(root, state);
  if (head(root) !== state.implementation_commit || codeDirty(root)) throw new Error('implementation commit changed or working tree dirty');
  appendRecord(root, 'CODE_REVIEW.md', `- ${new Date().toISOString()} | ${verdict} | commit=${state.implementation_commit} | model=${reviewerModel} | ${summary}`);
  state.reviewer_model = reviewerModel; state.code_review_status = verdict.toLowerCase();
  if (verdict === 'PASS') {
    state.reviewed_commit = state.implementation_commit; state.workflow_state = 'READY_TO_RUN'; state.next_action = 'execute_approved_command';
  } else if (verdict === 'CHANGES_REQUIRED') {
    state.revision_count += 1; state.reviewed_commit = null;
    state.workflow_state = state.revision_count >= 2 ? 'HUMAN_INTERVENTION' : 'IMPLEMENTATION_REVISION';
    state.next_action = state.revision_count >= 2 ? 'human_review_of_failed_revisions' : 'revise_implementation';
  } else {
    state.reviewed_commit = null; state.workflow_state = 'HUMAN_INTERVENTION'; state.next_action = 'human_review_of_code';
  }
  save(root, state);
}

export function assertExecutionReady(root) {
  const state = load(root);
  if (state.workflow_state !== 'READY_TO_RUN' || state.code_review_status !== 'pass') throw new Error('PASS review required before execution');
  verifyPlan(root, state);
  if (!state.reviewed_commit || state.reviewed_commit !== state.implementation_commit || head(root) !== state.reviewed_commit) throw new Error('execution commit must equal reviewed implementation commit');
  if (codeDirty(root)) throw new Error('working tree has code changes after review');
  return state;
}

export function runExperiment(root) {
  const state = assertExecutionReady(root);
  const rel = `.research/experiments/${state.current_experiment}/RUN.json`;
  const committed = gitFile(root, state.approved_plan_commit, rel);
  if (read(join(root, rel)) !== committed) throw new Error('RUN.json changed after plan approval');
  const { command } = JSON.parse(committed);
  if (!Array.isArray(command) || !command.length) throw new Error('RUN.json command missing');
  const output = join(root, 'outputs', state.current_experiment);
  mkdirSync(output, { recursive: true });
  const started = new Date().toISOString();
  const result = spawnSync(command[0], command.slice(1), { cwd: root, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  writeFileSync(join(output, 'stdout.log'), result.stdout ?? '');
  writeFileSync(join(output, 'stderr.log'), result.stderr ?? String(result.error ?? ''));
  state.execution_commit = head(root);
  state.execution_status = result.status === 0 && !codeDirty(root) && state.execution_commit === state.reviewed_commit ? 'success' : 'failed';
  state.workflow_state = state.execution_status === 'success' ? 'ANALYSIS' : 'EXECUTION_FAILED';
  state.next_action = state.execution_status === 'success' ? 'analyze_results' : 'inspect_failure';
  appendRecord(root, 'EXECUTION.md', `- started=${started} | finished=${new Date().toISOString()} | command=${JSON.stringify(command)} | commit=${state.execution_commit} | exit=${result.status} | status=${state.execution_status} | logs=outputs/${state.current_experiment}/`);
  save(root, state);
  if (state.execution_status !== 'success') throw new Error('experiment failed; inspect EXECUTION.md and logs');
}

export function recordDecision(root, verdict, summary) {
  const state = load(root);
  requireState(state, 'ANALYSIS', 'REJECTED', 'EXECUTION_FAILED', 'HUMAN_INTERVENTION');
  if (!['CONTINUE', 'REVISE', 'ABANDON', 'INCONCLUSIVE'].includes(verdict) || !summary?.trim()) throw new Error('decision and evidence summary required');
  if (state.workflow_state === 'ANALYSIS') {
    const results = read(join(expDir(root, state.current_experiment), 'RESULTS.md'));
    if (results.includes('Pending.') || results.trim().length < 40) throw new Error('RESULTS.md must contain analysis before decision');
  }
  const line = `- ${new Date().toISOString()} | ${state.current_experiment} | ${verdict} | execution_commit=${state.execution_commit ?? 'none'} | ${summary}`;
  appendRecord(root, 'DECISION.md', line);
  const decisions = join(root, '.research/DECISIONS.md');
  writeFileSync(decisions, `${existsSync(decisions) ? read(decisions) : '# Research decisions\n\n'}${line}\n`);
  state.workflow_state = 'IDLE'; state.analysis_status = state.execution_status === 'success' ? 'complete' : 'not_applicable';
  state.next_action = 'form_next_hypothesis_or_stop';
  save(root, state);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.cwd();
  const [command, ...args] = process.argv.slice(2);
  try {
    switch (command) {
      case 'new': createExperiment(root, args[0]); break;
      case 'submit-plan': submitPlan(root); break;
      case 'record-plan-review': reviewPlan(root, args[0], args[1], args.slice(2).join(' ')); break;
      case 'record-implementation': recordImplementation(root, args[0]); break;
      case 'record-review': recordReview(root, args[0], args[1], args.slice(2).join(' ')); break;
      case 'check-run': assertExecutionReady(root); break;
      case 'run': runExperiment(root); break;
      case 'decide': recordDecision(root, args[0], args.slice(1).join(' ')); break;
      case 'status': console.log(read(statePath(root))); break;
      default: throw new Error('usage: new EXP-0001 | submit-plan | record-plan-review APPROVE|REVISE|REJECT human REASON | record-implementation MODEL | record-review VERDICT MODEL SUMMARY | check-run | run | decide VERDICT SUMMARY | status');
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
