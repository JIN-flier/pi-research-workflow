import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROLE_NAMES = ['implementation-worker', 'independent-code-reviewer', 'experiment-runner'];
export function rolePolicy(root, role) {
  if (!ROLE_NAMES.includes(role)) throw new Error(`unknown research role: ${role}`);
  const source = readFileSync(join(root, '.pi/agents', `${role}.md`), 'utf8');
  const header = source.match(/^---\n([\s\S]*?)\n---/);
  if (!header) throw new Error(`missing research role policy: ${role}`);
  const value = key => header[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim();
  const tools = value('tools')?.split(',').map(s => s.trim());
  if (!value('model') || !value('thinking') || !tools?.length || new Set(tools).size !== tools.length) throw new Error(`invalid research role policy: ${role}`);
  return { role, model: value('model'), thinking: value('thinking'), tools };
}
