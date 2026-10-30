import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { recordReview, assertExecutionReady, reopenReview, recoverRun, runExperiment, recordDecision } from '../scripts/research-workflow.mjs';
import { createHash } from 'node:crypto';
import { implementation, evidence, ready, state } from './helpers/workflow-fixture.mjs';

test('a claimed PASS without a captured reviewer session is rejected', () => {
  const root = implementation();
  assert.throws(() => recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'trust this summary'), /review evidence/);
  assert.equal(state(root).workflow_state, 'CODE_REVIEW');
});
test('an overprivileged reviewer and altered evidence cannot authorize execution', () => {
  const root = implementation();
  assert.throws(() => recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'read only', evidence(root, { activeTools: ['read', 'bash'] })), /tools|evidence/);
  const receipt = evidence(root);
  recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'verified', receipt);
  writeFileSync(join(root, '.research/experiments/EXP-0001/reviews/fixture-report.md'), 'tampered report');
  assert.throws(() => assertExecutionReady(root), /evidence|report|hash/);
});
test('a fresh independent re-review can revoke a PASS before execution', () => {
  const root = ready();
  recordReview(root, 'CHANGES_REQUIRED', 'deepseek/deepseek-v4-pro', 'found a defect', evidence(root, { verdict: 'CHANGES_REQUIRED' }));
  assert.equal(state(root).workflow_state, 'IMPLEMENTATION_REVISION');
  assert.throws(() => assertExecutionReady(root), /PASS review/);
});
test('starting a new review clears the old PASS immediately', () => {
  const root = ready(); reopenReview(root, 'audit found a concern');
  assert.equal(state(root).workflow_state, 'CODE_REVIEW');
  assert.equal(state(root).reviewed_commit, null);
  assert.throws(() => assertExecutionReady(root), /PASS review/);
});
test('actual forbidden tools, incomplete sessions and wrong commits cannot be hidden by a PASS report', () => {
  for (const override of [{ status: 'failed' }, { implementationCommit: 'wrong' }, { model: 'deepseek/deepseek-flash' }, { initialMessageCount: 4 }]) {
    const root = implementation();
    assert.throws(() => recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'summary', evidence(root, override)), /review evidence/);
  }
  const root = implementation(), path = evidence(root);
  const receipt = JSON.parse(readFileSync(join(root, path), 'utf8'));
  const eventPath = join(root, receipt.eventsPath), events = readFileSync(eventPath, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  events.splice(2, 0, { type: 'tool_execution_start', toolName: 'bash' });
  const text = events.map(e => JSON.stringify(e)).join('\n') + '\n'; writeFileSync(eventPath, text);
  receipt.eventsSha256 = createHash('sha256').update(text).digest('hex'); receipt.toolCalls = ['read', 'bash'];
  writeFileSync(join(root, path), JSON.stringify(receipt));
  assert.throws(() => recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'summary', path), /unexpected tool/);
});
test('a thinking suffix cannot turn the worker into an independent reviewer', () => {
  const root = implementation();
  assert.throws(() => recordReview(root, 'PASS', 'openrouter/deepseek/deepseek-flash:high', 'summary'), /different concrete model/);
});
test('RUN.json edits are rejected by check-run before launch', () => {
  const root = ready(); writeFileSync(join(root, '.research/experiments/EXP-0001/RUN.json'), '{"command":["false"]}');
  assert.throws(() => assertExecutionReady(root), /RUN.json changed/);
});
test('localized pending results cannot be mistaken for completed analysis', async () => {
  const root = ready();
  await runExperiment(root);
  assert.match(readFileSync(join(root, '.research/experiments/EXP-0001/RESULTS.md'), 'utf8'), /待填写（Pending\.）/);
  assert.throws(() => recordDecision(root, 'CONTINUE', '测试占位内容检查'), /RESULTS.md must contain analysis/);
  assert.equal(state(root).workflow_state, 'ANALYSIS');
});
const cli = fileURLToPath(new URL('../scripts/research-workflow.mjs', import.meta.url));
async function until(predicate, message, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (predicate()) return; await new Promise(r => setTimeout(r, 20)); }
  assert.fail(message);
}
function launch(root) {
  const child = spawn(process.execPath, [cli, 'run'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', c => { output += c; }); child.stderr.on('data', c => { output += c; });
  const completed = new Promise(resolve => child.on('exit', (code, signal) => resolve({ code, signal, output })));
  return { child, completed };
}
test('RUNNING and live logs are visible; a duplicate launch preserves the first run', async () => {
  const root = ready([process.execPath, '-e', 'console.log("started");console.error("live stderr");setTimeout(()=>console.log("finished"),1800)']);
  const { child, completed } = launch(root);
  try {
    await until(() => state(root).workflow_state === 'RUNNING', 'run never published RUNNING');
    await until(() => existsSync(join(root, 'outputs/EXP-0001/stdout.log')) && readFileSync(join(root, 'outputs/EXP-0001/stdout.log'), 'utf8').includes('started'), 'stdout was buffered until exit');
    await until(() => readFileSync(join(root, 'outputs/EXP-0001/stderr.log'), 'utf8').includes('live stderr'), 'stderr not streamed');
    assert.throws(() => execFileSync(process.execPath, [cli, 'run'], { cwd: root, stdio: 'pipe' }), /Command failed/);
    assert.match(readFileSync(join(root, 'outputs/EXP-0001/stdout.log'), 'utf8'), /started/);
    assert.equal((await completed).code, 0);
    assert.equal(state(root).workflow_state, 'ANALYSIS');
    assert.match(readFileSync(join(root, 'outputs/EXP-0001/stdout.log'), 'utf8'), /finished/);
  } finally { if (child.exitCode === null) child.kill('SIGTERM'); }
});
test('recovery refuses an active owner and closes a dead-owner stale lock without rerunning', () => {
  const root = ready(), lock = join(root, '.research/run.lock');
  writeFileSync(lock, JSON.stringify({ pid: process.pid, runId: 'stale-fixture', experimentId: 'EXP-0001' }));
  assert.throws(() => recoverRun(root, 'fixture'), /still alive/);
  // Obtain a genuinely exited process ID rather than guessing an unused PID.
  const childPid = Number(execFileSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' }).trim());
  writeFileSync(lock, JSON.stringify({ pid: childPid, runId: 'stale-fixture', experimentId: 'EXP-0001' }));
  recoverRun(root, 'fixture owner was interrupted');
  assert.equal(state(root).workflow_state, 'EXECUTION_FAILED');
  assert.equal(existsSync(lock), false);
  assert.equal(existsSync(join(root, 'outputs/EXP-0001/stdout.log')), false);
});
test('missing executable and a terminated runner leave honest failure records', async () => {
  const missing = ready(['/nonexistent/research-executable']);
  const absent = launch(missing); assert.notEqual((await absent.completed).code, 0);
  assert.equal(state(missing).execution_status, 'failed');
  assert.match(readFileSync(join(missing, 'outputs/EXP-0001/stderr.log'), 'utf8'), /ENOENT/);
  const root = ready([process.execPath, '-e', 'console.log("started");setInterval(()=>{},1000)']);
  const running = launch(root);
  try {
    await until(() => state(root).workflow_state === 'RUNNING', 'run never started');
    running.child.kill('SIGTERM');
    assert.notEqual((await running.completed).code, 0);
    assert.equal(state(root).execution_status, 'failed');
    assert.match(readFileSync(join(root, '.research/experiments/EXP-0001/EXECUTION.md'), 'utf8'), /SIGTERM/);
  } finally { if (running.child.exitCode === null) running.child.kill('SIGKILL'); }
});
