---
name: Linear-triage
description: Linear Issue 批量分诊。批量获取 issue 并汇总摘要，减少 API 调用次数。
context: fork
user-invocable: true
allowed-tools:
  - mcp__linear__list_issues
  - mcp__linear__get_issue
  - mcp__linear__list_comments
---

# Linear Triage — Issue 批量分诊

你正在批量获取和整理 Linear issue 信息。

## 触发条件

- 用户需要了解多个 issue 的状态
- 用户说"帮我看看 Linear 上有什么"
- 用户提供多个 issue 编号

## 流程

### 1. 批量获取

根据用户输入决定获取范围：

- **指定编号列表**：并行调用 `get_issue`（一次性传入所有 ID）
- **按状态筛选**：用 `list_issues(state=xxx)` 一次获取
- **按项目筛选**：用 `list_issues(project=xxx)` 一次获取
- **我的待办**：用 `list_issues(assignee="me", state="unstarted|started")` 一次获取

**关键规则**：尽可能用 `list_issues` 的筛选参数一次获取，避免逐个 `get_issue`。

### 2. 汇总输出

```
## 📋 Linear Issue 分诊报告

### {筛选条件描述}（共 {N} 条）

| # | 标题 | 状态 | 优先级 | 指派人 | 更新时间 |
|---|------|------|--------|--------|----------|
| MAK-123 | 标题 | 开发中 | High | 苏一恒 | 2h前 |
| ... | ... | ... | ... | ... | ... |

### 需关注
- MAK-123: {为什么需要关注}
- MAK-456: {为什么需要关注}

### 建议行动
1. {建议先处理哪个 issue 及原因}
2. {建议哪个 issue 可以并行处理}
```

### 3. 详情展开（按需）

用户对某个 issue 感兴趣时，再单独获取其评论和子任务：
```
mcp__linear__get_issue(id="MAK-123")
mcp__linear__list_comments(issueId="MAK-123")
```

## 约束

- 单次会话对同一 issue 最多调用一次 `get_issue`
- 优先使用 `list_issues` 的筛选能力，减少 API 调用
- 输出保持简洁，详情按需展开
- 不修改任何 issue 状态或内容
