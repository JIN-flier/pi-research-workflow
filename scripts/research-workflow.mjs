#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, openSync, closeSync, unlinkSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { concreteModel, validateReviewEvidence, evidenceFile } from './review-evidence.mjs';

const FIELDS = ['project_id', 'current_experiment', 'workflow_state', 'plan_status', 'implementation_status', 'code_review_status', 'execution_status', 'analysis_status', 'approved_plan_commit', 'approved_plan_sha256', 'implementation_commit', 'implementation_model', 'reviewed_commit', 'reviewer_model', 'review_evidence_path', 'review_evidence_sha256', 'execution_commit', 'execution_run_id', 'execution_pid', 'execution_started', 'execution_finished', 'execution_exit_code', 'execution_signal', 'revision_count', 'next_action'];
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
  const temp = `${statePath(root)}.${randomUUID()}.tmp`;
  writeFileSync(temp, `# Research state\n\n${FIELDS.map(key => {
    const value = state[key] ?? null;
    return `${key}: ${typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value) ? value : JSON.stringify(value)}`;
  }).join('\n')}\n`);
  renameSync(temp, statePath(root));
}
export const getResearchState = root => load(root);
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
  const run = `.research/experiments/${state.current_experiment}/RUN.json`;
  if (read(join(root, run)) !== gitFile(root, state.approved_plan_commit, run)) throw new Error('RUN.json changed after plan approval');
}
function codeDirty(root) {
  return git(root, 'status', '--porcelain', '--', '.', ':(exclude).research', ':(exclude)outputs');
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
  if (read(join(root, runRel)) !== gitFile(root, 'HEAD', runRel)) throw new Error('commit RUN.json before submission');
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
  state.review_evidence_path = null; state.review_evidence_sha256 = null;
  state.implementation_status = 'committed'; state.code_review_status = 'pending';
  state.workflow_state = 'CODE_REVIEW'; state.next_action = 'independent_code_review';
  appendRecord(root, 'IMPLEMENTATION.md', `- commit=${state.implementation_commit} | model=${model} | approved_plan_commit=${state.approved_plan_commit}`);
  save(root, state);
}

export function reopenReview(root, reason) {
  const state = load(root);
  requireState(state, 'READY_TO_RUN', 'CODE_REVIEW');
  if (!reason?.trim()) throw new Error('reason required to reopen review');
  verifyPlan(root, state);
  if (head(root) !== state.implementation_commit || codeDirty(root)) throw new Error('implementation commit changed or working tree dirty');
  state.reviewed_commit = null; state.code_review_status = 'pending';
  state.reviewer_model = null;
  state.review_evidence_path = null; state.review_evidence_sha256 = null;
  state.workflow_state = 'CODE_REVIEW'; state.next_action = 'independent_code_review';
  appendRecord(root, 'CODE_REVIEW.md', `- ${new Date().toISOString()} | REOPENED | commit=${state.implementation_commit} | ${reason}`);
  save(root, state);
}

export function recordReview(root, verdict, reviewerModel, summary, receiptPath) {
  const state = load(root);
  requireState(state, 'CODE_REVIEW', 'READY_TO_RUN');
  if (!['PASS', 'CHANGES_REQUIRED', 'NEEDS_HUMAN_REVIEW'].includes(verdict)) throw new Error('invalid review verdict');
  if (!reviewerModel || concreteModel(reviewerModel) === concreteModel(state.implementation_model)) throw new Error('reviewer must use a different concrete model (route prefixes are normalized)');
  if (!summary?.trim()) throw new Error('review summary required');
  verifyPlan(root, state);
  if (head(root) !== state.implementation_commit || codeDirty(root)) throw new Error('implementation commit changed or working tree dirty');
  validateReviewEvidence(root, state, receiptPath, verdict, reviewerModel);
  state.review_evidence_path = receiptPath;
  state.review_evidence_sha256 = sha(read(evidenceFile(root, receiptPath)));
  appendRecord(root, 'CODE_REVIEW.md', `- ${new Date().toISOString()} | ${verdict} | commit=${state.implementation_commit} | model=${reviewerModel} | receipt=${receiptPath} | receipt_sha256=${state.review_evidence_sha256} | ${summary}`);
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
  if (!state.review_evidence_path || sha(read(evidenceFile(root, state.review_evidence_path))) !== state.review_evidence_sha256) throw new Error('review evidence missing or changed');
  validateReviewEvidence(root, state, state.review_evidence_path, 'PASS', state.reviewer_model);
  return state;
}

