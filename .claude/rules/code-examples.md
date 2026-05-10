
# 代码示例库

## API请求示例
```typescript
// 标准API请求模式
import { apiClient } from '@/utils/apiClient';
import { handleApiError } from '@/utils/errorHandler';

export async function fetchUserData(userId: string) {
  try {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  } catch (error) {
    handleApiError(error, 'Failed to fetch user data');
    return null;
  }
}
```

## 表单处理示例

```typescript
// React Hook Form使用规范
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 定义验证模式
const schema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(8, '密码至少8个字符')
});

// 使用Hook
function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  });
  
  const onSubmit = (data) =&gt; {
    // 处理表单提交
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}&gt;
      {/* 表单内容 */}
    </form>
  );
}
```
