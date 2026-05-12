@../mako-rules-base/CLAUDE.md

# CLAUDE.md — 项目研发规范入口

> **项目状态**：本项目正处于从"工作流系统"向"React/Next.js 项目"转型阶段。
> 当前代码（daemon.ts、api/webhook.ts）为工作流核心，后续将改造为完整的前端应用。

---

## 本项目特有规范

> 通用编码规范（代码质量、风格、React、API、测试等）已通过顶部 `@import` 从 `mako-rules-base` 加载。
> 以下仅列出本项目独有的内容。

### 架构约束

- 严格遵守三层架构：**表现层（UI）→ 业务逻辑层（Services/Hooks）→ 数据访问层（API）**
- 跨层直接调用需在 PR 中说明原因

### UI 变更

- 在页面上新增 UI 元素前，必须先向用户确认放置位置和视觉设计，禁止自行决定

---

## 按需规范索引（本项目特有文件）

| 任务类型 | 读取文件 |
|---|---|
| 了解项目目录结构 | `.claude/rules/project-overview.md` |

---

## 规范文件目录

```
mako-rules-base/rules/      # 共享规范（@import 加载，实时生效，勿在此重复维护）
├── ai-interaction.md
├── coding-style.md
├── lint-requirements.md
├── react-guidelines.md
├── ui-style-standards.md
├── api-standards.md
├── testing-standards.md
├── code-examples.md
├── nextjs-stack.md         # Next.js 技术栈约定
├── nextjs-architecture.md  # 三层架构 + 目录约定
├── glossary.md             # 术语表
└── faq.md                  # 常见问题

.claude/rules/              # 本项目特有规范
└── project-overview.md     # manager 特有目录结构
```
