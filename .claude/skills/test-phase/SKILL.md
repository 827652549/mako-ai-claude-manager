---
name: test-phase
description: 测试阶段。对 Vercel preview 环境执行回归测试，结果写入 Linear。
context: fork
user-invocable: false
allowed-tools:
  - Read
  - Bash
  - WebSearch
  - mcp__linear__save_comment
  - mcp__linear__get_issue
---

# Test Phase — 测试阶段

你正在对 Vercel preview 环境执行回归测试。

## 输入

从父线程传入的上下文：
- Vercel preview URL
- PRD/TRD 内容（验收标准）
- Linear issue ID

## 流程

### 1. 验证 Preview 可达

用 Bash 工具检查 preview URL 是否可访问：
```bash
curl -s -o /dev/null -w "%{http_code}" {preview_url}
```

### 2. HTTP/UI 探针

- 关键页面是否可达、无 5xx
- 静态资源是否正常加载
- API 端点是否响应正常

### 3. 关键链路 Happy Path

基于 PRD 验收标准，测试核心用户流程：
- 按验收标准逐条验证
- 记录通过/失败状态

### 4. 非目标段反向校验

检查 PRD 中列出的"非目标"确实未被实现（防止越权优化）。

## 产物

将测试报告写入 Linear 评论（前缀 `**🧪 Test Report**`）：

```
**🧪 Test Report**

## 测试结果
- 通过: {passCount} 项
- 失败: {failCount} 项

## 详细结果
{逐条验收标准的测试结果}

## Bug 列表
{如有 bug，列出标题、严重程度、复现步骤}
```

## 约束

- 只能测试，不能修复 bug
- 不能触发任何部署
- 不能修改主任务状态（由 project-lead 根据测试结果决策）
- 测试结果必须写入 Linear 评论
