---
name: research-phase
description: 需求调研阶段。从需求背景产出 PRD → UX → UI → TRD + Task 拆分，全部写入 Linear。
context: fork
user-invocable: false
allowed-tools:
  - WebSearch
  - mcp__linear__get_issue
  - mcp__linear__save_comment
  - mcp__linear__list_comments
  - mcp__linear__save_issue
---

# Research Phase — 调研阶段

你正在执行需求调研阶段。从 Linear issue 的需求背景出发，产出完整的设计与技术方案。

## 输入

从父线程传入的上下文：
- Linear issue ID 和标题
- 需求/技改背景描述
- 仓库路径（如适用）

## 流程

### 1. 判定分支

读取 Linear issue 描述，判定是**需求**还是**技改**：

- **分支 A · 需求**：触发器是用户行为/业务指标问题（"用户做不到 X"、"转化率低于 Y"）
  → 走 PRD → UX → UI → TRD → Task 拆分
- **分支 B · 技改**：触发器是工程指标问题（"P95 > 800ms"、"构建时间超过 10 分钟"）
  → 直接走 TRD → Task 拆分

**判定不清** → 在 Linear 写评论说明需要澄清的点，不要硬猜。

### 2a. 分支 A — Step 1：生成 PRD

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

### 2b. 分支 A — Step 2：UX 设计

基于 PRD，产出用户体验方案，写入 Linear 评论（前缀 `**🎨 UX Agent**`）：

#### 用户流程图
用文字描述核心用户旅程（Happy Path + 异常路径），每个节点标注触发条件、用户操作、系统响应。

#### 信息架构
列出页面/视图清单及层级关系，每个区块标注展示内容和用户操作。

#### 交互规格
对关键交互逐一描述：触发方式、系统响应、边界情况。

#### UX 验收检查点
从 UX 角度列出可测试的验收项（核心流程可完成性、错误提示、首屏信息可见性）。

**禁止**：不改 PRD 主体目标、不指定技术实现、不涉及视觉样式。

### 2c. 分支 A — Step 3：UI 设计

基于 UX 方案，产出视觉设计规范。**UI Agent 不写任何代码**，仅输出设计指导，供开发阶段 repo-worker 参考实现。

#### 线框图（主产物）

用 ASCII art 或 Mermaid 图绘制页面布局线框，标注每个区块的位置、尺寸比例和内容。

#### Figma 设计稿（推荐）

如有条件，将设计稿写入 Figma 并附上 Figma 链接。无 Figma 时，线框图 + 设计规范 JSON 即可。

#### Linear 评论（前缀 `**🖌️ UI Agent**`）

1. **Figma / Preview URL**（如有）：指向设计稿或可交互原型
2. **页面布局描述**：每个区块的结构、层级、内容说明（文字描述 + 线框图）
3. **设计规范 JSON**：colors、spacing、borderRadius、typography token
4. **组件清单**：列出使用的 shadcn/ui 组件及其 props 用法
5. **交互行为描述**：hover/focus/active 状态、动画、过渡效果

**设计质量要求**（供 repo-worker 参考）：
- 遵循 shadcn/ui 美学：极简克制、zinc 灰阶主色、1px 精致边框、4px 网格系统
- 默认带柔和投影营造立体感，hover 时阴影加深上浮，暗色模式投影补偿加强
- 使用项目已有的 shadcn/ui 组件（Button、Card、Table、Badge、Input 等）
- CSS 变量色值（支持暗色模式），不硬编码 hex
- 响应式布局（sm/md/lg/xl 断点）

**禁止**：不写任何代码文件、不修改项目代码、不执行 git 操作、不改 UX 流程结构、不改 PRD 目标。

### 2d. 分支 A — Step 4：生成 TRD + Task 拆分

基于 PRD + UX + UI 三份产物，产出 TRD 和 Task 拆分。TRD 写入 Linear 评论（前缀 `**📋 TRD Agent**`），Task 拆分写入另一条评论（前缀 `**📋 Task Breakdown**`）。

#### TRD 结构

- 主语：系统 / 工程
- 问题语言："系统不满足约束 Z"
- 非目标价值：显式列出不优化哪些模块
- 验收标准：工程指标 / 兼容性测试用例（可跑、可量化）
- 技术方案：架构概览、组件设计、安全设计、现有系统兼容

#### Task 拆分 JSON

```json
{
  "tasks": [
    {
      "title": "Task 标题",
      "description": "Task 描述（需引用 UX 流程和 UI 规范中的具体内容）",
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
- Task 描述中应引用 UX 交互规格和 UI 组件清单中的具体条目

#### 创建 Linear 子任务（必须执行）

Task 拆分 JSON 写入评论后，**必须为每个 Task 创建 Linear 子任务**：

```python
for each task in tasks:
    mcp__linear__save_issue(
        title=task.title,
        description=f"{task.description}\n\n**验收标准**: {task.acceptance}",
        parentId="{主任务 issue ID}",
        team="{主任务 team}",
        project="{主任务 project}",
        state="Todo"  # 子任务默认 Todo 状态
    )
```

创建后在 Task Breakdown 评论末尾追加子任务 ID 映射，方便 project-lead 后续追踪：
```
子任务 ID 映射：
- {task1.title}: MAK-{子任务编号}
- {task2.title}: MAK-{子任务编号}
```

### 3. 分支 B：生成 TRD + Task 拆分

直接产出 TRD，写入 Linear 评论（前缀 `**📋 TRD Agent**`）：

- 主语：系统 / 工程
- 问题语言："指标超过阈值 Y / 系统不满足约束 Z"
- 非目标价值：显式列出不优化哪些模块
- 验收标准：工程指标 / 兼容性测试用例（可跑、可量化）

然后产出 Task 拆分 JSON（同 2d 格式），写入 Linear 评论（前缀 `**📋 Task Breakdown**`）。

### 4. 用 WebSearch 做必要调研

如有需要竞品分析、技术方案调研的环节，用 WebSearch 搜索后将结果融入 PRD/TRD/UX/UI。

## 产物

在 Linear 评论中落库：

**分支 A（需求）**：
1. PRD（一条评论，前缀 `**📋 PRD Agent**`）
2. UX 方案（一条评论，前缀 `**🎨 UX Agent**`）
3. UI 设计规范（前缀 `**🖌️ UI Agent**`：线框图 + Figma/Preview URL + 设计规范 JSON + 组件清单 + 交互行为描述）
4. TRD（一条评论，前缀 `**📋 TRD Agent**`）
5. Task 拆分 JSON（一条评论，前缀 `**📋 Task Breakdown**`）+ 对应的 Linear 子任务

**分支 B（技改）**：
1. TRD（一条评论，前缀 `**📋 TRD Agent**`）
2. Task 拆分 JSON（一条评论，前缀 `**📋 Task Breakdown**`）+ 对应的 Linear 子任务

## 约束

- PRD 不指定技术栈、库版本、表结构
- UX 不改 PRD 主体目标、不指定技术实现、不涉及视觉样式
- UI 不写任何代码、不改 UX 流程结构、不改 PRD 目标
- TRD 不修改 PRD 主体目标
- 非目标段是架构的笼头 — 顺手优化 = 越权
- 验收标准必须可机器校验
- 所有产物必须写入 Linear 评论，不输出到其他地方
