# mako-ai-claude-manager

多项目并行的全链路 Agent 工作流系统。基于 Claude Code Cowork 模式，用 Linear 做状态总线、Vercel 做部署平台，支持最多 5 个项目同时运行。

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                      Human（你）                         │
│          3 个强校验点：启动 / 放行开发 / 上线决策          │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ 项目 A   │    │ 项目 B   │    │ 项目 C   │  ...最多 5 个
  │ Orchestrator │ │ Orchestrator │ │ Orchestrator │
  │ (TS 进程) │    │ (TS 进程) │    │ (TS 进程) │
  └─────┬────┘    └─────┬────┘    └─────┬────┘
        │                │                │
        ▼                ▼                ▼
  ┌─────────────────────────────────────────────┐
  │           Linear（唯一真相源）                │
  │   主任务 8 态 / 子任务 3 态 / 产物评论       │
  └─────────────────────────────────────────────┘
        │
        │  claude -p（headless 子进程）
        ▼
  ┌─────────────────────────────────────────────┐
  │              Agent 集群（9 个角色）           │
  │                                             │
  │  PRD Agent    UX Agent     UI Agent         │
  │  仓库架构 Agent  仓库子执行 Agent             │
  │  测试 Agent   网络搜索专家                    │
  │  报告撰写研究员  报告审核编辑                  │
  └─────────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────┐
  │           Vercel（部署平台）                  │
  │   Preview 部署（per-PR 隔离）                │
  │   Production 部署（需 Human 授权）           │
  └─────────────────────────────────────────────┘
```

## 项目结构

```
├── COWORK_INSTRUCTIONS.md      # 系统级 Agent 指令（状态机、角色、规则）
├── .claude/agents/             # 9 个角色 Agent 定义（.md 文件）
│   ├── prd-agent.md            # 产品需求文档生成
│   ├── ux-agent.md             # 用户体验流程设计
│   ├── ui-agent.md             # 视觉设计方案
│   ├── repo-architect.md       # 技术方案 + Task 拆分
│   ├── repo-worker.md          # 单 Task 代码执行
│   ├── test-agent.md           # 回归测试
│   ├── web-researcher.md       # 网络搜索
│   ├── report-writer.md        # 报告撰写
│   └── report-editor.md        # 报告审核
└── orchestrator/               # TS Orchestrator 核心代码
    └── src/
        ├── index.ts            # CLI 入口
        ├── orchestrator.ts     # 状态机 + 调度器
        ├── state-machine.ts    # 8 态状态机（纯脚本判断）
        ├── claude-runner.ts    # claude -p headless 子进程管理
        ├── linear-client.ts    # Linear GraphQL API 客户端
        ├── vercel-client.ts    # Vercel REST API 客户端
        └── types.ts            # 类型定义
```

## 自动化程度

### 完全自动化（Agent 自行完成）
- PRD / TRD / 设计稿生成（PRD → UX → UI → 架构 Agent 串行）
- Task 拆分与子任务创建
- 代码执行（子执行 Agent 并发 fork）
- 测试执行（回归 + Bug 检测）
- Preview 部署触发

### Human 强校验（Agent 不能代行）
- 项目启动决策（待启动 → 调研中）
- 设计稿 / Task 拆分放行（待开发 → 开发中）
- 生产上线决策（待发布 → 发布中）
- 回滚操作
- PRD 非目标段修改

### Orchestrator 自动但需 Human 授权
- Production 部署（需要 Linear 评论中显式 `APPROVE_PRODUCTION_DEPLOY` 标记）
- 跨项目范围调整

## 状态机

主任务 8 态：

```
待启动 ──Human──▶ 调研中 ──Orchestrator──▶ 待开发 ──Human──▶ 开发中
                                              │
                                              ▼
                                           待测试 ──测试Agent──▶ 测试中
                                              │            ▲
                                              │            │ 有 Bug → 回开发中
                                              ▼
                                           待发布 ──Human──▶ 发布中
```

子任务 3 态：`Todo → In Progress → Done`

## 快速开始

```bash
cd orchestrator
bun install
bun run build

# 需要环境变量
export LINEAR_API_KEY="your-linear-api-key"
export VERCEL_TOKEN="your-vercel-token"

# 启动 Orchestrator
npx tsx src/index.ts --issue-id=<linear-issue-id> --team-id=<team-id> --repo=<path>
```

## 文档

详细设计参见 [COWORK_INSTRUCTIONS.md](./COWORK_INSTRUCTIONS.md)（v0.3）。
