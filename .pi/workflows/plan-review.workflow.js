export const meta = {
  name: 'research_plan_review',
  description: '人工审批指定实验方案及其准确版本',
  phases: [{ title: '人工方案审批' }],
};

// 作为 Pi workflow 工具的完整 script 使用，设置 background: false。
// 从 STATE.md 传入 args: { experimentId, planCommit, planSha256 }。
if (!args?.experimentId || !args?.planCommit || !args?.planSha256) throw new Error('必须提供实验 ID、方案 commit 和哈希');
phase('人工方案审批');
const context = `实验 ${args.experimentId}，方案 commit ${args.planCommit}，SHA256 ${args.planSha256}。回答前请阅读 PLAN.md。`;
const approved = await checkpoint(`是否批准（APPROVE）这一准确版本的实验方案？${context}`, { kind: 'confirm', headless: 'abort', default: false });
if (approved === true) return { decision: 'APPROVE', experimentId: args.experimentId, planCommit: args.planCommit, planSha256: args.planSha256 };
const rejected = await checkpoint(`是否否决本实验？选择“是”（Yes）表示否决（REJECT）；选择“否”（No）表示修改（REVISE）。${context}`, { kind: 'confirm', headless: 'abort', default: false });
return { decision: rejected === true ? 'REJECT' : 'REVISE', experimentId: args.experimentId, planCommit: args.planCommit, planSha256: args.planSha256 };
