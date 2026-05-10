# 项目概览

## 技术栈
- 前端：
    - NextJS 16 ✅
    - React 19 ✅
    - Eslint ✅
    - TypeScript ✅
    - Tailwind CSS v4 ✅
    - shadcn/ui 组件库 ✅（完整集成，包含所有 UI 组件）
    - 主题切换（深色/浅色模式）✅
- 后端：
    - Next.js API Routes ✅
    - Better Auth 认证系统 ✅（已配置，支持登录/注册/会话管理）
    - 当前未集成 Express（未来如需复杂路由可考虑）
- 数据库：
    - PostgreSQL ✅（通过 Drizzle ORM）
    - Drizzle ORM ✅（已配置，包含认证 schema）
    - 数据库迁移脚本 ✅（drizzle-kit）
    - 按需使用 Redis（缓存，未实现）
    - 按需使用 SQLite（开发/测试，未实现）
- 测试：
    - Jest + React Testing Library ✅（已配置）
- 部署：
    - Docker ✅（已配置 docker-compose.yml 和 Dockerfile）
    - Docker Compose ✅（支持一键启动 Next.js + PostgreSQL）
- 其他:
    - 依赖安装使用 Bun（推荐）或 npm/yarn
- 代码质量:
    - ESLint 代码检查（必须通过）
    - 运行 `npm run lint` 或 `bun run lint` 检查代码
    - 提交代码前必须确保 lint 检查通过

## 项目结构

每一个目录都应该有对应的README.MD文档, 简要说明目录的职能, 以及告知什么情况下应该编辑此目录的内容

- `src/` - 源代码目录，包含：
    - `app/` - Next.js App Router 路由和页面
        - `api/` - API 路由（包含 `/api/auth/[...all]` 认证端点）
        - `dashboard/` - 仪表盘页面和布局
        - `sign-in/` - 登录页面
        - `sign-up/` - 注册页面
        - `page.tsx` - 首页（支持登录状态检查和自动跳转）
    - `components/` - React 组件
        - `ui/` - shadcn/ui 组件库（完整组件集）
        - `app-sidebar.tsx` - 应用侧边栏
        - `site-header.tsx` - 站点头部
        - `theme-toggle.tsx` - 主题切换组件
    - `db/` - 数据库配置
        - `schema/` - 数据库 schema 定义（包含 auth 相关表）
        - `index.ts` - 数据库连接配置
    - `lib/` - 库文件
        - `auth.ts` - Better Auth 服务端配置
        - `auth-client.ts` - Better Auth 客户端配置
        - `utils.ts` - 工具函数（cn 函数）
    - `hooks/` - 自定义 React Hooks
    - `services/` - 业务逻辑服务
    - `utils/` - 工具函数
    - `constants/` - 常量定义
    - `types/` - TypeScript 类型定义
- `types/` - 根目录类型定义（如路由类型等）
- `public/` - 静态资源目录
- `docs/` - 文档目录
- `tests/` - 测试文件目录
- `drizzle/` - 数据库迁移文件
- `drizzle.config.ts` - Drizzle 配置文件
- `docker-compose.yml` - Docker Compose 配置
- `Dockerfile` - Docker 构建文件
- `components.json` - shadcn/ui 配置文件
- `.env` - 环境变量（参考 `.env.example`）
- `.gitignore` - 忽略某些提交, 使用通用模版
