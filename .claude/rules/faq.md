
# 常见问题解答


## 如何添加新路由？
1. 在`src/routes/index.tsx`中导入你的新页面组件
2. 在routes数组中添加新路由配置对象
3. 如需鉴权，设置`requiresAuth: true`属性
4. 测试新路由是否正
常工作

## 如何处理API错误？
1. 使用`src/utils/errorHandler.ts`中的`handleApiError`函数
2. 确保捕获所有API调用的错误
3. 对于401错误，系统会自动重定向到登录页
4. 对于5xx错误，显示通用错误提示
5. 详细错误日志会自动发送到监控系统

## 如何实现国际化？
1. 在`src/locales/`目录下添加新的语言文件
2. 使用`useTranslation` hook获取翻译函数
3. 使用`t('key')`方式引用翻译文本
4. 动态值使用`t('key', { variable: value })`方式传入
