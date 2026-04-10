<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 日程安排应用 - Agent Skills 配置

## 项目信息

### 项目概述
- **项目名称**: 日程安排应用
- **项目类型**: Web 应用
- **框架**: Next.js 16.2.3 (Turbopack)
- **语言**: TypeScript
- **状态管理**: React useState/useContext
- **样式**: Tailwind CSS
- **图标**: Lucide React

## 开发环境设置

### 依赖安装
```bash
npm install
```

### 开发服务器
```bash
npm run dev
```

### 构建
```bash
npm run build
```

### 预览构建
```bash
npm run start
```

## 技术栈

### 核心技术
- **前端框架**: Next.js 16.2.3
- **语言**: TypeScript
- **样式**: Tailwind CSS v4
- **图标**: Lucide React
- **表单处理**: React Hook Form
- **数据验证**: Zod
- **动画**: Framer Motion

### 后端服务
- **数据库**: Supabase
- **认证**: Supabase Auth
- **存储**: Supabase Storage

## 代码结构

### 主要文件结构
```
src/
├── app/
│   ├── layout.tsx          # 应用布局
│   ├── page.tsx            # 主页
│   └── globals.css         # 全局样式
├── components/
│   ├── schedule/
│   │   ├── task-dashboard.tsx     # 任务仪表盘
│   │   └── weekly-time-grid.tsx   # 周视图时间网格
│   └── ui/                  # UI 组件
│       ├── button.tsx
│       ├── input.tsx
│       ├── select.tsx
│       └── ...
└── lib/
    ├── id.ts               # ID 生成工具
    ├── supabase.ts         # Supabase 客户端
    └── utils.ts            # 工具函数
```

## 设计系统

### 设计文件
- **DESIGN.md**: 设计系统文档，包含视觉主题、色彩方案、排版规则、组件样式等
- **components.json**: UI 组件配置

### 使用设计系统
1. **颜色**: 使用 DESIGN.md 中定义的颜色变量
2. **排版**: 遵循 DESIGN.md 中的字体层次结构
3. **组件**: 使用 src/components/ui 中的组件，或根据设计系统创建新组件
4. **布局**: 遵循 DESIGN.md 中的布局原则和间距尺度

## 功能模块

### 周视图
- **时间网格**: 分钟级精度的时间网格
- **事件管理**: 创建、编辑、删除、拖拽事件
- **类别可视化**: 根据事件类别显示不同颜色
- **日记功能**: 每个日期下方的日记记录区域
- **右键菜单**: 事件快捷操作

### 任务仪表盘
- **任务管理**: 创建、编辑、删除任务
- **优先级**: 四种优先级级别（紧急且重要、紧急不重要、不紧急重要、不紧急不重要）
- **子任务**: 可折叠/展开的子任务系统
- **完成状态**: 任务和子任务的完成状态管理

### 类别管理
- **类别创建**: 创建新的事件类别
- **颜色配置**: 为每个类别配置颜色
- **类别选择**: 在创建事件时选择类别

### 日记功能
- **心情选择**: 使用表情图标选择心情
- **日记输入**: 记录每日日记
- **本地存储**: 自动保存到本地存储，防止数据丢失

## 数据结构

### 事件数据结构
```typescript
interface ScheduleEvent {
  id: string;
  title: string;
  startHour: number;        // 0-23
  startMinute: number;      // 0-59
  endHour: number;          // 0-23
  endMinute: number;        // 0-59
  day: number;              // 0-6 (周日-周六)
  notes: string;
  requirements: string;
  isCompleted: boolean;
  category: string;
  tag: string;
}
```

### 任务数据结构
```typescript
interface SubTask {
  id: string;
  name: string;
  done: boolean;
}

interface LongTask {
  id: string;
  name: string;
  dueDate: string;
  done: boolean;
  notes: string;
  precautions: string[];
  completionLog: string;
  priority: Priority;
  subtasks: SubTask[];
}

type Priority = '紧急且重要' | '紧急不重要' | '不紧急重要' | '不紧急不重要';
type EventTag = '工作' | '个人' | '学习' | '运动' | '其他';
type Mood = '开心' | '难过' | '生气' | '疲惫' | '兴奋' | '焦虑' | '感激' | '无聊';
```

