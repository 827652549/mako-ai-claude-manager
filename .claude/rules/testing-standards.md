
# 测试规范

## 测试框架
- 单元测试：Jest + React Testing Library
- 端到端测试：Cypress
- API测试：SuperTest

## 单元测试准则
- 为每个组件和工具函数编写单元测试
- 使用`describe`和`it`清晰描述测试场景
- 使用`test.each`处理参数化测试
- 使用快照测试验证UI组件渲染
- 编写测试前考虑边界条件

## 测试文件组织
- 测试文件与源文件放在同一目录
- 命名格式为`[filename].test.tsx`或`[filename].spec.tsx`
- 公共测试工具放在`tests/utils/`目录
- 测试数据放在`tests/fixtures/`目录

## 单元测试示例
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Button component', () => {
  it('renders correctly with default props', () => {
    render(<Button>Click me</Button>);
    const buttonElement = screen.getByText('Click me');
    expect(buttonElement).toBeInTheDocument();
    expect(buttonElement).toHaveClass('btn-primary');
  });
  
  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
