// Use as the `script` of Pi's workflow tool with background: false.
// Supply args: { experimentId, planCommit, planSha256 } from STATE.md.
if (!args?.experimentId || !args?.planCommit || !args?.planSha256) throw new Error('experiment ID, plan commit and hash required');
phase('Human plan review');
const context = `${args.experimentId}, plan commit ${args.planCommit}, SHA256 ${args.planSha256}. Read PLAN.md before answering.`;
const approved = await checkpoint(`APPROVE this exact experiment plan? ${context}`, { kind: 'confirm', headless: 'abort', default: false });
if (approved === true) return { decision: 'APPROVE', experimentId: args.experimentId, planCommit: args.planCommit, planSha256: args.planSha256 };
const rejected = await checkpoint(`REJECT this experiment? Select Yes for REJECT; No for REVISE. ${context}`, { kind: 'confirm', headless: 'abort', default: false });
return { decision: rejected === true ? 'REJECT' : 'REVISE', experimentId: args.experimentId, planCommit: args.planCommit, planSha256: args.planSha256 };
