
# Lint 检查要求

## 重要提示

**所有代码提交前必须通过 lint 检查！**

## 运行 Lint 检查

```bash
# 使用 npm
npm run lint

# 使用 bun
bun run lint

# 自动修复可修复的问题
npm run lint:fix
# 或
bun run lint:fix
```

## 常见问题和解决方案

### 1. Jest 配置文件（jest.config.js, jest.setup.js）

**问题**：使用 `require()` 的 CommonJS 导入

**解决方案**：在 `eslint.config.mjs` 的 `globalIgnores` 中忽略这些文件：
```javascript
globalIgnores([
  "jest.config.js",
  "jest.setup.js",
  // ...
])
```
这是合理的，因为 Jest 配置文件需要使用 CommonJS 格式。

### 2. React Hooks - setState 在 effect 中

**问题**：在 `useEffect` 中直接调用 `setState` 会导致 cascading renders

**解决方案**：
- 使用 `useState` 的初始化函数代替在 effect 中初始化
- 在事件回调中调用 `setState`（这是允许的）
- 使用 `useCallback` 包装函数以避免依赖问题

### 3. 未使用的变量和导入

**问题**：定义了但未使用的变量

**解决方案**：
- **优先方案**：真正使用这些变量，而不是禁用警告
- 如果参数暂时未使用但未来会用到，创建一个占位函数来使用它（如 `showError(defaultMessage)`）
- 移除未使用的导入和变量
- 如果确实无法使用，再考虑使用下划线前缀：`_unusedVar`（不推荐）

### 4. TypeScript 类型问题

**问题**：
- 使用 `any` 类型
- 空对象类型 `{}`

**解决方案**：
- 使用 `unknown` 代替 `any`
- 使用 `Record<string, never>` 代替 `{}`
- 定义具体的类型接口

### 5. 自动生成的文件

**问题**：Next.js 自动生成的文件（`types/validator.ts`, `types/routes.d.ts`）包含 lint 错误

**解决方案**：
- **推荐方案**：在 `eslint.config.mjs` 的 `globalIgnores` 中忽略这些文件：
  ```javascript
  globalIgnores([
    "types/validator.ts",
    // ...
  ])
  ```
- 这些文件是自动生成的，不应该手动修改，也不应该添加禁用注释

## 提交前检查清单

- [ ] 运行 `npm run lint` 或 `bun run lint`
- [ ] 确保没有错误（errors）
- [ ] 警告（warnings）应尽可能修复，或添加适当的注释说明
- [ ] 如果使用 `--fix` 自动修复，检查修复后的代码是否正确

## 注意事项

- **优先修复而非禁用**：遇到 lint 错误时，优先考虑修复代码逻辑，而不是添加禁用注释
- **使用配置忽略**：对于配置文件或自动生成的文件，应在 ESLint 配置中全局忽略，而不是在文件内添加禁用注释
- **真正使用参数**：如果函数参数暂时未使用，创建占位函数或重构逻辑来真正使用它
- **团队协作**：确保团队成员都了解并遵循 lint 规范
- **CI/CD**：建议在 CI/CD 流程中添加 lint 检查步骤
