# 项目目录结构（manager 特有）

通用技术栈见 `nextjs-stack.md`，通用架构约定见 `nextjs-architecture.md`（均由 mako-rules-base 加载）。

## 本项目特有目录

```
src/app/
├── api/auth/[...all]/    # Better Auth 认证端点
├── dashboard/            # AI 工作流可视化管理仪表盘
├── sign-in/              # 登录页
├── sign-up/              # 注册页
└── page.tsx              # 首页（含登录状态检查与自动跳转）

src/components/
├── app-sidebar.tsx       # 应用侧边栏
├── site-header.tsx       # 站点头部
└── theme-toggle.tsx      # 主题切换组件

src/db/schema/            # Drizzle schema（含 Better Auth 相关表）
src/lib/
├── auth.ts               # Better Auth 服务端配置
└── auth-client.ts        # Better Auth 客户端配置

# 根目录工作流核心（manager 独有）
daemon.ts                 # Linear 队列轮询守护进程
api/webhook.ts            # Linear Webhook 接收端点
drizzle/                  # 数据库迁移文件
drizzle.config.ts         # Drizzle 配置
```