## 最佳实践

### 代码风格
- **命名规范**: 使用 PascalCase 命名组件，camelCase 命名变量和函数
- **类型定义**: 为所有数据结构创建 TypeScript 类型
- **组件设计**: 保持组件简洁，职责单一
- **状态管理**: 优先使用 React useState，复杂状态使用 useContext

### 性能优化
- **组件拆分**: 合理拆分组件，避免不必要的重渲染
- **代码分割**: 使用 Next.js 的代码分割功能
- **懒加载**: 对大型组件使用懒加载
- **缓存**: 合理使用 React.memo 和 useMemo

### 可访问性
- **语义化 HTML**: 使用正确的 HTML 元素
- **键盘导航**: 确保所有交互元素可通过键盘访问
- **屏幕阅读器**: 添加适当的 ARIA 标签
- **颜色对比度**: 确保文本和背景的对比度符合标准

## 部署

### 构建步骤
1. 运行 `npm run build` 生成生产构建
2. 检查构建输出是否有错误
3. 部署到 Vercel 或其他托管服务

### 环境变量
- **NEXT_PUBLIC_SUPABASE_URL**: Supabase 项目 URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Supabase 匿名密钥

## 开发指南

### 新增功能
1. 参考 DESIGN.md 确保设计一致性
2. 创建新组件时遵循现有组件的结构和样式
3. 添加新功能时更新相关类型定义
4. 测试新功能在不同设备和屏幕尺寸上的表现

### 调试技巧
- **控制台日志**: 使用 `console.log` 调试数据
- **React DevTools**: 使用 React DevTools 检查组件状态和 props
- **网络请求**: 使用浏览器开发者工具检查网络请求
- **错误处理**: 确保所有异步操作都有错误处理

## 资源

### 设计资源
- **DESIGN.md**: 设计系统文档
- **Figma**: 设计原型（如果有）

### 开发资源
- **Next.js 文档**: `node_modules/next/dist/docs/`
- **Tailwind CSS 文档**: https://tailwindcss.com/docs
- **Lucide React 文档**: https://lucide.dev/docs
- **Supabase 文档**: https://supabase.com/docs

## 团队协作

### 代码规范
- 使用 ESLint 和 Prettier 保持代码风格一致
- 提交代码前运行 `npm run lint` 检查代码质量
- 遵循 Git 提交规范，使用清晰的提交信息

### 分支管理
- **master**: 主分支，用于生产部署
- **develop**: 开发分支，用于集成新功能
- **feature/**: 功能分支，用于开发特定功能
- **bugfix/**: 修复分支，用于修复 bug

### 代码审查
- 所有代码变更都需要经过代码审查
- 审查重点包括代码质量、安全性、性能和设计一致性
- 确保所有测试通过后再合并代码

## 安全注意事项

### 客户端安全
- 不要在客户端存储敏感信息
- 使用 Supabase 的 Row Level Security (RLS) 保护数据
- 验证用户输入，防止 XSS 攻击

### 服务器安全
- 保护环境变量，不要将敏感信息提交到版本控制
- 使用 HTTPS 确保数据传输安全
- 定期更新依赖，修复安全漏洞

## 维护

### 版本控制
- 使用 Git 进行版本控制
- 定期创建发布版本
- 记录重要变更和修复

### 监控
- 监控应用性能和错误
- 收集用户反馈
- 定期检查和优化应用

### 升级
- 定期升级依赖包
- 关注 Next.js 和其他库的更新
- 测试升级后的应用功能

## 故障排除

### 常见问题
- **Supabase 连接问题**: 检查环境变量是否正确配置
- **构建错误**: 检查 TypeScript 类型错误和依赖问题
- **运行时错误**: 检查控制台错误信息，定位问题源头
- **性能问题**: 使用浏览器开发者工具分析性能瓶颈

### 解决方案
- **环境变量**: 确保 `.env.local` 文件包含正确的 Supabase 配置
- **TypeScript 错误**: 修复类型定义和类型检查错误
- **依赖问题**: 运行 `npm install` 重新安装依赖
- **网络问题**: 检查网络连接和 Supabase 服务状态
