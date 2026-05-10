
# API设计规范

## RESTful API设计原则
- 使用名词表示资源，如`/users`而非`/getUsers`
- 使用HTTP动词表示操作：GET(查询)、POST(创建)、PUT(更新)、DELETE(删除)
- 使用复数形式命名资源集合，如`/users`而非`/user`
- 使用嵌套表示资源关系，如`/users/123/orders`

## 请求格式
- GET请求使用URL参数传递过滤条件，如`/users?status=active`
- POST/PUT请求使用JSON格式在请求体中传递数据
- 所有请求需包含`Authorization`头，值为`Bearer {token}`
- 支持的内容类型仅为`application/json`

## 响应格式
```json
{
  "data": {}, // 响应主体数据
  "meta": {   // 元数据，如分页信息
    "page": 1,
    "perPage": 20,
    "total": 100
  },
  // 不同的错误码代表不同的场景,errorCode和errorMsg有枚举映射关系
  "error": {
    "errorCode": "error000", 
    "errorMsg": "网络异常"
  } 
}
```

## 错误码规范
- error400: 请求参数错误，详情在error.message中说明
- error401: 未认证或认证已过期
- error403: 无权限访问请求的资源
- error404: 请求的资源不存在
- error409: 资源冲突，如唯一键重复
- error500: 服务器内部错误
- error000: 网络异常
