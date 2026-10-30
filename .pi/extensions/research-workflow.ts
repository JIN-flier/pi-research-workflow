import { readFileSync } from 'node:fs';
// Match upstream's native ESM entry point. Static imports are rewritten by
// Pi's TS loader and can create a second compiled-plugin module graph.
const host = await import('@earendil-works/pi-coding-agent');
const workflow = await import('../npm/node_modules/@quintinshaw/pi-dynamic-workflows/dist/pi-extension.js');
const { createWorkflowSessionFactory } = await import('../../scripts/pi-workflow-session.mjs');

// One tracked entry point, using the same supported host-factory seam as the
// upstream entry point. No mutation of installed or globally shared packages.
const manifest = JSON.parse(readFileSync(new URL('../npm/node_modules/@quintinshaw/pi-dynamic-workflows/package.json', import.meta.url), 'utf8'));
if (manifest.version !== '3.14.0') throw new Error('Revalidate the research SDK adapter before changing pi-dynamic-workflows version');
workflow.installHostCreateAgentSession(createWorkflowSessionFactory(host.createAgentSession, host), host);
workflow.installHostSessionCapture(host.AgentSession);
export default workflow.default;
