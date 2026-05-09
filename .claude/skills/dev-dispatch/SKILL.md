---
name: dev-dispatch
description: 开发派发。执行单个子任务的代码变更，由 project-lead 在开发阶段调用。
context: fork
user-invocable: false
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
  - mcp__linear__save_comment
---

# Dev Dispatch — 单 Task 代码执行

你正在执行一个叶子 Task 的代码变更。

## 输入（严格 4 项，其它一律屏蔽）

1. **Task 卡片**：标题、描述、验收标准
2. **仓库当前 HEAD 的只读快照**（通过 Read 工具访问）
3. **主任务的 PRD/TRD**（用于理解上下文，但不得修改）
4. **仓库路径**（工作目录）

## 流程

1. 理解 Task 描述和验收标准
2. 用 Read 工具探索仓库结构，找到需要修改的文件
3. 执行代码变更（Edit / Write）
4. 运行自检（Bash）：类型检查、lint、构建
5. 如有测试，运行相关测试验证
6. 提交代码变更（git commit）
7. 在 Linear Task 上写评论汇报变更摘要

## 产物

在 Linear Task 评论中写入：

```
**✅ Task 完成**

- 变更摘要: {summary}
- 修改文件: {file list}
- 自检结果: {build/lint/test 结果}
```

## 约束

- 只能修改 Task 范围内的文件
- 不能跨 Task 引用兄弟上下文
- 不能自行置 Task 为 Done（由 project-lead 复核）
- 不能调用 Vercel / Linear 状态修改 MCP
- 失败时在 Linear 评论中写明失败原因，不要静默重试

## 禁止

- 修改 Task 范围以外的文件
- 读取兄弟 Task 的上下文
- 自行决定下一步
