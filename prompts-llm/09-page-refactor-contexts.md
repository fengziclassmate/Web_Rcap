# Prompt 09 — page.tsx 拆分为多 Context Provider

> **依赖：** 无（但建议先了解项目整体 data flow）
> **目标：** 将 `src/app/page.tsx` 从 2000+ 行瘦身到 ~300 行，将数据获取、状态管理、同步逻辑按职责拆分到独立的 React Context Provider 中。

---

## 一、分析现状

当前 `page.tsx` 承担了以下所有职责（混合在一个文件里）：

1. **认证状态管理** — Supabase auth login/logout
2. **数据加载** — 从 Supabase/S3 读取 schedule_data、research_workflow、logs、literatures 等共约 30 个表
3. **数据同步** — 本地状态变更后写回 Supabase + localStorage
4. **事件/任务 CRUD handlers** — 几十个 onCreate/onUpdate/onDelete 函数
5. **页面布局组装** — 组合 MonitoringSidebar + WeeklyTimeGrid + TaskDashboard + 多个 Panel
6. **LLM 子页面** — WeeklyReport / Literature / EfficiencyAnalysis / QuickEventInput

拆分原则：**一个 Context 只做一类事情**，page.tsx 只负责组装。

---

## 二、新增目录结构

```
src/
├── providers/
│   ├── schedule-context.tsx      ← 日程事件 + 长期任务 + 年度任务 + 打卡 + 足迹 + 成就
│   ├── research-context.tsx      ← 科研工作台 (projects/papers/submissions/meetings/timeline)
│   ├── log-context.tsx           ← 动态日志 (posts + tags)
│   ├── literature-context.tsx    ← 文献阅读 (items + tags + attachments + ...)
│   ├── auth-context.tsx          ← Supabase auth
│   └── ui-context.tsx            ← UI 偏好设置 (dashboardUiPreferences, 折叠状态等)
├── hooks/
│   └── use-schedule.ts           ← 暴露给外部使用的 hooks
│   └── use-research.ts
│   └── use-logs.ts
│   └── use-literature.ts
│   └── use-auth.ts
│   └── use-ui.ts
```

---

## 三、核心拆分逻辑

### 3.1 新建 `src/providers/auth-context.tsx`

```tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthState = {
  user: User | null;
  authEmail: string;
  sendingLink: boolean;
  dataReady: boolean;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    // 从 supabase.auth.getSession() 初始化
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setDataReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  async function login(email: string) {
    setSendingLink(true);
    try {
      // 保留原有的发送 Magic Link 逻辑
      const currentUrl = window.location.origin;
      await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: currentUrl },
      });
    } finally {
      setSendingLink(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, authEmail, setAuthEmail, sendingLink, dataReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

### 3.2 新建 `src/providers/schedule-context.tsx`

**核心改动：** 将 page.tsx 中的 `events / tasks / annualTasks / projectCheckins / footprints / achievements` 这 6 个状态 + 对应的十几个 CRUD handler 搬到这里。

```tsx
"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import type {
  ScheduleEvent, LongTask, AnnualTask, ProjectCheckin,
  FootprintItem, DashboardUiPreferences,
} from "@/lib/types";
import type { Achievement } from "@/components/monitoring/achievements-panel";
import {
  defaultEvents, defaultTasks, defaultPaperProgress,
  normalizeEvents, normalizeTasks, normalizeAnnualTasks,
  normalizeProjectCheckins, normalizeFootprints, normalizeAchievements,
  normalizeDashboardUiPreferences,
} from "@/lib/normalizers";
import {
  readScheduleBackupFromLocal, writeScheduleBackupToLocal,
  readDashboardUiPreferencesFromLocal, writeDashboardUiPreferencesToLocal,
  type PersistedSchedulePayload,
} from "@/lib/schedule-persistence";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { pickRecurrenceOverridePatch, parseSyntheticEventId, type RecurrenceConfig, type RecurrenceInstanceOverride } from "@/lib/recurrence";