export async function runExperiment(root) {
  const lockPath = join(root, '.research/run.lock');
  let lock;
  try { lock = openSync(lockPath, 'wx'); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('experiment run lock exists; check status, or recover-run after verifying its owner has stopped'); throw error; }
  let stdout, stderr;
  try {
  const state = assertExecutionReady(root);
  const rel = `.research/experiments/${state.current_experiment}/RUN.json`;
  const committed = gitFile(root, state.approved_plan_commit, rel);
  if (read(join(root, rel)) !== committed) throw new Error('RUN.json changed after plan approval');
  const { command } = JSON.parse(committed);
  if (!Array.isArray(command) || !command.length) throw new Error('RUN.json command missing');
  const output = join(root, 'outputs', state.current_experiment);
  mkdirSync(output, { recursive: true });
  // Never truncate evidence from an existing run, even with a stale READY state.
  stdout = openSync(join(output, 'stdout.log'), 'wx');
  stderr = openSync(join(output, 'stderr.log'), 'wx');
  const started = new Date().toISOString(), runId = randomUUID();
  state.execution_commit = head(root);
  state.execution_run_id = runId; state.execution_pid = process.pid;
  state.execution_started = started; state.execution_finished = null;
  state.execution_exit_code = null; state.execution_signal = null;
  state.workflow_state = 'RUNNING'; state.execution_status = 'running'; state.next_action = 'monitor_run';
  writeFileSync(lock, JSON.stringify({ pid: process.pid, runId, experimentId: state.current_experiment, commit: state.execution_commit, started }));
  save(root, state);
  appendRecord(root, 'EXECUTION.md', `- started=${started} | run_id=${runId} | pid=${process.pid} | commit=${state.execution_commit} | status=running | logs=outputs/${state.current_experiment}/`);
  console.log(`RUNNING ${state.current_experiment} run_id=${runId} pid=${process.pid} logs=outputs/${state.current_experiment}/`);
  let requestedSignal, killTimer;
  const child = spawn(command[0], command.slice(1), { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, childPid: child.pid ?? null, runId, experimentId: state.current_experiment, commit: state.execution_commit, started }));
  const stop = signal => {
    requestedSignal ??= signal;
    const signalGroup = sig => {
      try { if (process.platform === 'win32') child.kill(sig); else if (child.pid) process.kill(-child.pid, sig); }
      catch (error) { if (error.code !== 'ESRCH') writeSync(stderr, `${error.message}\n`); }
    };
    signalGroup(signal);
    killTimer ??= setTimeout(() => signalGroup('SIGKILL'), 3000).unref();
  };
  const onInt = () => stop('SIGINT'), onTerm = () => stop('SIGTERM');
  process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
  child.stdout.on('data', chunk => { writeSync(stdout, chunk); process.stdout.write(chunk); });
  child.stderr.on('data', chunk => { writeSync(stderr, chunk); process.stderr.write(chunk); });
  let result;
  try {
    result = await new Promise(resolve => {
      let spawnError;
      child.on('error', error => { spawnError = error; writeSync(stderr, `${error.stack ?? error}\n`); });
      child.on('close', (code, signal) => resolve({ status: code, signal: requestedSignal ?? signal, error: spawnError }));
    });
  } finally { clearTimeout(killTimer); process.off('SIGINT', onInt); process.off('SIGTERM', onTerm); }
  state.execution_finished = new Date().toISOString();
  state.execution_exit_code = result.status; state.execution_signal = result.signal;
  state.execution_status = result.status === 0 && !result.signal && !result.error && !codeDirty(root) && state.execution_commit === head(root) && state.execution_commit === state.reviewed_commit ? 'success' : 'failed';
  state.workflow_state = state.execution_status === 'success' ? 'ANALYSIS' : 'EXECUTION_FAILED';
  state.next_action = state.execution_status === 'success' ? 'analyze_results' : 'inspect_failure';
  appendRecord(root, 'EXECUTION.md', `- finished=${state.execution_finished} | run_id=${runId} | command=${JSON.stringify(command)} | commit=${state.execution_commit} | exit=${result.status} | signal=${result.signal ?? 'none'} | status=${state.execution_status} | logs=outputs/${state.current_experiment}/`);
  save(root, state);
  if (state.execution_status !== 'success') throw new Error('experiment failed; inspect EXECUTION.md and logs');
  } finally {
    if (stdout !== undefined) closeSync(stdout);
    if (stderr !== undefined) closeSync(stderr);
    closeSync(lock); unlinkSync(lockPath);
  }
}

export function recoverRun(root, reason) {
  const path = join(root, '.research/run.lock');
  const state = load(root);
  requireState(state, 'RUNNING', 'READY_TO_RUN');
  if (!reason?.trim() || !existsSync(path)) throw new Error('recovery reason and stale run lock required');
  const lock = JSON.parse(read(path));
  if (!Number.isInteger(lock.pid) || lock.pid <= 0) throw new Error('invalid run lock owner');
  try { process.kill(lock.pid, 0); throw new Error('run owner is still alive; refusing recovery'); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
  if (Number.isInteger(lock.childPid) && lock.childPid > 0) {
    try { process.kill(process.platform === 'win32' ? lock.childPid : -lock.childPid, 0); throw new Error('experiment process group is still alive; stop it before recovery'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  if (lock.experimentId !== state.current_experiment) throw new Error('run lock experiment mismatch');
  state.execution_status = 'failed'; state.workflow_state = 'EXECUTION_FAILED';
  state.execution_finished = new Date().toISOString(); state.execution_signal = 'interrupted';
  state.next_action = 'inspect_failure';
  appendRecord(root, 'EXECUTION.md', `- recovered=${state.execution_finished} | run_id=${lock.runId} | status=failed | reason=${reason}`);
  save(root, state); unlinkSync(path);
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
      case 'record-review': recordReview(root, args[0], args[1], args.slice(3).join(' '), args[2]); break;
      case 'reopen-review': reopenReview(root, args.join(' ')); break;
      case 'check-run': assertExecutionReady(root); break;
      case 'run': await runExperiment(root); break;
      case 'recover-run': recoverRun(root, args.join(' ')); break;
      case 'decide': recordDecision(root, args[0], args.slice(1).join(' ')); break;
      case 'status': console.log(read(statePath(root))); break;
      default: throw new Error('usage: new EXP-0001 | submit-plan | record-plan-review DECISION human REASON | record-implementation MODEL | record-review VERDICT MODEL RECEIPT SUMMARY | reopen-review REASON | check-run | run | recover-run REASON | decide VERDICT SUMMARY | status');
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
