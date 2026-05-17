# Prompt 10 — 引入 React Query 缓存层 + 性能优化

> **依赖：** 建议先完成 Prompt 09（Context 拆分），让数据层独立后再添加缓存层
> **目标：** 为 Supabase 数据加载添加 TanStack React Query 缓存层，消除模块切换时的重复查询和页面闪烁。

---

## 一、当前痛点

1. 每次切换模块（如从"个人日程"切换到"科研项目"），所有数据重新拉取，约 30 次数据库查询
2. 页面闪烁：数据加载 → 显示空白 → 数据到达 → 渲染，这个过程每次切换都会重复
3. 无乐观更新：增删改操作后等待远程确认才更新 UI
4. 多 Table 关联数据无预取策略

---

## 二、新增依赖

```bash
cd "C:\Users\25371\Desktop\日程安排_app"
npm install @tanstack/react-query
```

## 三、修改 `src/app/layout.tsx`

在 Provider 外层包裹 QueryClientProvider：

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 分钟内不重新拉取
      gcTime: 30 * 60 * 1000,         // 30 分钟后从缓存中移除
      retry: 2,
      refetchOnWindowFocus: false,    // 科研工具不需要窗口聚焦重新获取
    },
  },
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* 其他 provider */}
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

## 四、重构数据加载（示例：ScheduleContext）

以 `src/providers/schedule-context.tsx` 为例，将 `loadUserData` 替换为 useQuery：

```tsx
// 提取 query key 常量方便统一管理
export const scheduleKeys = {
  all: ["schedule"] as const,
  detail: (userId: string) => ["schedule", userId] as const,
};

// 提取数据获取函数（纯 async 函数，可测试、可复用）
async function fetchScheduleData(userId: string): Promise<PersistedSchedulePayload | null> {
  const { data, error } = await supabase
    .from("schedule_data")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  if (data?.payload) return data.payload as PersistedSchedulePayload;
  return null;
}
```

然后在 Provider 内部使用：

```tsx
import { useQuery, useQueryClient } from "@tanstack/react-query";

function ScheduleContent({ user }: { user: User | null }) {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<ScheduleEvent[]>(defaultEvents);
  // ... 其他 state

  // React Query 接管加载逻辑
  const { data: remotePayload, isLoading, isError } = useQuery({
    queryKey: scheduleKeys.detail(user?.id ?? ""),
    queryFn: () => fetchScheduleData(user!.id),
    enabled: !!user,              // 没有 user 时跳过查询
    staleTime: 5 * 60 * 1000,    // 5 分钟缓存
  });

  // 当远程数据到达时更新本地 state
  useEffect(() => {
    if (remotePayload && isDataLoaded.current === false) {
      setEvents(normalizeEvents(remotePayload.events));
      setTasks(normalizeTasks(remotePayload.tasks));
      // ... 其他字段
      isDataLoaded.current = true;
    }
  }, [remotePayload]);

  // 使用 useMutation 处理保存（乐观更新）
  const saveMutation = useMutation({
    mutationFn: async (payload: PersistedSchedulePayload) => {
      if (!user) return;
      const { error } = await supabase.from("schedule_data").upsert({
        user_id: user.id,
        payload,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onMutate: async (payload) => {
      // 取消进行中的查询
      await queryClient.cancelQueries({ queryKey: scheduleKeys.detail(user!.id) });
      // 快照旧数据
      const previousData = queryClient.getQueryData(scheduleKeys.detail(user!.id));
      // 乐观更新缓存
      queryClient.setQueryData(scheduleKeys.detail(user!.id), payload);
      return { previousData };
    },
    onError: (_err, _payload, context) => {
      // 出错时回滚
      if (context?.previousData) {
        queryClient.setQueryData(scheduleKeys.detail(user!.id), context.previousData);
      }
      toast.error("保存失败，已自动回滚");
    },
    onSettled: () => {
      // 无论成败重新拉取确保同步
      queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(user!.id) });
    },
  });

  // 装饰用户操作：每次修改后触发 saveMutation
  const onCreateEvent = useCallback((event: ScheduleEvent) => {
    setEvents((prev) => {
      const next = [event, ...prev];
      const payload = buildPayload(next);
      writeScheduleBackupToLocal(payload);           // 先写本地
      saveMutation.mutate(payload);                  // 后台同步到远程
      return next;
    });
  }, [saveMutation]);

  // ……
}
```

