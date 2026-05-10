# mako-ai-claude-manager

多项目并行的全链路 Agent 工作流系统。基于 Claude Code 原生 Agent + Skill 能力，用 Linear 做状态总线、Vercel 做部署平台，支持最多 5 个项目同时运行。

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                      Human（你）                         │
│          3 个强校验点：启动 / 放行开发 / 上线决策          │
│          所有操作在 Linear 中完成，无需 CLI               │
└────────────────────────┬────────────────────────────────┘
                         │ 评论 "继续" / "发布" / 创建 issue
                         ▼
┌─────────────────────────────────────────────────────────┐
│             Vercel Function（/api/webhook）              │
│   ① 签名校验（HMAC-SHA256）                              │
│   ② 指令路由（继续→advance, 发布→release, ...）          │
│   ③ 写 PENDING 标记到 Queue issue（MAK-300）            │
└────────────────────────┬────────────────────────────────┘
                         │ 🤖 ⏳ PENDING 标记
                         ▼
┌─────────────────────────────────────────────────────────┐
│           Linear（唯一真相源 + 消息总线）                  │
│   主任务 8 态 / 子任务 3 态 / 产物评论 / PENDING 队列    │
└────────────────────────┬────────────────────────────────┘
                         │ Daemon 每 60s 轮询 Queue issue
                         ▼
┌─────────────────────────────────────────────────────────┐
│              本地 Daemon（daemon.ts）                     │
│   ① 轮询 MAK-300 Queue issue 的评论                      │
│   ② 发现 PENDING → 解析目标 issue + action               │
│   ③ 通过 `claude -p` headless 执行对应工作流              │
│   ④ 结果写回目标 issue + 标记 DONE                        │
└────────────────────────┬────────────────────────────────┘
                         │ claude -p (headless)
                         ▼
┌─────────────────────────────────────────────────────────┐
│  project-lead  ──→  Skill (fork 隔离)                    │
│    research-phase  ─ PRD/TRD/Task 拆分                   │
│    test-phase      ─ 回归测试                            │
│    release-phase   ─ 生产发布                            │
│                                                         │
│  project-lead  ──→  Agent (sub-agent)                    │
│    repo-worker     ─ 单 Task 代码执行                    │
│    web-researcher  ─ 网络搜索                            │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           Vercel（部署平台）                              │
│   Preview 部署（per-PR 隔离，Git 集成自动触发）          │
│   Production 部署（PR 合并到 main 自动触发）              │
└─────────────────────────────────────────────────────────┘
```

## 端到端流程

```
1. Human 在 Linear 创建 issue（状态=调研中）
   └→ Webhook 收到事件 → 写 PENDING: research 到 Queue
   └→ Daemon 发现 → claude -p 执行调研 → PRD/TRD 写回 issue

2. Human 在 issue 下评论 "继续"
   └→ Webhook 收到事件 → 写 PENDING: advance 到 Queue
   └→ Daemon 发现 → claude -p 推进状态 → 结果写回 issue

3. Human 在 issue 下评论 "发布"
   └→ Webhook 收到事件 → 写 PENDING: release 到 Queue
   └→ Daemon 发现 → claude -p 执行发布流程 → 结果写回 issue

4. 非指令评论（普通文本）
   └→ Webhook 收到事件 → 解析为 ignore → 无动作
```

## 核心设计

**Webhook 纯中继 + 本地 Daemon 执行**。Vercel Function 只做验证和路由，不调用 Claude API：

- **api/webhook.ts**：自包含的 Vercel Function，签名校验 → 指令路由 → 写 PENDING 标记
- **daemon.ts**：本地守护进程，轮询 Queue issue（MAK-300），通过 `claude -p` 执行工作流
- **Linear MCP**：状态读写 + 产物归档
- **不需要 Anthropic API key**：Agent 执行通过本地 Claude Code CLI 完成

### API 速率限制防护

- Webhook → Queue issue 架构：daemon 每次 poll 仅 2 次 API 调用
- 60s 轮询间隔：~120 次 API 调用/小时（远低于 Linear 2500/h 限制）
- 自动检测 429 响应，等待限制重置后恢复

## 项目结构

```
├── COWORK_INSTRUCTIONS.md              # 系统级设计文档（状态机、角色、规则）
├── CHANGELOG_FOR_HUMAN.MD              # 面向人类的变更记录
├── README.md
├── api/
│   └── webhook.ts                      # Vercel Function（自包含）
├── daemon.ts                           # 本地守护进程
├── vercel.json                         # Vercel 部署配置
├── package.json                        # 依赖：@linear/sdk
├── tsconfig.json
└── .claude/
    ├── agents/                         # Agent 定义
    │   ├── project-lead.md             # 唯一入口（项目组长）
    │   ├── repo-worker.md              # 单 Task 代码执行
    │   └── web-researcher.md           # 网络搜索
    └── skills/                         # 阶段性工作流 Skill
        ├── research-phase/SKILL.md     # 调研阶段
        ├── dev-dispatch/SKILL.md       # 开发派发
        ├── test-phase/SKILL.md         # 测试阶段
        ├── release-phase/SKILL.md      # 发布阶段
        └── report-phase/SKILL.md       # 终报阶段
```

## 状态机

主任务 8 态：

```
待启动 ──Human──▶ 调研中 ──Agent──▶ 待开发 ──Human──▶ 开发中
                                             │
                                             ▼
                                          待测试 ──Agent──▶ 测试中
                                             │           ▲
                                             │           │ 有 Bug → 回开发中
                                             ▼
                                          待发布 ──Human──▶ 发布中
```

子任务 3 态：`Todo → In Progress → Done`

## 自动化程度

### 完全自动化（Daemon + claude -p）
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

### 1. 环境变量

```bash
# .env（项目根目录）
LINEAR_WEBHOOK_SECRET=your_webhook_secret
LINEAR_API_KEY=your_linear_api_key
```

### 2. 启动 Daemon

```bash
bun install
bun run daemon        # 持续轮询模式
bun run daemon:once   # 单次执行后退出
```

### 3. 使用

在 Linear 中操作即可，Daemon 自动响应：

1. 创建 issue（状态设为"调研中"）→ Agent 自动产出 PRD
2. 评论 "继续" → Agent 自动推进到下一阶段
3. 评论 "发布" → Agent 自动执行发布流程

## 文档

详细设计参见 [COWORK_INSTRUCTIONS.md](./COWORK_INSTRUCTIONS.md)（v0.5）。
