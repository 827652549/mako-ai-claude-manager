---
name: research-phase
description: 需求调研阶段。从需求背景产出 PRD + TRD + Task 拆分，全部写入 Linear。
context: fork
user-invocable: false
allowed-tools:
  - WebSearch
  - mcp__linear__get_issue
  - mcp__linear__save_comment
  - mcp__linear__list_comments
---

# Research Phase — 调研阶段

你正在执行需求调研阶段。从 Linear issue 的需求背景出发，产出完整的 PRD、TRD 和 Task 拆分。

## 输入

从父线程传入的上下文：
- Linear issue ID 和标题
- 需求/技改背景描述
- 仓库路径（如适用）

## 流程

### 1. 判定分支

读取 Linear issue 描述，判定是**需求**还是**技改**：

- **分支 A · 需求**：触发器是用户行为/业务指标问题（"用户做不到 X"、"转化率低于 Y"）
  → 走 PRD → TRD → Task 拆分
- **分支 B · 技改**：触发器是工程指标问题（"P95 > 800ms"、"构建时间超过 10 分钟"）
  → 直接走 TRD → Task 拆分

**判定不清** → 在 Linear 写评论说明需要澄清的点，不要硬猜。

### 2a. 分支 A：生成 PRD

按以下 4 段结构生成 PRD，写入 Linear 评论（前缀 `**📋 PRD Agent**`）：

#### 主语
使用"用户"作为主语。

#### 问题语言
用"用户做不到 X"的句式描述问题。

#### 非目标价值（Non-Goals）
显式列出本期不做什么、为什么不做。这一段是给仓库架构 Agent 戴的笼头——任何"顺手优化一下"的代码改动若未列入目标段，必须由 Human 单独提一个新主任务。

#### 验收标准
用用户行为 / 业务指标描述。必须可观测、可埋点。"体验更好"这种话不接受。

**禁止**：写技术方案、指定技术栈、库版本、表结构。

### 2b. 分支 B：生成 TRD

直接产出 TRD，写入 Linear 评论（前缀 `**📋 TRD Agent**`）：

- 主语：系统 / 工程
- 问题语言："指标超过阈值 Y / 系统不满足约束 Z"
- 非目标价值：显式列出不优化哪些模块
- 验收标准：工程指标 / 兼容性测试用例（可跑、可量化）

### 3. Task 拆分

基于 PRD 或 TRD，产出结构化的 Task 拆分：

```json
{
  "tasks": [
    {
      "title": "Task 标题",
      "description": "Task 描述",
      "step": 1,
      "blockedBy": [],
      "acceptance": "验收标准"
    }
  ]
}
```

拆分原则：
- 依据是文件影响域 / 依赖关系，不是工作量
- 同 step 内可并发，跨 step 需串行
- 每个 Task 必须有可机器校验的验收标准

将 Task 拆分写入 Linear 评论（前缀 `**📋 Task Breakdown**`）。

### 4. 用 WebSearch 做必要调研

如有需要竞品分析、技术方案调研的环节，用 WebSearch 搜索后将结果融入 PRD/TRD。

## 产物

在 Linear 评论中落库：
1. PRD 或 TRD（一条评论）
2. Task 拆分 JSON（一条评论）
3. 调研摘要（如有 WebSearch 结果）

## 约束

- PRD 不指定技术栈、库版本、表结构
- TRD 不修改 PRD 主体目标
- 非目标段是架构的笼头 — 顺手优化 = 越权
- 验收标准必须可机器校验
- 所有产物必须写入 Linear 评论，不输出到其他地方