## 五、提取公共 Query Keys 文件

新建 `src/lib/query-keys.ts`，统一管理所有模块的 query key，避免各 provider 分散定义：

```typescript
export const queryKeys = {
  schedule: {
    all: ["schedule"] as const,
    byUser: (userId: string) => ["schedule", "byUser", userId] as const,
  },
  researchWorkflow: {
    all: ["research-workflow"] as const,
    byUser: (userId: string) => ["research-workflow", userId] as const,
  },
  logs: {
    all: ["logs"] as const,
    byUser: (userId: string) => ["logs", userId] as const,
    posts: (userId: string) => ["logs", "posts", userId] as const,
    tags: (userId: string) => ["logs", "tags", userId] as const,
  },
  literature: {
    all: ["literature"] as const,
    items: (userId: string) => ["literature", "items", userId] as const,
    tags: (userId: string) => ["literature", "tags", userId] as const,
    notes: (userId: string, itemId: string) => ["literature", "notes", userId, itemId] as const,
  },
} as const;
```

## 六、Prefetch 策略（可选高级优化）

在侧边栏 hover 某个模块时，预取数据：

```tsx
// 在 MonitoringSidebar 组件中
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

function SidebarNavItem({ id, label, icon }: SidebarItemProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  function handleMouseEnter() {
    if (!user) return;
    switch (id) {
      case "research":
        queryClient.prefetchQuery({
          queryKey: queryKeys.researchWorkflow.byUser(user.id),
          queryFn: () => fetchResearchWorkflow(user.id),
          staleTime: 5 * 60 * 1000,
        });
        break;
      case "logs":
        queryClient.prefetchQuery({
          queryKey: queryKeys.logs.byUser(user.id),
          queryFn: () => fetchLogsData(user.id),
          staleTime: 5 * 60 * 1000,
        });
        break;
      // ……
    }
  }

  return (
    <button onMouseEnter={handleMouseEnter} ...>
      {icon}
      <span>{label}</span>
    </button>
  );
}
```

## 七、迁移步骤

1. 安装依赖 `npm install @tanstack/react-query`
2. 创建 `src/lib/query-keys.ts`
3. 修改 `layout.tsx` 包裹 `QueryClientProvider`
4. 从 `schedule-context.tsx` 开始改造，将 `loadUserData` 替换为 `useQuery`
5. 测试验证所有功能正常后，依次改造 `research-context.tsx`、`log-context.tsx`、`literature-context.tsx`
6. 添加 `useMutation` 乐观更新到重要的写操作（事件增删改、任务增删改）
7. 可选：添加 prefetch 到侧边栏

## 八、验收标准

- [ ] 首次加载数据正常
- [ ] 切换模块时，如果数据在 staleTime 内，不显示 loading 状态（不闪屏）
- [ ] 修改数据后，其他模块切换回来能看到最新数据
- [ ] 网络离线时修改数据→乐观更新→UI 已变→在线后同步（不报错）
- [ ] `npm run build` 无 TypeScript 错误

## 九、注意事项

1. **不要把所有 query 的 staleTime 设得太长** — 日志/文献的动态数据可能需要短缓存（1-2 分钟），而 schedule_data 这种单行 JSON 可以缓存 5-10 分钟甚至更长
2. **useMutation 的乐观更新** — 如果数据在多个 Provider 之间共享（比如 events 影响周报），需要在 mutation 的 `onSuccess` 中 invalidate 相关 query
3. **DevTools** — 开发阶段可以安装 `@tanstack/react-query-devtools` 来观察缓存状态
