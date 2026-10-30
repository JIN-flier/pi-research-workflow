import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
const read = path => readFileSync(join(root, path), 'utf8');

test('project agent definitions name three roles and reviewer has no mutation tools', () => {
  const names = ['experiment-runner', 'implementation-worker', 'independent-code-reviewer'];
  for (const name of names) assert.match(read(`.pi/agents/${name}.md`), new RegExp(`^name: ${name}$`, 'm'));
  const reviewer = read('.pi/agents/independent-code-reviewer.md');
  assert.match(reviewer, /^tools: read, grep, find, ls$/m);
  assert.match(reviewer, /^model: openrouter\/openai\/gpt-5\.4$/m);
});

test('plan checkpoint aborts headless and maps two explicit confirmations to three outcomes', async () => {
  const source = read('.pi/workflows/plan-review.workflow.js');
  async function run(replies) {
    const calls = [];
    const context = {
      args: { experimentId: 'EXP-0001', planCommit: 'abc123', planSha256: 'hash123' },
      phase: () => {},
      checkpoint: async (prompt, options) => {
        calls.push(options);
        if (!replies.length) throw new Error('no human input');
        return replies.shift();
      },
    };
    const result = await vm.runInNewContext(`(async () => { ${source} })()`, context);
    assert.ok(calls.every(x => x.headless === 'abort' && x.default === false));
    return result.decision;
  }
  assert.equal(await run([true]), 'APPROVE');
  assert.equal(await run([false, true]), 'REJECT');
  assert.equal(await run([false, false]), 'REVISE');
  await assert.rejects(run([]), /no human input/);
});
