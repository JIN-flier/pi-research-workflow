import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { captureAudit, validateAuditEvidence, killArgumentVerdict } from '../scripts/aris-audit-evidence.mjs';
import { auditFixture } from './helpers/aris-fixture.mjs';

function exercise({ name, stopReason = 'stop', forbidden = false, model = 'deepseek-v4-pro', scope = true, fail = false, slot = 'review', fixture, partial = false, paged = false, contradiction = false } = {}) {
  const { root, prepared } = fixture ?? auditFixture(name);
  const callbacks = new Set();
  const session = { agent: { state: { messages: [] } }, model: { provider: 'deepseek', id: 'deepseek-v4-pro' }, thinkingLevel: 'high', getActiveToolNames: () => ['read', 'grep', 'find', 'ls'], sessionManager: { getSessionId: () => `synthetic-${slot}` }, subscribe: cb => { callbacks.add(cb); return () => callbacks.delete(cb); } };
  const capture = captureAudit(root, prepared.invocationPath, slot, session, 'high');
  const emit = event => { for (const cb of callbacks) cb(event); };
  const kill = prepared.skill === 'aris-kill-argument';
  const details = kill ? slot === 'attack' ? { attack_memo: '合成攻击原文。' } : { decomposed_points: [{ id: 'P1', verdict: contradiction ? 'still_unresolved' : 'answered_by_current_text', severity_if_unresolved: 'critical' }], counts: { answered_by_current_text: contradiction ? 0 : 1, partially_answered: 0, still_unresolved: contradiction ? 1 : 0 } } : { scientific_verdict: '原始科学结论保留在此' };
  const report = JSON.stringify({ audit_skill: prepared.skill.slice(5), invocation_id: prepared.id, slot, ...(!kill || contradiction ? { verdict: 'PASS' } : {}), scope_complete: scope, summary: '合成离线审计，仅验证凭据机制。', details });
  const paths = ['eval.py', prepared.upstreamPath, ...(slot === 'review' && name === 'kill-argument' ? [`${prepared.outputDirectory}/attack.md`] : [])];
  for (const path of paths) {
    const toolName = forbidden ? 'bash' : 'read';
    const text = readFileSync(join(root, path), 'utf8');
    if (paged) {
      const lines = text.split('\n');
      for (let start = 0; start < lines.length; start += 10) {
        const id = `${path}-${start}`;
        const chunk = lines.slice(start, start + 10).join('\n');
        emit({ type: 'tool_execution_start', toolName, toolCallId: id, args: { path, offset: start + 1, limit: 10 } });
        emit({ type: 'tool_execution_end', toolName, toolCallId: id, isError: false, result: { content: [{ type: 'text', text: chunk }], details: { truncation: { truncated: start + 10 < lines.length, outputLines: Math.min(10, lines.length - start) } } } });
      }
      continue;
    }
    emit({ type: 'tool_execution_start', toolName, toolCallId: path, args: { path, ...(partial ? { limit: 1 } : {}) } });
    emit({ type: 'tool_execution_end', toolName, toolCallId: path, isError: false, result: { content: [{ type: 'text', text: partial ? text.split('\n')[0] : text }] } });
  }
  emit({ type: 'message_end', message: { role: 'assistant', provider: 'deepseek', model, stopReason, content: [{ type: 'text', text: report }] } });
  if (fail) capture.failed(); else emit({ type: 'agent_end' });
  return { root, prepared, capture };
}

test('research audit keeps PASS separate from same-family provisional acceptance and local code gate', () => {
  const { root, prepared } = exercise();
  const result = validateAuditEvidence(root, prepared.invocationPath);
  assert.equal(result.status, 'verified');
  assert.equal(result.reviews[0].verdict, 'PASS');
  assert.equal(result.reviews[0].review_independence, 'same-family');
  assert.equal(result.reviews[0].acceptance_status, 'provisional');
  assert.equal(result.reviews[0].localPolicy.upstreamAcceptanceSatisfied, false);
  assert.equal(existsSync(join(root, '.research/experiments')), false);
});
test('a partial read cannot be claimed as complete input coverage', () => {
  const { root, prepared } = exercise({ partial: true });
  assert.throws(() => validateAuditEvidence(root, prepared.invocationPath), /读取|覆盖/);
});
test('multiple bounded read pages can jointly prove full input coverage', () => {
  const { root, prepared } = exercise({ paged: true });
  assert.equal(validateAuditEvidence(root, prepared.invocationPath).status, 'verified');
});

for (const [label, options] of [['truncated', { stopReason: 'length' }], ['wrong returned model', { model: 'deepseek-flash' }], ['scope incomplete', { scope: false }], ['forbidden tool', { forbidden: true }], ['failed transport', { fail: true }]]) {
  test(`${label} cannot become a completed audit`, () => {
    const { root, prepared } = exercise(options);
    assert.throws(() => validateAuditEvidence(root, prepared.invocationPath));
  });
}
test('changed raw input, changed report or event hash invalidates the audit', () => {
  for (const file of ['eval.py', 'review.md', 'review.events.jsonl']) {
    const { root, prepared } = exercise();
    writeFileSync(join(root, file === 'eval.py' ? file : `${prepared.outputDirectory}/${file}`), 'changed');
    assert.throws(() => validateAuditEvidence(root, prepared.invocationPath));
  }
});
test('kill-argument requires attack then adjudication in different fresh sessions', () => {
  const fixture = auditFixture('kill-argument');
  assert.throws(() => exercise({ name: 'kill-argument', fixture }), /attack/);
  exercise({ name: 'kill-argument', slot: 'attack', fixture });
  exercise({ name: 'kill-argument', slot: 'review', fixture });
  const result = validateAuditEvidence(fixture.root, fixture.prepared.invocationPath);
  assert.equal(result.reviews.length, 2);
  assert.notEqual(result.reviews[0].sessionId, result.reviews[1].sessionId);
});
test('kill-argument cannot accept a self-graded PASS with an unresolved critical point', () => {
  const fixture = auditFixture('kill-argument');
  exercise({ name: 'kill-argument', slot: 'attack', fixture });
  exercise({ name: 'kill-argument', slot: 'review', fixture, contradiction: true });
  assert.throws(() => validateAuditEvidence(fixture.root, fixture.prepared.invocationPath));
});
for (const [classification, severity, expected] of [['still_unresolved', 'critical', 'FAIL'], ['still_unresolved', 'major', 'WARN'], ['partially_answered', 'critical', 'WARN'], ['partially_answered', 'minor', 'PASS'], ['answered_by_current_text', 'minor', 'PASS']]) {
  test(`kill-argument deterministically maps ${classification}/${severity} to ${expected}`, () => {
    const counts = { answered_by_current_text: 0, partially_answered: 0, still_unresolved: 0 }; counts[classification]++;
    const details = { decomposed_points: [{ id: 'P1', verdict: classification, severity_if_unresolved: severity }], counts };
    assert.equal(killArgumentVerdict(details).verdict, expected);
    details.counts[classification]++;
    assert.throws(() => killArgumentVerdict(details), /counts/);
  });
}
