import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { rolePolicy } from './research-roles.mjs';

export const REVIEW_TOOLS = ['read', 'grep', 'find', 'ls'];
export const digest = value => createHash('sha256').update(value).digest('hex');
export const concreteModel = model => String(model ?? '').trim().toLowerCase().replace(/^openrouter\//, '').replace(/:(off|minimal|low|medium|high|xhigh|max)$/, '');
const sameTools = tools => Array.isArray(tools) && tools.length === REVIEW_TOOLS.length && REVIEW_TOOLS.every(t => tools.includes(t));
const field = (text, name) => text.replace(/[`*]/g, '').match(new RegExp(`^${name}:\\s*(.+)$`, 'mi'))?.[1].trim();
export function evidenceFile(root, path) {
  if (typeof path !== 'string' || !path) throw new Error('review evidence path required');
  const absolute = realpathSync(resolve(root, path));
  const rel = relative(realpathSync(root), absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('review evidence must remain inside the project');
  return absolute;
}

export function validateReviewEvidence(root, state, path, verdict, model) {
  if (!path) throw new Error('captured review evidence is required (pass the receipt path)');
  const receipt = JSON.parse(readFileSync(evidenceFile(root, path), 'utf8'));
  const policy = rolePolicy(root, 'independent-code-reviewer');
  const expected = { experimentId: state.current_experiment, implementationCommit: state.implementation_commit, planCommit: state.approved_plan_commit, planSha256: state.approved_plan_sha256 };
  for (const [key, value] of Object.entries(expected)) if (receipt[key] !== value) throw new Error(`review evidence ${key} mismatch`);
  if (receipt.version !== 1 || receipt.status !== 'completed' || !receipt.sessionId || receipt.thinking !== policy.thinking || receipt.requestedThinking !== policy.thinking || receipt.role !== policy.role || receipt.initialMessageCount !== 0) throw new Error('review evidence must be a completed fresh session with the configured thinking policy');
  if (concreteModel(model) !== concreteModel(policy.model)) throw new Error('review evidence model does not match configured reviewer');
  if (!sameTools(receipt.activeTools) || concreteModel(receipt.model) !== concreteModel(model)) throw new Error('review evidence model or active tools mismatch');
  const report = readFileSync(evidenceFile(root, receipt.reportPath), 'utf8');
  const eventText = readFileSync(evidenceFile(root, receipt.eventsPath), 'utf8');
  if (digest(report) !== receipt.reportSha256 || digest(eventText) !== receipt.eventsSha256) throw new Error('review evidence report/events hash mismatch');
  const events = eventText.trim().split('\n').map(l => JSON.parse(l));
  const start = events[0];
  if (start.type !== 'research_review_start' || start.sessionId !== receipt.sessionId || !sameTools(start.activeTools) || concreteModel(start.model) !== concreteModel(model) || start.thinking !== policy.thinking || start.requestedThinking !== policy.thinking || start.role !== policy.role || start.initialMessageCount !== 0) throw new Error('review evidence session start mismatch');
  for (const [key, value] of Object.entries(expected)) if (start[key] !== value) throw new Error(`review evidence event ${key} mismatch`);
  const calls = events.filter(e => e.type === 'tool_execution_start').map(e => e.toolName);
  if (calls.some(name => !REVIEW_TOOLS.includes(name)) || JSON.stringify(calls) !== JSON.stringify(receipt.toolCalls)) throw new Error('review evidence contains unexpected tool calls');
  const replies = events.filter(e => e.type === 'message_end' && e.message?.role === 'assistant').map(e => e.message);
  const last = replies.at(-1);
  if (!last || last.stopReason !== 'stop' || events.at(-1).type !== 'agent_end') throw new Error('review evidence is aborted, truncated, or incomplete');
  if (concreteModel(`${last.provider}/${last.model}`) !== concreteModel(model)) throw new Error('review evidence response model mismatch');
  const finalText = last.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
  if (finalText !== report || field(report, 'Verdict') !== verdict || field(report, 'Experiment') !== state.current_experiment || field(report, 'Reviewed commit') !== state.implementation_commit || concreteModel(field(report, 'Reviewer model')) !== concreteModel(model)) throw new Error('review evidence report verdict/commit/model mismatch');
  return receipt;
}

// Trusted host-side capture. Reviewer tools cannot write these artifacts.
// Receipts are audit records, not an OS sandbox or cryptographic attestation.
export function captureReview(root, state, session, model) {
  if (session.agent.state.messages.length !== 0) throw new Error('independent review requires a fresh session; do not reuse a thread');
  const id = randomUUID();
  const directory = `.research/experiments/${state.current_experiment}/reviews`;
  mkdirSync(join(root, directory), { recursive: true });
  const receiptPath = `${directory}/${id}.json`, reportPath = `${directory}/${id}.md`, eventsPath = `${directory}/${id}.events.jsonl`;
  const start = { type: 'research_review_start', role: 'independent-code-reviewer', experimentId: state.current_experiment, implementationCommit: state.implementation_commit, planCommit: state.approved_plan_commit, planSha256: state.approved_plan_sha256, model, requestedThinking: session.thinkingLevel, thinking: session.thinkingLevel, activeTools: session.getActiveToolNames(), sessionId: session.sessionManager.getSessionId(), initialMessageCount: 0 };
  const events = [start];
  let last, invalid = false, saved = false;
  const save = completed => {
    if (saved) return;
    saved = true;
    const report = last?.content?.filter(c => c.type === 'text').map(c => c.text).join('\n') ?? '';
    const text = events.map(e => JSON.stringify(e)).join('\n') + '\n';
    writeFileSync(join(root, reportPath), report);
    writeFileSync(join(root, eventsPath), text);
    writeFileSync(join(root, receiptPath), JSON.stringify({ version: 1, ...start, type: undefined, status: completed && !invalid && last?.stopReason === 'stop' ? 'completed' : 'failed', reportPath, reportSha256: digest(report), eventsPath, eventsSha256: digest(text), toolCalls: events.filter(e => e.type === 'tool_execution_start').map(e => e.toolName) }, null, 2) + '\n');
  };
  session.subscribe(event => {
    if (event.type === 'tool_execution_start') {
      invalid ||= !REVIEW_TOOLS.includes(event.toolName);
      events.push({ type: event.type, toolName: event.toolName, args: event.args });
    } else if (event.type === 'tool_execution_end') {
      events.push({ type: event.type, toolName: event.toolName, isError: event.isError, result: event.result });
    } else if (event.type === 'message_end') {
      const msg = event.message;
      const clean = { ...msg, content: Array.isArray(msg.content) ? msg.content.filter(c => c.type !== 'thinking') : msg.content };
      events.push({ type: event.type, message: clean });
      if (msg.role === 'assistant') last = clean;
    } else if (event.type === 'agent_end') {
      invalid ||= !sameTools(session.getActiveToolNames());
      events.push({ type: 'agent_end' }); save(true);
    }
  });
  return { receiptPath, failed: () => save(false) };
}