type ScheduleContextType = {
  events: ScheduleEvent[];
  tasks: LongTask[];
  annualTasks: AnnualTask[];
  projectCheckins: ProjectCheckin[];
  footprints: FootprintItem[];
  achievements: Achievement[];
  dashboardUiPreferences: DashboardUiPreferences;

  // Event handlers
  onCreateEvent: (event: ScheduleEvent) => void;
  onUpdateEvent: (id: string, patch: Partial<ScheduleEvent>, options?: { scope?: "occurrence" | "series" }) => void;
  onDeleteEvent: (id: string, options?: { mode?: "single" | "future" | "all" }) => void;

  // Task handlers
  onToggleTask: (taskId: string) => void;
  onAddTask: (name: string, dueDate: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<LongTask>) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderTask: (sourceTaskId: string, targetTaskId: string) => void;

  // Annual Task handlers
  onAddAnnualTask: (name: string) => void;
  onToggleAnnualTask: (taskId: string) => void;
  onDeleteAnnualTask: (taskId: string) => void;

  // Project Checkin handlers
  onAddProjectCheckin: (name: string, description: string) => void;
  onCheckinProject: (projectId: string, date: string, note: string) => void;
  onDeleteProjectCheckin: (projectId: string) => void;
  onUpdateProjectCheckin: (id: string, patch: Partial<Pick<ProjectCheckin, "name" | "description" | "startDate">>) => void;
  onUpdateProjectCheckinEntry: (projectId: string, date: string, note: string) => void;
  onDeleteProjectCheckinEntry: (projectId: string, date: string) => void;

  // Footprint handlers
  onAddFootprint: (name: string) => void;
  onResetFootprint: (itemId: string) => void;
  onDeleteFootprint: (itemId: string) => void;
  onUpdateFootprint: (itemId: string, patch: Partial<Pick<FootprintItem, "name" | "lastDate">>) => void;

  // Achievement handlers
  onAddAchievement: (achievement: Achievement) => void;
  onDeleteAchievement: (id: string) => void;

  // UI Preferences
  onUiPreferencesChange: (value: DashboardUiPreferences) => void;
};

const ScheduleContext = createContext<ScheduleContextType | null>(null);

