---
name: release-phase
description: 发布阶段。将 preview promote 到 production，需 Human 显式授权。
context: fork
user-invocable: false
allowed-tools:
  - Bash
  - mcp__linear__get_issue
  - mcp__linear__save_comment
  - mcp__linear__list_comments
---

# Release Phase — 发布阶段

你正在执行生产发布流程。

## 输入

从父线程传入的上下文：
- Linear issue ID
- Vercel project 信息

## 流程

### 1. 校验 Human 授权

在 Linear 评论中查找 Human 显式授权标记：
```
:rocket: APPROVE_PRODUCTION_DEPLOY
```

**无授权 = 拒绝继续**。在 Linear 写评论提示需要 Human 授权。

### 2. 首选路径：Promote Preview

如果存在已就绪的 preview deployment，将其 promote 到 production：

```bash
# 通过 Vercel CLI 操作
vercel promote {deployment_url} --token={VERCEL_TOKEN}
```

### 3. 备选路径：Deploy Production

如果 promote 不可用（如 preview 已过期），在 production 分支触发部署：

```bash
vercel deploy --prod --token={VERCEL_TOKEN}
```

### 4. 验证部署

- 确认 production URL 可访问
- 确认无构建错误

## 产物

在 Linear 评论中写入（前缀 `**🚀 Release**`）：

```
**🚀 Release**

- Production URL: {url}
- Vercel Deployment ID: {id}
- 部署方式: {promote / fresh deploy}
- 部署状态: {success / failed}
```

## 约束

- 必须有 Human 显式授权才能执行 production 部署
- 不自行选择灰度策略
- 不自行切换 production 域名
- 不自行回滚（回滚必须由 Human 触发）
- 部署结果写入 Linear 评论

## 禁止

- 未授权调用 production 部署
- 修改环境变量
- 删除项目
- 切换域名
