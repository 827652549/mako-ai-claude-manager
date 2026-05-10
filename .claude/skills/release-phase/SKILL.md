---
name: release-phase
description: 发布阶段。合并 PR 到 main，触发 Vercel 自动部署，含并行审查流水线，需 Human 显式授权。
context: fork
user-invocable: false
allowed-tools:
  - Bash
  - Read
  - mcp__linear__get_issue
  - mcp__linear__save_comment
  - mcp__linear__list_comments
---

# Release Phase — 发布阶段

你正在执行生产发布流程。

## 输入

从父线程传入的上下文：
- Linear issue ID
- PR URL 列表（由 project-lead 从 repo-worker 产出中收集）

## 流程

### 1. 并行审查流水线

在合并 PR 之前，自动对代码变更执行三维度审查：

**维度 A：架构适配性**
- 变更是否符合项目的三层架构（UI → Services/Hooks → API）
- 是否引入了不合理的跨层调用
- 是否违反项目 CLAUDE.md 中的架构约束

**维度 B：代码质量**
- 是否有类型安全问题（`any` 类型、类型断言滥用）
- 是否有运行时风险（空值未处理、边界条件遗漏）
- 是否通过 lint 检查

**维度 C：变更完整性**
- 变更是否覆盖了 Linear issue 描述的所有要求
- 是否有遗漏的文件或场景
- 构建是否通过

输出审查摘要：
```
**🔍 发布前审查**

| 维度 | 结果 | 说明 |
|------|------|------|
| 架构适配 | ✅/⚠️/❌ | ... |
| 代码质量 | ✅/⚠️/❌ | ... |
| 变更完整性 | ✅/⚠️/❌ | ... |

结论: 🟢 可发布 / 🟡 需修复后发布 / 🔴 不可发布
```

如有 🔴 或 ⚠️，在 Linear 评论中写明问题，建议退回开发阶段修复。

### 2. 校验 Human 授权

在 Linear 评论中查找 Human 显式授权标记：
```
:rocket: APPROVE_PRODUCTION_DEPLOY
```

**无授权 = 拒绝继续**。在 Linear 写评论提示需要 Human 授权。

### 3. 校验 PR 状态

从 Linear 评论中收集所有 PR URL，逐个检查：

```bash
gh pr view {pr_url} --json state,mergeable,reviewDecision,statusCheckRollup
```

- 所有 PR 必须处于 `OPEN` 状态
- 所有 PR 必须可合并（无冲突）
- 如有 CI checks，必须全部通过

### 4. 合并 PR

按依赖顺序合并（如有 blocking 关系），否则按创建时间顺序：

```bash
gh pr merge {pr_url} --merge --delete-branch
```

合并后 Vercel 会自动触发 Production 部署。

### 5. 验证部署

等待 Vercel Production 部署完成：

```bash
vercel ls {project_name} 2>&1 | head -5
```

- 确认最新部署状态为 `● Ready`
- 确认环境为 `Production`
- 确认无构建错误

### 6. 记录 CHANGELOG

按照 `CHANGELOG_FOR_HUMAN.MD` 的维护规范，更新 changelog 记录。
（此步骤仅在有实际代码变更时执行，纯文档任务可跳过）

## 产物

在 Linear 评论中写入（前缀 `**🚀 Release**`）：

```
**🚀 Release**

## 发布前审查
{审查表格}

## 发布详情
- PR(s) 合并: {pr_urls}
- Production URL: {url}
- 部署状态: {success / failed}
- CHANGELOG: {已更新 / 跳过（无代码变更）}
```

## 约束

- 必须先通过审查流水线才能合并
- 必须有 Human 显式授权才能执行合并
- PR 未通过 checks 时拒绝合并
- 不自行选择灰度策略
- 不自行切换 production 域名
- 不自行回滚（回滚必须由 Human 触发）
- 部署结果写入 Linear 评论

## 禁止

- 未授权合并 PR
- 跳过审查流水线
- 修改环境变量
- 删除项目
- 切换域名
- force push
