# 项目架构

## 架构概览
我们的项目采用三层架构:
1. 表现层(UI) - React组件
2. 业务逻辑层 - Services和Hooks
3. 数据访问层 - API调用和数据处理

## 目录结构说明
- `src/app/` - Next.js App Router 路由和页面目录
    - `api/` - API 路由（包含 `/api/auth/[...all]` 认证端点）
    - `dashboard/` - 仪表盘页面和布局
    - `sign-in/` - 登录页面
    - `sign-up/` - 注册页面
    - `page.tsx` - 首页（支持登录状态检查）
- `src/components/` - 所有UI组件，按功能分子目录
    - `ui/` - shadcn/ui 组件库（40+ 组件）
    - `app-sidebar.tsx` - 应用侧边栏
    - `site-header.tsx` - 站点头部
    - `theme-toggle.tsx` - 主题切换组件
- `src/db/` - 数据库配置
    - `schema/` - 数据库 schema 定义（包含 auth 相关表）
    - `index.ts` - 数据库连接配置
- `src/lib/` - 库文件
    - `auth.ts` - Better Auth 服务端配置
    - `auth-client.ts` - Better Auth 客户端配置
    - `utils.ts` - 工具函数（cn 函数）
- `src/hooks/` - 自定义React Hooks，封装复用逻辑
- `src/services/` - 业务逻辑服务，包含API调用
- `src/utils/` - 工具函数，纯函数，无副作用
- `src/constants/` - 常量定义
- `src/types/` - TypeScript类型定义（与根目录的 `types/` 目录配合使用）

## 数据流向
1. 用户交互触发组件内事件处理函数
2. 事件处理函数调用hooks或services
3. Services进行API调用并处理响应
4. 数据通过hooks或props返回给组件
5. 组件根据新数据重新渲染UI
