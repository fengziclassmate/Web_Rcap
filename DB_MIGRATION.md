# 数据库迁移指南

## 概述

为了支持循环事件功能，需要在 Supabase 数据库的 `events` 表中添加以下新字段：

- `recurrence`：JSON 类型，存储循环规则
- `exception_dates`：JSON 类型，存储例外日期列表
- `original_id`：文本类型，存储循环事件的原始 ID

## 迁移步骤

### 1. 登录 Supabase 控制台

1. 打开浏览器，访问 [Supabase 控制台](https://app.supabase.com/)
2. 登录您的账号
3. 选择您的项目

### 2. 进入数据库编辑器

1. 在左侧导航栏中，点击 "Database" 选项
2. 点击 "Tables" 标签页
3. 找到并点击 `events` 表

### 3. 添加新字段

#### 添加 `recurrence` 字段

1. 点击 "Edit table" 按钮
2. 点击 "Add column" 按钮
3. 填写以下信息：
   - **Name**: `recurrence`
   - **Data type**: `jsonb`
   - **Default value**: `null`
   - **Nullable**: 勾选（允许为空）
   - **Description**: 存储循环规则
4. 点击 "Save" 按钮

#### 添加 `exception_dates` 字段

1. 点击 "Add column" 按钮
2. 填写以下信息：
   - **Name**: `exception_dates`
   - **Data type**: `jsonb`
   - **Default value**: `null`
   - **Nullable**: 勾选（允许为空）
   - **Description**: 存储例外日期列表
3. 点击 "Save" 按钮

#### 添加 `original_id` 字段

1. 点击 "Add column" 按钮
2. 填写以下信息：
   - **Name**: `original_id`
   - **Data type**: `text`
   - **Default value**: `null`
   - **Nullable**: 勾选（允许为空）
   - **Description**: 存储循环事件的原始 ID
3. 点击 "Save" 按钮

### 4. 验证迁移结果

1. 确认所有新字段都已成功添加到 `events` 表中
2. 检查字段类型和默认值是否正确
3. 确保表结构符合预期

## 代码兼容性

应用代码已经做好了向后兼容的准备：

- 所有新字段都是可选的，即使数据库中没有这些字段，现有的事件数据也能正常加载
- `normalizeEvents` 函数会处理缺失的字段，确保应用不会崩溃
- 应用会自动为缺失的字段设置默认值

## 测试

在完成数据库迁移后，建议进行以下测试：

1. 创建一个循环事件，确保数据能够正确存储
2. 编辑循环事件，确保数据能够正确更新
3. 删除循环事件，确保数据能够正确删除
4. 查看循环事件的渲染，确保界面能够正确显示

## 注意事项

- 数据库迁移是一个敏感操作，请确保在非生产环境中进行测试
- 迁移过程中可能会短暂影响应用的可用性，请选择合适的时间进行
- 建议在迁移前备份数据库，以防万一出现问题

如果您在迁移过程中遇到任何问题，请随时联系我们的技术支持团队。