export function ScheduleProvider({ user, children }: { user: User | null; children: ReactNode }) {
  const canSaveRemoteRef = useRef(false);
  const lastLoadedSnapshotRef = useRef<string | null>(null);

  const [events, setEvents] = useState<ScheduleEvent[]>(defaultEvents);
  const [tasks, setTasks] = useState<LongTask[]>(defaultTasks);
  const [annualTasks, setAnnualTasks] = useState<AnnualTask[]>([]);
  const [projectCheckins, setProjectCheckins] = useState<ProjectCheckin[]>([]);
  const [footprints, setFootprints] = useState<FootprintItem[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [dashboardUiPreferences, setDashboardUiPreferences] = useState<DashboardUiPreferences>(
    normalizeDashboardUiPreferences(readDashboardUiPreferencesFromLocal()),
  );

  /** 初次加载数据 */
  useEffect(() => {
    if (!user) return;
    loadUserData(user);
  }, [user]);

  async function loadUserData(currentUser: User) {
    try {
      // 尝试从远程读
      const { data, error } = await supabase
        .from("schedule_data")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data?.payload) {
        const payload = data.payload as PersistedSchedulePayload;
        setEvents(normalizeEvents(payload.events));
        setTasks(normalizeTasks(payload.tasks));
        setAnnualTasks(normalizeAnnualTasks(payload.annual_tasks));
        setProjectCheckins(normalizeProjectCheckins(payload.project_checkins));
        setFootprints(normalizeFootprints(payload.footprints));
        setAchievements(normalizeAchievements(payload.achievements));

        if (payload.ui_preferences) {
          setDashboardUiPreferences(normalizeDashboardUiPreferences(payload.ui_preferences));
          writeDashboardUiPreferencesToLocal(payload.ui_preferences);
        }

        const snapshot = JSON.stringify(payload);
        lastLoadedSnapshotRef.current = snapshot;
        canSaveRemoteRef.current = true;
        return;
      }
    } catch {
      // 远程读取失败，静默降级
    }

    // 降级到 localStorage
    const local = readScheduleBackupFromLocal();
    if (local) {
      setEvents(normalizeEvents(local.events));
      setTasks(normalizeTasks(local.tasks));
      setAnnualTasks(normalizeAnnualTasks(local.annual_tasks));
      setProjectCheckins(normalizeProjectCheckins(local.project_checkins));
      setFootprints(normalizeFootprints(local.footprints));
      setAchievements(normalizeAchievements(local.achievements));
    }
    canSaveRemoteRef.current = true;
  }

  /** 构建当前 payload */
  function buildPayload(): PersistedSchedulePayload {
    return {
      events, tasks, annual_tasks: annualTasks,
      project_checkins: projectCheckins, footprints, achievements,
      research_projects: [], paper_progress: defaultPaperProgress,
      submissions: [], group_meetings: [], ui_preferences: dashboardUiPreferences,
    };
  }

  /** 保存到 local + remote */
  function persistState(payload: PersistedSchedulePayload) {
    writeScheduleBackupToLocal(payload);
    if (user && canSaveRemoteRef.current) {
      supabase.from("schedule_data").upsert({
        user_id: user.id,
        payload,
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.error("保存到远程失败", error);
      });
    }
  }

  // ========== Event CRUD ==========

  const onCreateEvent = useCallback((event: ScheduleEvent) => {
    setEvents((prev) => {
      const next = [event, ...prev];
      persistState(buildPayloadFromState(next, tasks, annualTasks, projectCheckins, footprints, achievements, dashboardUiPreferences));
      return next;
    });
  }, [tasks, annualTasks, projectCheckins, footprints, achievements, dashboardUiPreferences]);

  const onUpdateEvent = useCallback((eventId: string, patch: Partial<ScheduleEvent>, options?: { scope?: "occurrence" | "series" }) => {
    setEvents((prev) => {
      const parsed = parseSyntheticEventId(eventId);
      const next = prev.map((event) => {
        // 匹配合成实例或直接事件
        if (parsed && event.id === parsed.baseEventId && event.recurrence) {
          if (options?.scope === "series") {
            // 修改整个系列 → 更新基础事件
            return { ...event, ...patch };
          } else {
            // 仅修改单次 → 添加到 overrides
            const overrides = { ...(event.recurrenceOverrides ?? {}), [parsed.occurrenceDate]: pickRecurrenceOverridePatch(patch) };
            return { ...event, recurrenceOverrides: overrides };
          }
        }
        if (event.id === eventId && !parsed) {
          return { ...event, ...patch };
        }
        return event;
      });
      persistState(buildPayloadFromState(next, tasks, annualTasks, projectCheckins, footprints, achievements, dashboardUiPreferences));
      return next;
    });
  }, [tasks, annualTasks, projectCheckins, footprints, achievements, dashboardUiPreferences]);

  const onDeleteEvent = useCallback((eventId: string, options?: { mode?: "single" | "future" | "all" }) => {
    setEvents((prev) => {
      const parsed = parseSyntheticEventId(eventId);
      let next: ScheduleEvent[];
      if (parsed && options?.mode === "single") {
        next = prev.map((event) => {
          if (event.id === parsed.baseEventId && event.recurrence) {
            return {
              ...event,
              exceptionDates: [...(event.exceptionDates ?? []), parsed.occurrenceDate],
            };
          }
          return event;
        });
      } else if (parsed && options?.mode === "future") {
        next = prev.map((event) => {
          if (event.id === parsed.baseEventId && event.recurrence) {
            return { ...event, recurrenceEndExclusive: parsed.occurrenceDate };
          }
          return event;
        });
      } else {
        next = prev.filter((event) => event.id !== eventId && !(parsed && event.id === parsed.baseEventId));
      }
      persistState(buildPayloadFromState(next, tasks, annualTasks, projectCheckins, footprints, achievements, dashboardUiPreferences));
      return next;
    });
  }, [tasks, annualTasks, projectCheckins, footprints, achievements, dashboardUiPreferences]);

  // ========== Task CRUD ==========
  // (类似处理，将 page.tsx 中的 onToggleTask / onAddTask / onUpdateTask / onDeleteTask / onReorderTask 搬过来)
  // ……（篇幅限制，此处省略完整实现，按 page.tsx 对应 handler 逐字搬移）

  // ========== Annual Task CRUD ==========
  // ========== Project Checkin CRUD ==========
  // ========== Footprint CRUD ==========
  // ========== Achievement CRUD ==========
  // ========== UI Preferences ==========

  return (
    <ScheduleContext.Provider value={{
      events, tasks, annualTasks, projectCheckins, footprints, achievements, dashboardUiPreferences,
      onCreateEvent, onUpdateEvent, onDeleteEvent,
      onToggleTask, onAddTask, onUpdateTask, onDeleteTask, onReorderTask,
      onAddAnnualTask, onToggleAnnualTask, onDeleteAnnualTask,
      onAddProjectCheckin, onCheckinProject, onDeleteProjectCheckin,
      onUpdateProjectCheckin, onUpdateProjectCheckinEntry, onDeleteProjectCheckinEntry,
      onAddFootprint, onResetFootprint, onDeleteFootprint, onUpdateFootprint,
      onAddAchievement, onDeleteAchievement,
      onUiPreferencesChange,
    }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}

/** 辅助函数：从最新 state 构建 payload */
function buildPayloadFromState(
  events: ScheduleEvent[], tasks: LongTask[], annualTasks: AnnualTask[],
  projectCheckins: ProjectCheckin[], footprints: FootprintItem[],
  achievements: Achievement[], uiPreferences: DashboardUiPreferences,
): PersistedSchedulePayload {
  return {
    events, tasks, annual_tasks: annualTasks,
    project_checkins: projectCheckins, footprints, achievements,
    research_projects: [], paper_progress: defaultPaperProgress,
    submissions: [], group_meetings: [], ui_preferences: uiPreferences,
  };
}
```

### 3.3 新建 `src/providers/research-context.tsx`

**搬运内容：** page.tsx 中的 `researchWorkflow` 状态 + `loadResearchWorkflow` / `syncResearchWorkflow` 相关逻辑 + 所有 research workflow 相关的属性和方法。

### 3.4 新建 `src/providers/log-context.tsx`

**搬运内容：** `logPosts / logTags / logReady / logUploading` 状态 + `refreshLogs` / `handleComposePost` / `handleEditPost` / `handleDeletePost` 等。

### 3.5 新建 `src/providers/literature-context.tsx`

**搬运内容：** `literatureItems / literatureTags / literatureReady` 状态 + `refreshLiteratures` / `syncLiteratureTagLinks` / `syncLiteratureProjectLinks` / `syncLiteraturePaperUsages` / 所有文献 CRUD 等。

### 3.6 新建 `src/providers/ui-context.tsx`

```tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { MonitoringModuleId } from "@/components/monitoring/sidebar";

type UIContextType = {
  activeModule: MonitoringModuleId;
  setActiveModule: (id: MonitoringModuleId) => void;
  isBooted: boolean;
  setIsBooted: (v: boolean) => void;
  currentWeekStart: Date;
  setCurrentWeekStart: (d: Date) => void;
  viewMode: "day" | "week" | "month";
  setViewMode: (v: "day" | "week" | "month") => void;
  timeGranularity: number;
  setTimeGranularity: (v: number) => void;
  confirmDangerousActions: boolean;
  setConfirmDangerousActions: (v: boolean) => void;
  mobileTab: "schedule" | "tasks";
  setMobileTab: (v: "schedule" | "tasks") => void;
};

const UIContext = createContext<UIContextType | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [activeModule, setActiveModule] = useState<MonitoringModuleId>("schedule");
  const [isBooted, setIsBooted] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const { startOfWeek } = require("date-fns");
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [timeGranularity, setTimeGranularity] = useState<number>(60);
  const [confirmDangerousActions, setConfirmDangerousActions] = useState(true);
  const [mobileTab, setMobileTab] = useState<"schedule" | "tasks">("schedule");

  return (
    <UIContext.Provider value={{
      activeModule, setActiveModule,
      isBooted, setIsBooted,
      currentWeekStart, setCurrentWeekStart,
      viewMode, setViewMode,
      timeGranularity, setTimeGranularity,
      confirmDangerousActions, setConfirmDangerousActions,
      mobileTab, setMobileTab,
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
```

### 3.7 修改 `src/app/page.tsx`

**瘦身后的 page.tsx：**

```tsx
"use client";

import { useMemo } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { zhCN } from "date-fns/locale";
import { TaskDashboard } from "@/components/schedule/task-dashboard";
import { WeeklyTimeGrid } from "@/components/schedule/weekly-time-grid";
import { ScheduleTimeAnalytics } from "@/components/schedule/schedule-time-analytics";
import { MonitoringSidebar } from "@/components/monitoring/sidebar";
import { AchievementsPanel } from "@/components/monitoring/achievements-panel";
import { FootprintsPanel } from "@/components/monitoring/footprints-panel";
import { ProjectCheckinsPanel } from "@/components/monitoring/project-checkins-panel";
import { ResearchWorkflowPanel } from "@/components/monitoring/research-workflow-panel";
import { PaperProgressPanel } from "@/components/monitoring/paper-progress-panel";
import { SubmissionsPanel } from "@/components/monitoring/submissions-panel";
import { GroupMeetingsPanel } from "@/components/monitoring/group-meetings-panel";
import { LogPage } from "@/components/logs/log-page";
import { LiteraturePage } from "@/components/monitoring/literature-page";
import { EfficiencyAnalysisDialog } from "@/components/llm/analysis-dialog";
import { LLMChatSidebar } from "@/components/llm/chat-sidebar";
import { QuickEventInput } from "@/components/llm/quick-event-input";
import { QuickNoteFab } from "@/components/llm/quick-note-fab";
import { LLMSettingsButton } from "@/components/llm/settings-button";
import { WeeklyReportDialog } from "@/components/llm/weekly-report-dialog";
import { useAuth } from "@/providers/auth-context";
import { useSchedule } from "@/providers/schedule-context";
import { useResearch } from "@/providers/research-context";
import { useLogs } from "@/providers/log-context";
import { useLiterature } from "@/providers/literature-context";
import { useUI } from "@/providers/ui-context";

export default function Home() {
  const { user, dataReady } = useAuth();
  const {
    events, tasks, annualTasks, projectCheckins, footprints, achievements,
    dashboardUiPreferences,
    onCreateEvent, onUpdateEvent, onDeleteEvent,
    onToggleTask, onAddTask, onUpdateTask, onDeleteTask, onReorderTask,
    onAddAnnualTask, onToggleAnnualTask, onDeleteAnnualTask,
    onAddProjectCheckin, onCheckinProject, onDeleteProjectCheckin,
    onUpdateProjectCheckin, onUpdateProjectCheckinEntry, onDeleteProjectCheckinEntry,
    onAddFootprint, onResetFootprint, onDeleteFootprint, onUpdateFootprint,
    onAddAchievement, onDeleteAchievement,
    onUiPreferencesChange,
  } = useSchedule();
  const { researchWorkflow, researchWorkflowReady, /* ... */ } = useResearch();
  const { logPosts, logTags, logReady, /* ... */ } = useLogs();
  const { literatureItems, literatureTags, literatureReady, /* ... */ } = useLiterature();
  const {
    activeModule, setActiveModule, isBooted, setIsBooted,
    currentWeekStart, setCurrentWeekStart,
    viewMode, setViewMode, timeGranularity, setTimeGranularity,
    confirmDangerousActions, setConfirmDangerousActions,
    mobileTab, setMobileTab,
  } = useUI();

  const weekRange = useMemo(() => {
    const start = format(currentWeekStart, "yyyy/MM/dd", { locale: zhCN });
    const end = format(addDays(currentWeekStart, 6), "yyyy/MM/dd", { locale: zhCN });
    return `${start} - ${end}`;
  }, [currentWeekStart]);

  // 剩余部分：页面布局组装，不再包含任何数据管理 handler
  // =====================================================
  // 原有的 JSX 布局代码原封不动保留在此，只是去掉了数据管理部分
  // 将 dataReady 改为 useAuth().dataReady && researchWorkflowReady && logReady && literatureReady
  // =====================================================
}
```

### 3.8 修改 `src/app/layout.tsx`

```tsx
// 在 RootLayout 中包裹 Provider 层
import { AuthProvider } from "@/providers/auth-context";
import { ScheduleProvider } from "@/providers/schedule-context";
import { ResearchProvider } from "@/providers/research-context";
import { LogProvider } from "@/providers/log-context";
import { LiteratureProvider } from "@/providers/literature-context";
import { UIProvider } from "@/providers/ui-context";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" ...>
      <body>
        <AuthProvider>
          <UIProvider>
            <ScheduleProvider>
              <ResearchProvider>
                <LogProvider>
                  <LiteratureProvider>
                    {children}
                  </LiteratureProvider>
                </LogProvider>
              </ResearchProvider>
            </ScheduleProvider>
          </UIProvider>
        </AuthProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
```

---

## 四、执行步骤

1. 新建 `src/providers/` 目录
2. 按以下顺序创建文件（依赖关系确保编译不中断）：
   - `auth-context.tsx` — 无依赖
   - `ui-context.tsx` — 无依赖
   - `schedule-context.tsx` — 依赖于 `@/lib/types`, `@/lib/normalizers`, `@/lib/schedule-persistence`
   - `research-context.tsx` — 依赖于 `@/lib/research-workflow*`
   - `log-context.tsx` — 依赖于 `@/lib/logs*`
   - `literature-context.tsx` — 依赖于 `@/lib/literature*`
3. 创建对应的 hook 文件（可选，如果 value 直接返回则不必须）
4. 修改 `src/app/layout.tsx` 包裹 Provider
5. 修改 `src/app/page.tsx` 使用 hooks 替代本地 state
6. `npm run build` 验证

## 五、验收标准

- [ ] `npm run build` 无 TypeScript 错误
- [ ] 日程视图正常渲染，事件增删改查无异常
- [ ] 任务控制台所有操作正常
- [ ] 科研工作台数据正常加载
- [ ] 文献页面数据正常加载
- [ ] 日志功能正常
- [ ] 登入/登出正常
- [ ] 模块切换无闪屏（数据缓存正常）
- [ ] page.tsx 行数从 2000+ 降到 400 以内

## 六、注意事项

1. **不要一次性搬运所有 CRUD handler**：先搬事件（events）相关，验证编译通过后再搬任务/打卡/足迹等
2. **`persistState` 闭包陷阱**：`buildPayload` 中使用最新 state 需要从 ref 或 state setter 的函数形式获取，用 ref 保存最新 payload 更可靠
3. **Dependencies 问题**：ScheduleProvider 的 onUpdateEvent 等使用 useCallback 时，deps 建议使用 `[user]` 并内部读取 ref，避免不必要的重渲染
4. **Provider 嵌套顺序**：AuthProvider 在最外层（其他 provider 可能需要 user）
