# 上游来源与项目接入

- 仓库：https://github.com/K-Dense-AI/scientific-agent-skills.git
- 固定上游 commit：`5f2bc0341354fd5590aef76a533ada1e1e5b4e62`
- 接入日期：2026-10-31
- 选取目录：`scientific-brainstorming`、`hypothesis-generation`、`scientific-critical-thinking`、`statistical-analysis`、`exploratory-data-analysis`
- 上游根许可证：`LICENSE.md`；每个选取的 `SKILL.md` 另有自己的 license 字段，接入前已逐项查看。

这些目录保留上游原有的 `SKILL.md`、参考资料、模板和脚本，不在此处修改上游内容。Pi 实际发现的项目 Skill 位于 `.pi/skills/`，其中同名 `SKILL.md` 是本仓库的中文阶段接入说明；只在对应阶段按需读取这里的上游文件。

未复制全部上游 Skill：当前科研项目未指定学科、数据和依赖，全部复制会增大审查与维护范围。新需求出现时，从上游明确的 commit 选择所需目录，检查该目录的许可证、依赖和与本项目关卡的兼容性，再更新此记录。上游脚本和依赖不会因文件存在而自动运行或安装。
