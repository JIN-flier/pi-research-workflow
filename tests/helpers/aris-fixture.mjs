import { mkdtempSync, cpSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { prepareInvocation } from '../../scripts/aris-adapter.mjs';
const project = fileURLToPath(new URL('../..', import.meta.url));
export function auditFixture(name = 'experiment-audit') {
  const root = mkdtempSync(join(tmpdir(), 'aris-audit-'));
  mkdirSync(join(root, '.pi/vendor'), { recursive: true });
  cpSync(join(project, '.pi/aris'), join(root, '.pi/aris'), { recursive: true });
  cpSync(join(project, '.pi/agents'), join(root, '.pi/agents'), { recursive: true });
  cpSync(join(project, '.pi/vendor/aris'), join(root, '.pi/vendor/aris'), { recursive: true });
  mkdirSync(join(root, '.research'), { recursive: true });
  writeFileSync(join(root, '.research/STATE.md'), 'workflow_state: ANALYSIS\ncurrent_experiment: null\n');
  writeFileSync(join(root, '.research/PROJECT.md'), '# 合成科研输入\n');
  writeFileSync(join(root, 'eval.py'), 'print("synthetic fixture")\n');
  const prepared = prepareInvocation(root, `aris-${name}`, { arguments: '独立检查原始评估文件。', inputPaths: ['eval.py'] });
  return { root, prepared };
}
