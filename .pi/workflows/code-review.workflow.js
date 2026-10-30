export const meta = {
  name: 'research_code_review',
  description: 'Independent review with host-captured SDK tools and session evidence',
  phases: [{ title: 'Independent review' }],
};

for (const field of ['experimentId', 'implementationCommit', 'planCommit', 'planSha256', 'diffPath']) {
  if (typeof args?.[field] !== 'string' || !args[field]) throw new Error(`missing ${field}`);
}
phase('Independent review');
const report = await agent(
  `Review ${args.experimentId}, exact implementation commit ${args.implementationCommit}. ` +
  `Approved plan commit ${args.planCommit}, SHA256 ${args.planSha256}. ` +
  `Read .research/PROJECT.md, .research/STATE.md and .research/experiments/${args.experimentId}/PLAN.md, RUN.json, IMPLEMENTATION.md. ` +
  `Read the complete exact diff at ${args.diffPath} and relevant source/tests with verified line offsets. ` +
  'Inspect correctness, mathematics, scope, leakage, metrics, reproducibility and data-loader smoke evidence. ' +
  'Use only your four read-only tools. Return PASS only if no blocking defect exists; distinguish optional observations. ' +
  'Return the exact standalone headers specified by the role and host. Never claim command execution you did not perform.',
  { agentType: 'independent-code-reviewer', model: 'deepseek/deepseek-v4-pro', thinking: 'high', isolation: false, label: 'independent-review' },
);
if (!report) throw new Error('review returned no evidence; leave code review pending');
return { experimentId: args.experimentId, implementationCommit: args.implementationCommit, report };
