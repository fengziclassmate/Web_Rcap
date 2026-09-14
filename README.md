# 个人科研与生活执行工作台

仅面向桌面浏览器的个人工作台，用于管理周日程、长期与日常任务、年度计划、项目打卡、购物清单、花销和生活/科研日志。

## 本地运行

1. 运行 `npm install`。
2. 复制并配置 `.env.local`：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. 运行 `npm run dev`，访问 [http://localhost:3000](http://localhost:3000)。

## 质量检查

- `npm run lint`：代码规范检查
- `npm test`：运行测试
- `npm run build`：生产构建与类型检查

数据库初始化和迁移说明见 [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)。界面规范见 [DESIGN.md](./DESIGN.md)。
