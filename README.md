# mako-ai-claude-manager

多项目并行的全链路 Agent 工作流系统。基于 Claude Code 原生 Agent + Skill 能力，用 Linear 做状态总线、Vercel 做部署平台，支持最多 5 个项目同时运行。

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
  │ Claude Code │ │ Claude Code │ │ Claude Code │
  │ --agent     │ │ --agent     │ │ --agent     │
  │ project-lead│ │ project-lead│ │ project-lead│
  └─────┬────┘    └─────┬────┘    └─────┬────┘
        │                │                │
        │  Skill 调用    │  Agent 调用    │
        ▼                ▼                ▼
  ┌─────────────────────────────────────────────┐
  │           Linear（唯一真相源）                │
  │   主任务 8 态 / 子任务 3 态 / 产物评论       │
  └─────────────────────────────────────────────┘
        │
        │  Phase Skills (context: fork)
        │  + Agent("repo-worker") 并发
        ▼
  ┌─────────────────────────────────────────────┐
  │  project-lead  ──→  Skill (fork 隔离)       │
  │    research-phase  ─ PRD/TRD/Task 拆分      │
  │    test-phase      ─ 回归测试               │
  │    release-phase   ─ 生产发布               │
  │    report-phase    ─ 终报汇总               │
  │                                             │
  │  project-lead  ──→  Agent (sub-agent)       │
  │    repo-worker     ─ 单 Task 代码执行       │
  │    web-researcher  ─ 网络搜索               │
  └─────────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────┐
  │           Vercel（部署平台）                  │
  │   Preview 部署（per-PR 隔离）                │
  │   Production 部署（需 Human 授权）           │
  └─────────────────────────────────────────────┘
```

## 核心设计

**Claude Code = Orchestrator**。不依赖外部脚本做状态机，Claude Code 主会话本身就是调度者：

- **project-lead agent**：唯一入口，负责读 Linear 状态、决定下一步、派发任务
- **Phase Skills**：定义各阶段的工作流和约束（`context: fork` 隔离执行）
- **Sub-agents**：执行具体任务的子代理（repo-worker、test-agent 等）
- **Linear MCP**：状态读写 + 产物归档

状态机逻辑分散在 Skill 文件里，project-lead 只做"读状态 → 调 Skill/Agent → 写状态"的循环。

## 项目结构

```
├── COWORK_INSTRUCTIONS.md              # 系统级设计文档（状态机、角色、规则）
├── README.md
└── .claude/
    ├── agents/                         # Agent 定义（3 个）
    │   ├── project-lead.md             # 唯一入口（项目组长）
    │   ├── repo-worker.md              # 单 Task 代码执行
    │   └── web-researcher.md           # 网络搜索
    └── skills/                         # 阶段性工作流 Skill（5 个）
        ├── research-phase/SKILL.md     # 调研阶段（PRD + TRD + 拆 Task）
        ├── dev-dispatch/SKILL.md       # 开发派发（单 sub-task 执行）
        ├── test-phase/SKILL.md         # 测试阶段
        ├── release-phase/SKILL.md      # 发布阶段
        └── report-phase/SKILL.md       # 终报阶段
```

## 状态机

主任务 8 态：

```
待启动 ──Human──▶ 调研中 ──Skill──▶ 待开发 ──Human──▶ 开发中
                                             │
                                             ▼
                                          待测试 ──Skill──▶ 测试中
                                             │           ▲
                                             │           │ 有 Bug → 回开发中
                                             ▼
                                          待发布 ──Human──▶ 发布中
```

子任务 3 态：`Todo → In Progress → Done`

## 自动化程度

### 完全自动化（Agent / Skill 自行完成）
- PRD / TRD / 设计稿生成（research-phase skill）
- Task 拆分与子任务创建
- 代码执行（repo-worker sub-agent 并发）
- 测试执行（test-phase skill）
- Preview 部署触发

### Human 强校验（Agent 不能代行）
- 项目启动决策（待启动 → 调研中）
- 设计稿 / Task 拆分放行（待开发 → 开发中）
- 生产上线决策（待发布 → 发布中）
- 回滚操作
- PRD 非目标段修改

## 快速开始

```bash
# 前置条件：已安装 Claude Code CLI，已配置 Linear MCP

# 启动单个项目
claude --agent project-lead

# 组长会自动：
# 1. 从 Linear 读取当前 issue 状态
# 2. 根据状态调用对应的 Phase Skill 或 Sub-agent
# 3. 更新 Linear 状态
# 4. 循环直到需要 Human 介入

# 多项目并行 = 多个独立会话
# 每个会话绑定一个 Linear issue
```

## 文档

详细设计参见 [COWORK_INSTRUCTIONS.md](./COWORK_INSTRUCTIONS.md)（v0.3）。
