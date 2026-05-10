# CLAUDE.md — 项目研发规范入口

## 使用说明

本文件是 Claude Code 的规范入口。分为两部分：

1. **常驻规范**：任何任务都必须遵守，已内联在此文件中。
2. **按需规范**：根据任务类型，在开始编码前主动读取对应文件。

> **行为指令**：在开始任何编码任务前，先判断任务类型，然后读取下方索引表中对应的规范文件，再开始工作。

---

## 常驻规范（始终遵守）

### 代码质量
- 提交前必须通过 `bun run lint`（或 `npm run lint`），lint 错误优先修复而非禁用
- 禁止使用 `any` 类型，优先使用 `unknown` 或具体类型
- 避免在 `useEffect` 中直接调用 `setState`

### 编码风格
- 2 空格缩进，行宽不超过 100 字符，文件末尾保留空行，语句末尾加分号
- 变量/函数用 `camelCase`，组件/类用 `PascalCase`，常量用 `UPPER_SNAKE_CASE`

### 架构约束
- 严格遵守三层架构：**表现层（UI）→ 业务逻辑层（Services/Hooks）→ 数据访问层（API）**
- 跨层直接调用需在 PR 中说明原因

### UI 变更
- 在页面上新增 UI 元素前，必须先向用户确认放置位置和视觉设计，禁止自行决定

---

## 按需规范索引

| 任务类型 | 读取文件 |
|---|---|
| 编写 React 组件 / 页面 | `.claude/rules/react-guidelines.md` + `.claude/rules/ui-style-standards.md` |
| 编写 API Route / Service 层 | `.claude/rules/api-standards.md` |
| 编写或修改测试 | `.claude/rules/testing-standards.md` |
| 架构调整 / 重构 / 新增目录 | `.claude/rules/architecture.md` |
| 不确定某个规范细节 | `.claude/rules/coding-style.md` 或 `.claude/rules/lint-requirements.md` |
| 查找术语或项目概念 | `.claude/rules/glossary.md` |
| 查看代码示例参考 | `.claude/rules/code-examples.md` |
| 遇到疑难问题 | `.claude/rules/faq.md` |

---

## 规范文件目录

所有规范的单一来源在 `.claude/rules/`，维护时只需修改对应 `.md` 文件。

```
.claude/rules/
├── project-overview.md     # 技术栈、项目结构总览
├── lint-requirements.md    # Lint 规则详细说明
├── coding-style.md         # 编码风格完整规范
├── react-guidelines.md     # React 组件开发规范
├── architecture.md         # 项目架构与数据流
├── api-standards.md        # API 接口设计规范
├── ui-style-standards.md   # UI 视觉风格规范
├── testing-standards.md    # 测试规范
├── code-examples.md        # 代码示例参考
├── glossary.md             # 术语表
└── faq.md                  # 常见问题
```
