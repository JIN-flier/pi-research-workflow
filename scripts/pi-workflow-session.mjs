import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureReview, REVIEW_TOOLS } from './review-evidence.mjs';
import { getResearchState, reopenReview } from './research-workflow.mjs';
import { rolePolicy } from './research-roles.mjs';
import { concreteModel } from './review-evidence.mjs';

// Pi 1.4 treats customTools as additions. Restrict the initial SDK selection,
// then enforce the repository role before prompting (including store tools
// that upstream deliberately injects AFTER its tool-policy filter).
export function createWorkflowSessionFactory(createSession, sdk = {}) {
  return async options => {
    if (!Array.isArray(options.customTools)) throw new Error('workflow session requires resolved customTools');
    let tools = [...new Set(options.customTools.map(t => t.name))];
    // Pi 1.4 createCodingTools omits grep/find/ls; register those explicitly so
    // the role's complete allowlist can be activated before the first prompt.
    const registered = new Map(options.customTools.map(t => [t.name, t]));
    for (const tool of sdk.createReadOnlyTools?.(options.cwd) ?? []) if (!registered.has(tool.name)) registered.set(tool.name, tool);
    const result = await createSession({ ...options, customTools: [...registered.values()], tools: [...registered.keys()], excludeTools: [...(options.excludeTools ?? []), 'mcp__*'] });
    const { session } = result;
    session.setActiveToolsByName(tools);
    const check = () => {
      const active = session.getActiveToolNames();
      if (active.length !== tools.length || tools.some(t => !active.includes(t))) throw new Error(`workflow active tools mismatch: expected ${tools}, got ${active}`);
    };
    try { check(); } catch (error) { session.dispose(); throw error; }
    const auditDir = join(options.cwd, 'outputs/workflow-sessions');
    mkdirSync(auditDir, { recursive: true });
    const audit = role => writeFileSync(join(auditDir, `${session.sessionManager.getSessionId()}.json`), JSON.stringify({ cwd: options.cwd, role, expectedTools: tools, activeTools: session.getActiveToolNames(), model: session.model ? `${session.model.provider}/${session.model.id}` : null, requestedThinking: options.thinkingLevel, thinking: session.thinkingLevel, availableThinking: session.getAvailableThinkingLevels() }, null, 2));
    audit(null);
    const originalBind = session.bindExtensions.bind(session);
    session.bindExtensions = async (...args) => { await originalBind(...args); check(); };
    const originalPrompt = session.prompt.bind(session);
    session.prompt = async (...args) => {
      const role = String(args[0]).match(/^Research role: (implementation-worker|independent-code-reviewer|experiment-runner)\s*$/m)?.[1];
      let policy;
      if (role) {
        policy = rolePolicy(options.cwd, role);
        if (role === 'independent-code-reviewer' && (policy.tools.length !== REVIEW_TOOLS.length || REVIEW_TOOLS.some(t => !policy.tools.includes(t)))) throw new Error('reviewer policy must contain exactly the four read-only tools');
        if (concreteModel(`${session.model?.provider}/${session.model?.id}`) !== concreteModel(policy.model)) throw new Error(`research role ${role} model mismatch`);
        if (options.thinkingLevel !== policy.thinking || session.thinkingLevel !== policy.thinking) throw new Error(`research role ${role} thinking mismatch: requested ${options.thinkingLevel}, effective ${session.thinkingLevel}, policy ${policy.thinking}`);
        tools = policy.tools;
        session.setActiveToolsByName(tools);
      }
      check();
      audit(role ?? null);
      let capture;
      const root = options.cwd;
      if (role === 'independent-code-reviewer' && tools.length === REVIEW_TOOLS.length && REVIEW_TOOLS.every(t => tools.includes(t)) && existsSync(join(root, '.research/STATE.md'))) {
        let state = getResearchState(root);
        if (['CODE_REVIEW', 'READY_TO_RUN'].includes(state.workflow_state)) {
          if (state.workflow_state === 'READY_TO_RUN') { reopenReview(root, 'new independent reviewer session started'); state = getResearchState(root); }
          const model = `${session.model.provider}/${session.model.id}`;
          capture = captureReview(root, state, session, model);
          args[0] += `\n\nHost audit receipt (written automatically after this session): ${capture.receiptPath}. Return exact standalone lines Verdict:, Experiment: ${state.current_experiment}, Reviewed commit: ${state.implementation_commit}, Reviewer model: ${model}, then findings/evidence/required changes. Do not write the receipt yourself.`;
        }
      }
      try { return await originalPrompt(...args); }
      catch (error) { capture?.failed(); throw error; }
    };
    return result;
  };
}
