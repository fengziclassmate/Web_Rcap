# Supabase + Vercel 最简上线步骤

## 1. 创建 Supabase 项目
- 在 [Supabase](https://supabase.com/) 新建项目。
- 进入 `Project Settings -> API`，复制：
  - `Project URL`
  - `anon public key`

## 2. 创建数据表和 RLS 策略

数据库结构以 `supabase/migrations` 为唯一来源。使用 Supabase CLI 关联项目后运行：

```bash
supabase link --project-ref 你的项目编号
supabase db push
```

如果使用网页 SQL Editor，请按文件名时间顺序执行 `supabase/migrations` 中尚未应用的迁移，不要重复运行仓库外的旧版建表脚本。

## 3. 配置本地环境变量
新建 `.env.local`，填写：

```bash
NEXT_PUBLIC_SUPABASE_URL=你的 Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 anon public key
```

## 4. 配置邮件登录（Magic Link）
- Supabase 控制台打开 `Authentication -> Providers -> Email`，确保 Email 登录开启。
- 在 `Authentication -> URL Configuration` 设置：
  - `Site URL`: 你的 Vercel 域名（本地调试可填 `http://localhost:3000`）
  - `Redirect URLs`: 包含 `http://localhost:3000` 和你的线上域名

## 5. 部署到 Vercel
- 将仓库推到 GitHub。
- Vercel 导入项目并在 `Environment Variables` 中配置同样的两个变量：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 重新部署。

完成后，每个用户通过邮箱登录，都会只读写自己的 `schedule_data` 行，账号彼此隔离。
