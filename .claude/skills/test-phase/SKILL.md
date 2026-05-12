---
name: test-phase
description: 测试阶段。自动执行构建验证、部署检查和 HTTP 探针，结果写入 Linear。
context: fork
user-invocable: false
allowed-tools:
  - Read
  - Bash
  - WebSearch
  - WebFetch
  - mcp__linear__save_comment
  - mcp__linear__get_issue
  - mcp__linear__list_comments
---

# Test Phase — 测试阶段

你正在执行自动化测试流程。所有检查项自动完成，不需要 Human 提供额外输入。

## 输入

从父线程传入的上下文：
- Linear issue ID（必须）
- PRD/TRD 内容（可选，用于验收标准比对）

## 流程

### 0. 解析运行环境

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
GITHUB_REMOTE=$(git remote get-url origin)
GITHUB_REPO=$(echo "$GITHUB_REMOTE" | sed -E 's#.*github\.com[:/](.+?)(\.git)?$#\1#')
```

### 1. 本地构建验证

```bash
cd "$REPO_ROOT" && bun run build
```

- 检查构建是否成功
- 记录路由数量和类型（Static / SSG / Dynamic）
- 构建失败则直接标记测试失败，跳过后续步骤

### 2. 获取 Vercel 部署信息

通过 GitHub API 获取 Preview 和 Production 部署状态：

```bash
# 获取最近的部署（Preview + Production）（$GITHUB_REPO 已在第 0 步解析）
gh api "repos/$GITHUB_REPO/deployments?per_page=5" --jq '.[] | {id, environment, ref, created_at}'

# 获取 Preview 部署状态和 URL
gh api "repos/$GITHUB_REPO/deployments/{preview_id}/statuses" --jq '.[0] | {state, target_url}'

# 获取 Production 部署状态和 URL（如已部署）
gh api "repos/$GITHUB_REPO/deployments/{prod_id}/statuses" --jq '.[0] | {state, target_url}'
```

- Preview 部署成功 → 记录 Preview URL（**必须写入最终报告**）
- Production 部署存在 → 记录 Production URL
- 部署失败 → 记录失败原因，标记测试失败
- 部署中 → 等待完成（最多 3 分钟）

### 3. HTTP 探针

对部署 URL 执行 HTTP 检查：

```bash
# 首页
curl -sL -o /dev/null -w "%{http_code}" {url}/

# 各子页面（根据项目实际情况）
curl -sL -o /dev/null -w "%{http_code}" {url}/settings
curl -sL -o /dev/null -w "%{http_code}" {url}/agents
curl -sL -o /dev/null -w "%{http_code}" {url}/skills
curl -sL -o /dev/null -w "%{http_code}" {url}/rules
```

- 200 = 通过
- 401/403 = 记录（可能是 Vercel Deployment Protection，不算失败）
- 404/5xx = 失败

### 4. 验收标准比对（如有 PRD/TRD）

- 从 PRD/TRD 中提取验收标准
- 逐条检查是否满足
- 无法自动验证的条目标记为"需人工验证"

### 5. 结果决策

- 全部通过 → 建议 project-lead 将状态改为"发布完成"
- 存在失败项 → 列出问题，建议 project-lead 保持"测试中"状态
- 构建失败 → 建议 project-lead 退回"开发中"

## 产物

将测试报告写入 Linear 评论（前缀 `**🧪 Test Report**`）：

```
**🧪 Test Report**

## 摘要
- 构建: ✅/❌
- Vercel Preview: ✅/❌
- Vercel Production: ✅/❌ / ⏳未部署
- HTTP 探针: {passCount}/{totalCount} 通过
- 验收标准: {passCount}/{totalCount} 通过

## 🔗 环境链接
- **Preview**: {preview_url}
- **Production**: {production_url}（如已部署）

## 构建详情
{构建输出摘要}

## HTTP 探针结果
| 路由 | 状态码 | 结果 |
|------|--------|------|
| / | 200 | ✅ |
| /settings | 200 | ✅ |
| ... | ... | ... |

## 验收标准
{逐条结果}

## 结论
{通过/失败，建议下一步操作}
```

## 约束

- 所有检查自动完成，不向 Human 请求输入
- 只能测试，不能修复 bug
- 不能触发任何部署
- 不能修改主任务状态（由 project-lead 根据测试结果决策）
- 测试结果必须写入 Linear 评论
- **Preview URL 和 Production URL 必须写入测试报告**，不得省略。这是 Human 审核的关键信息。
