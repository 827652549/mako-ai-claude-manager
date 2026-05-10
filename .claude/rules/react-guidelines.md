
# React开发指南

## 组件结构
- 使用函数组件和Hooks，避免使用Class组件
- 小型UI元素使用无状态组件
- 复杂逻辑使用自定义Hooks抽象
- 组件文件名与组件名一致，使用PascalCase

## 状态管理
- 局部状态使用useState和useReducer
- 全局状态使用Context API结合useReducer
- 避免过度使用全局状态
- 复杂异步流程使用TanStack Query(React Query)

## 性能优化
- 使用React.memo()包装纯展示组件
- 使用useCallback()和useMemo()优化性能
- 大型列表使用懒加载
- 使用React.lazy()和Suspense实现代码分割
    - 如果在NextJS项目中,则使用next/dynamic代替React.lazy()
