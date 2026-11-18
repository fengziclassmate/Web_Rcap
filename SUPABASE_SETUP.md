# Supabase + Vercel 最简上线步骤

## 1. 创建 Supabase 项目
- 在 [Supabase](https://supabase.com/) 新建项目。
- 从项目的 `Connect` 窗口获取 URL 和公开 key；全部 API key 可在 `Settings -> API Keys` 中查看。复制：
  - `Project URL`
  - publishable key（或现有项目仍在使用的 `anon public key`）

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

## 科研与自学任务表（2026-10-16）

现有项目需执行 `supabase/migrations/20261016082720_add_project_boards.sql`，为 `schedule_data` 增加 `project_boards` JSONB 字段，继续使用现有 RLS 策略。建议先迁移数据库再部署代码。

若使用 SQL Editor，本次增量迁移为：

```sql
alter table public.schedule_data
  add column if not exists project_boards jsonb not null default '[]'::jsonb;
```

代码先上线时会兼容尚未迁移的数据库：保留项目本机草稿、显示迁移提示，并继续同步原有日程字段。执行迁移后点击工作台顶部的重试，即可提交待同步项目。首次本机登录与真实云端同步需要在配置环境变量和测试账号后验收。

本次迁移已于 2026-10-16 应用到线上 `webRcap` 项目，云端记录版本为 `20261016082720`，仓库文件名与此保持一致。验证结果：新增字段为非空 JSONB，默认值为空数组；原有日程数据行数及 RLS 策略保持不变；线上 Data API 已能读取该字段。

## 专注跨设备同步（2026-10-16）

执行 `supabase/migrations/20261016102614_sync_focus_state.sql`，增加 `schedule_data.focus_state` 非空 JSONB 列及数据形状约束，默认值为 `{"active":null,"sessions":[]}`。计时与历史使用原有账号 RLS 和同步版本检查，不需要新的密钥或 Vercel 环境变量。

该迁移已应用到线上 `webRcap`，版本为 `20261016102614`。已核对结构约束、原有读写策略，并用匿名角色及无对应数据的登录角色验证无法读取其他账号的数据。旧浏览器历史只会在打开新版工作台后上传；未上传的本机记录无法从另一台电脑读取。

## Notion 双向同步

1. 应用 `add_notion_sync_state` 迁移，部署 `notion-sync` Edge Function。函数用 Vault 中生成的调用密钥自行授权，部署时使用 `--no-verify-jwt`。在 Edge Function Secrets 中设置 `NOTION_SYNC_TOKEN`，来自 Notion 内部连接。该连接需要读取、新增和更新权限，并加入 TodoLists 和每日打卡的原始数据库。
2. 在 TodoLists 添加文本属性 `RCAP 任务 ID`，供创建请求重试时定位同一条记录。可以在工作视图中隐藏这一列。
3. 使用 SQL Editor 为已确认的 RCAP 账号登记同步。替换下方账号 UUID、数据源 UUID 和项目 ID。属性可先填名称，首次预览会返回稳定的属性 ID，将 `resolvedConfig` 保存到 `configuration` 后，现有绑定可以跟随 Notion 属性改名。

```sql
do $$
declare
  account_id uuid := '<RCAP 账号 UUID>';
  key_name text := 'rcap-notion-' || account_id::text;
  invocation_key text;
begin
  select decrypted_secret into invocation_key
  from vault.decrypted_secrets where name = key_name;

  if invocation_key is null then
    invocation_key := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    perform vault.create_secret(invocation_key, key_name, 'RCAP Notion 定时同步');
  end if;

  insert into public.notion_sync_state (user_id, invocation_digest, configuration)
  values (account_id, encode(sha256(convert_to(invocation_key, 'UTF8')), 'hex'), jsonb_build_object(
    'enabledAt', clock_timestamp(),
    'todo', jsonb_build_object(
      'dataSourceId', '<TodoLists 数据源 UUID>',
      'title', '任务名称', 'date', '计划执行日', 'notes', '备注',
      'status', '状态', 'rcapId', 'RCAP 任务 ID'
    ),
    'daily', jsonb_build_object(
      'dataSourceId', '<每日打卡数据源 UUID>', 'date', '日期', 'title', '记录',
      'bindings', jsonb_build_array(jsonb_build_object(
        'projectId', '<RCAP 项目 ID>', 'checkbox', '力扣2题'
      ))
    )
  ));
end $$;
```

4. 启用 `pg_net` 后，先运行单次预览。替换 URL 项目标识和 Vault 密钥名称。预览只读，返回拟同步数量、待核对记录和冲突。用返回的请求 ID 查询 `net._http_response` 的 `status_code` 和 `content`。

```sql
select net.http_post(
  url := 'https://<project-ref>.supabase.co/functions/v1/notion-sync?mode=preview',
  headers := jsonb_build_object('x-rcap-notion-secret', decrypted_secret),
  timeout_milliseconds := 95000
) from vault.decrypted_secrets where name = 'rcap-notion-<RCAP 账号 UUID>';
```

5. 验证预览和单次运行后，启用 `pg_cron`，以 `*/2 * * * *` 调度同一 SQL，URL 改为 `?mode=sync`。网页及桌面版可在「工作台设置 → Notion 同步」查看运行结果。暂停时停用 Cron job。

默认从启用后创建的任务和新绑定当天起的项目打卡开始。打卡按上海日期归属，同一天复用原有 Notion 记录。已有任务可通过配置 `existingTaskPairs: [{ "rcapId": "任务 ID", "pageId": "Notion 页面 UUID" }]` 逐条配对并预览。打卡状态由 `bindings[].checkbox` 映射，需同步描述时再配置一个语义对应的文本列 `bindings[].note`。
