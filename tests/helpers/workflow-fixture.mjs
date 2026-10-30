import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createExperiment, submitPlan, reviewPlan, recordImplementation, recordReview } from '../../scripts/research-workflow.mjs';

const hash = text => createHash('sha256').update(text).digest('hex');
export function installFixturePolicy(root) {
  mkdirSync(join(root, '.pi/agents'), { recursive: true });
  writeFileSync(join(root, '.pi/agents/independent-code-reviewer.md'), '---\nmodel: deepseek/deepseek-v4-pro\nthinking: low\ntools: read, grep, find, ls\n---\nSynthetic test policy (not used for real model calls).\n');
}
export function fixture(command = ['node', '-e', 'console.log(1)']) {
  const root = mkdtempSync(join(tmpdir(), 'research-hardening-'));
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test']);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  createExperiment(root, 'EXP-0001');
  installFixturePolicy(root);
  const sections = ['Scientific question', 'Hypothesis', 'Mechanism', 'Related work and novelty', 'Design', 'Baseline and controls', 'Metrics', 'Expected results', 'Falsification criteria', 'Cost and risks'];
  writeFileSync(join(root, '.research/experiments/EXP-0001/PLAN.md'), sections.map(s => `## ${s}\nConcrete fixture content.\n`).join('\n'));
  writeFileSync(join(root, '.research/experiments/EXP-0001/RUN.json'), JSON.stringify({ command }));
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'plan']);
  return root;
}
export function state(root) {
  return Object.fromEntries(readFileSync(join(root, '.research/STATE.md'), 'utf8').split('\n').filter(l => /^[a-z0-9_]+:/.test(l)).map(l => {
    const split = l.indexOf(':'); const value = l.slice(split + 1).trim();
    try { return [l.slice(0, split), JSON.parse(value)]; } catch { return [l.slice(0, split), value]; }
  }));
}
export function implementation(command, setup = () => {}) {
  const root = fixture(command);
  submitPlan(root); reviewPlan(root, 'APPROVE', 'human', 'fixture foreground approval');
  writeFileSync(join(root, 'experiment.py'), 'print(1)\n');
  setup(root);
  execFileSync('git', ['-C', root, 'add', '.']); execFileSync('git', ['-C', root, 'commit', '-qm', 'implementation']);
  recordImplementation(root, 'deepseek/deepseek-flash');
  return root;
}
// These receipts are controlled fixture data, not claimed model reviews.
export function evidence(root, overrides = {}) {
  const s = state(root), directory = '.research/experiments/EXP-0001/reviews';
  mkdirSync(join(root, directory), { recursive: true });
  const model = overrides.model ?? 'deepseek/deepseek-v4-pro', verdict = overrides.verdict ?? 'PASS';
  const report = `Verdict: ${verdict}\nExperiment: EXP-0001\nReviewed commit: ${s.implementation_commit}\nReviewer model: ${model}\nFindings: None\nEvidence: fixture\nRequired changes: None\n`;
  const activeTools = ['read', 'grep', 'find', 'ls'];
  const start = { type: 'research_review_start', role: 'independent-code-reviewer', experimentId: s.current_experiment, implementationCommit: s.implementation_commit, planCommit: s.approved_plan_commit, planSha256: s.approved_plan_sha256, model, requestedThinking: 'low', thinking: 'low', activeTools, sessionId: 'fixture-session', initialMessageCount: 0 };
  const events = [start, { type: 'tool_execution_start', toolName: 'read' }, { type: 'message_end', message: { role: 'assistant', provider: 'deepseek', model: model.split('/').at(-1), stopReason: 'stop', content: [{ type: 'text', text: report }] } }, { type: 'agent_end' }].map(x => JSON.stringify(x)).join('\n') + '\n';
  const reportPath = `${directory}/fixture-report.md`, eventsPath = `${directory}/fixture-events.jsonl`, receiptPath = `${directory}/fixture-receipt.json`;
  writeFileSync(join(root, reportPath), report); writeFileSync(join(root, eventsPath), events);
  writeFileSync(join(root, receiptPath), JSON.stringify({ version: 1, ...start, type: undefined, status: 'completed', reportPath, reportSha256: hash(report), eventsPath, eventsSha256: hash(events), toolCalls: ['read'], ...overrides }));
  return receiptPath;
}
export function ready(command) {
  const root = implementation(command);
  recordReview(root, 'PASS', 'deepseek/deepseek-v4-pro', 'fixture review', evidence(root));
  return root;
}
