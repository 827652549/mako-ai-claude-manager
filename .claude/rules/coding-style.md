
# 编码风格规范

## 通用规范
- 使用2空格缩进
- 行宽不超过100字符
- 文件末尾保留一个空行
- 使用分号结束语句

## 命名约定
- 变量和函数使用camelCase命名法
- 类和组件使用PascalCase命名法
- 常量使用UPPER_SNAKE_CASE命名法
- CSS类名使用kebab-case命名法

## 注释规范
- 每个函数都应有JSDoc风格的注释
- 复杂逻辑需要添加行内注释
- 代码块前使用块注释说明其功能
- TODO和FIXME使用统一格式：// TODO(username): 内容

## 代码质量检查
- **必须通过 lint 检查**：提交代码前必须运行 `npm run lint` 或 `bun run lint`，确保所有 lint 错误已修复
- **优先修复而非禁用**：遇到 lint 错误时，优先考虑修复代码逻辑，而不是添加禁用注释
- **配置文件忽略**：对于配置文件或自动生成的文件，应在 `eslint.config.mjs` 的 `globalIgnores` 中忽略，而不是在文件内添加禁用注释
- **React Hooks 规范**：避免在 `useEffect` 中直接调用 `setState`，应使用：
  - `useState` 的初始化函数代替在 effect 中初始化
  - `useMemo` 计算派生状态
  - 在事件回调中调用 `setState`（这是允许的）
- **类型安全**：避免使用 `any` 类型，优先使用 `unknown` 或具体类型
- **未使用变量**：优先真正使用这些变量，创建占位函数来使用参数，而不是禁用警告
