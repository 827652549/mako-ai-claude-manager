---
name: report-phase
description: 终报阶段。汇总所有阶段产物，生成项目终报写入 Linear。
context: fork
user-invocable: false
allowed-tools:
  - mcp__linear__get_issue
  - mcp__linear__list_comments
  - mcp__linear__save_comment
---

# Report Phase — 终报阶段

你正在汇总项目全链路产物，生成终报。

## 输入

从父线程传入的上下文：
- Linear issue ID

## 流程

### 1. 收集产物

从 Linear 评论时间线中提取各阶段产物：
- PRD / TRD
- Task 拆分
- 代码变更摘要（各子任务评论）
- 测试报告
- 发布记录

### 2. 生成终报

按以下结构生成终报：

```markdown
**📊 项目终报**

## 项目概况
- 主任务: {title}
- 周期: {起始时间} → {完成时间}

## 需求 & 设计
{PRD/TRD 摘要}

## 执行概况
- 子任务总数: {count}
- 完成: {done} | 失败: {failed}
- 变更文件: {file count}

## 测试结果
{测试报告摘要}

## 发布状态
{发布记录}

## 关键决策
{Human 在各校验点的决策记录}
```

### 3. 写入 Linear

将终报写入 Linear 评论（前缀 `**📊 终报**`）。

## 约束

- 终报是对已有产物的汇总，不产出新的业务结论
- 如实反映各阶段结果，包括失败和回退
- 不修改任何已有的 Linear 评论
