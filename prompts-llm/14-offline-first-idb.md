# Prompt 14 — 离线优先：IndexedDB 本地主存储 + 后台同步

> **依赖：** 推荐在 Prompt 09（Context 拆分）和 Prompt 10（React Query）之后执行
> **目标：** 将本地存储从 localStorage（同步写入，5MB 限制）迁移到 IndexedDB（异步写入，无大小限制），实现离线优先架构

---

## 一、为什么需要离线优先

| 现状痛点 | 改进后 |
|---------|--------|
| localStorage 5MB 上限，文献附件/日志图片很快就会占满 | IndexedDB 理论上无上限 |
| localStorage 写操作阻塞主线程 | IndexedDB 异步读写，不阻塞 UI |
| 依赖 Supabase 在线，网络断开时功能受限 | 离线时可正常读写，上线后自动同步 |
| Supabase 查询每次往返 200-500ms | 本地读几乎是即时响应 |
| 桌面浏览器网络不稳定时体验断裂 | 离线模式 → 用户无感知 |

---

## 二、新增依赖

```bash
cd "C:\Users\25371\Desktop\日程安排_app"
npm install idb
```

`idb` 是一个 Promise 包装的 IndexedDB 库，比原生 IDB API 好用很多。

---

## 三、新增文件：`src/lib/db.ts`

定义全局 IndexedDB 数据库。共用一个数据库，按 Store 隔离数据类型：

```typescript
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "schedule-app";
const DB_VERSION = 1;

export type AppDatabase = IDBPDatabase<AppDBSchema>;

export type AppDBSchema = {
  /** 日程数据（单行 JSON，类似 schedule_data 表） */
  "schedule-data": {
    key: string;       // user_id
    value: {
      userId: string;
      payload: any;    // PersistedSchedulePayload
      updatedAt: string;
    };
  };
  /** 科研工作台数据 */
  "research-workflow": {
    key: string;       // user_id
    value: {
      userId: string;
      payload: any;    // ResearchWorkflowState
      updatedAt: string;
    };
  };
  /** 日志数据 */
  logs: {
    key: string;       // user_id
    value: {
      userId: string;
      posts: any[];
      tags: any[];
      updatedAt: string;
    };
  };
  /** 文献数据 */
  literature: {
    key: string;       // user_id
    value: {
      userId: string;
      items: any[];
      tags: any[];
      attachments: any[];
      updatedAt: string;
    };
  };
  /** LLM 对话历史 */
  "chat-sessions": {
    key: string;       // session_id
    value: {
      id: string;
      title: string;
      messages: any[];
      contextSources: any[];
      createdAt: string;
      updatedAt: string;
    };
  };
  /** 离线缓存版本追踪（给同步引擎用） */
  "sync-meta": {
    key: string;       // user_id
    value: {
      userId: string;
      lastSyncTimestamp: string;
      pendingChanges: number;
    };
  };
};

/** 全局单例 DB */
let dbInstance: AppDatabase | null = null;

export async function getDB(): Promise<AppDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<AppDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 所有 Store 都使用 key-value 模式
      if (!db.objectStoreNames.contains("schedule-data")) {
        db.createObjectStore("schedule-data", { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains("research-workflow")) {
        db.createObjectStore("research-workflow", { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains("logs")) {
        db.createObjectStore("logs", { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains("literature")) {
        db.createObjectStore("literature", { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains("chat-sessions")) {
        db.createObjectStore("chat-sessions", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sync-meta")) {
        db.createObjectStore("sync-meta", { keyPath: "userId" });
      }
    },
  });
  return dbInstance;
}

/** 快速读 */
export async function dbGet<T>(storeName: keyof AppDBSchema, key: string): Promise<T | undefined> {
  const db = await getDB();
  return (db as any).get(storeName, key) as Promise<T | undefined>;
}

/** 快速写 */
export async function dbPut<T>(storeName: keyof AppDBSchema, value: T): Promise<void> {
  const db = await getDB();
  await (db as any).put(storeName, value);
}

/** 批量写（一个 transaction 完成，性能好） */
export async function dbBulkPut<T>(
  items: Array<{ storeName: keyof AppDBSchema; value: T }>,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(items.map((i) => i.storeName), "readwrite");
  for (const { storeName, value } of items) {
    (tx as any).objectStore(storeName).put(value);
  }
  await tx.done;
}

/** 删除 */
export async function dbDelete(storeName: keyof AppDBSchema, key: string): Promise<void> {
  const db = await getDB();
  await (db as any).delete(storeName, key);
}
```

---

## 四、新增文件：`src/lib/sync-engine.ts`

后台同步引擎，管理本地 ↔ 远程的数据同步：

```typescript
import { format } from "date-fns";
import { supabase } from "./supabase";
import { getDB, dbGet, dbPut } from "./db";

/** 同步状态 */
export type SyncStatus = "idle" | "syncing" | "error" | "offline";

/** 同步事件回调 */
export type SyncListener = (status: SyncStatus, message?: string) => void;

class SyncEngine {
  private listeners: Set<SyncListener> = new Set();
  private status: SyncStatus = "idle";
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isOnline = navigator.onLine;
  private userId: string | null = null;

  constructor() {
    // 监听网络状态变化
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.triggerSync();
    });
    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.setStatus("offline", "当前离线运行");
    });
  }

  /** 初始化（绑定用户后调用） */
  init(userId: string) {
    this.userId = userId;
    this.syncTimer = setInterval(() => this.triggerSync(), 5 * 60 * 1000); // 每 5 分钟
    if (this.isOnline) this.triggerSync();
  }

  /** 销毁 */
  destroy() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.listeners.clear();
  }

  /** 订阅同步状态变化 */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 触发同步 */
  async triggerSync() {
    if (!this.userId || !this.isOnline || this.status === "syncing") return;
    this.setStatus("syncing");
    try {
      // 1. 同步 schedule_data
      await this.syncStore("schedule-data", "schedule_data");
      // 2. 同步 research-workflow
      await this.syncStore("research-workflow", "research_data");
      // 3. 同步日志
      await this.syncLogs();
      // 4. 更新同步元数据
      await dbPut("sync-meta", {
        userId: this.userId,
        lastSyncTimestamp: new Date().toISOString(),
        pendingChanges: 0,
      });
      this.setStatus("idle", `最后同步: ${format(new Date(), "HH:mm")}`);
    } catch (error) {
      this.setStatus("error", `同步失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  /** 通用 Store 同步 */
  private async syncStore(localStore: string, remoteTable: string) {
    const localData = await dbGet<any>(localStore as any, this.userId!);
    if (!localData) return;

    const { error } = await supabase
      .from(remoteTable)
      .upsert({
        user_id: this.userId!,
        payload: localData.payload,
        updated_at: localData.updatedAt,
      });
    if (error) throw error;
  }

  /** 日志同步（多表） */
  private async syncLogs() {
    const localData = await dbGet<any>("logs", this.userId!);
    if (!localData) return;
    // ... 逐表 upsert 逻辑，参考 page.tsx 中 saveLogPosts 等
  }

  private setStatus(status: SyncStatus, message?: string) {
    this.status = status;
    this.listeners.forEach((fn) => fn(status, message));
  }

  getStatus() { return this.status; }
  getIsOnline() { return this.isOnline; }
}

/** 全局单例 */
export const syncEngine = new SyncEngine();
```

---

## 五、新建 `src/components/schedule/sync-indicator.tsx`

同步状态指示器组件，显示在 sidebar 或 header 上：

```tsx
"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncEngine, type SyncStatus } from "@/lib/sync-engine";

export function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newStatus, msg) => {
      setStatus(newStatus);
      if (msg) setMessage(msg);
    });
    setStatus(syncEngine.getStatus());
    return unsubscribe;
  }, []);

  const config: Record<SyncStatus, { icon: React.ReactNode; color: string; label: string }> = {
    idle:      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-green-500", label: "已同步" },
    syncing:   { icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />, color: "text-blue-500", label: "同步中…" },
    error:     { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-amber-500", label: message ?? "同步失败" },
    offline:   { icon: <CloudOff className="h-3.5 w-3.5" />, color: "text-gray-400", label: "离线模式" },
  };

  const { icon, color, label } = config[status];

  return (
    <div className={cn("inline-flex items-center gap-1.5 text-xs", color)} title={label}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}
```

---

## 六、修改 Provider 使用 IndexedDB 替代 localStorage

以 `ScheduleContext` 为例，不再用 localStorage 备份，改用 IndexedDB：

```typescript
// 在 ScheduleProvider 内部：

/** 写时优先存本地 IndexedDB，后台推远程 */
async function persistToLocal(payload: PersistedSchedulePayload) {
  await dbPut("schedule-data", {
    userId: user?.id ?? "local",
    payload,
    updatedAt: new Date().toISOString(),
  });
}

/** 读时优先 IndexedDB，其次 localStorage 兜底，最后 Supabase */
async function loadFromLocal(userId: string): Promise<PersistedSchedulePayload | null> {
  const cached = await dbGet<{ payload: PersistedSchedulePayload }>("schedule-data", userId);
  if (cached?.payload) return cached.payload;
  return readScheduleBackupFromLocal(); // 旧数据迁移
}

// 修改 loadUserData: 先读本地 → 再读远程对比更新时间 → 更新本地
async function loadUserData(currentUser: User) {
  // 第一步：立即从 IndexedDB 渲染
  const local = await loadFromLocal(currentUser.id);
  if (local) {
    applyPayload(local);
    setIsDataLoaded(true);
  }

  // 第二步：异步从远程更新
  try {
    const { data, error } = await supabase
      .from("schedule_data")
      .select("*")
      .eq("user_id", currentUser.id)
      .single();
    if (!error && data?.payload) {
      const remotePayload = data.payload as PersistedSchedulePayload;
      applyPayload(remotePayload);
      await persistToLocal(remotePayload); // 缓存到本地
    }
  } catch {
    // 远程不可用 → 保持本地数据
  }
}
```

---

## 七、网络监测组件（可选）

```tsx
// src/components/schedule/network-banner.tsx
"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function NetworkBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const online = () => setOffline(false);
    const offline = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className={cn(
      "fixed bottom-4 left-1/2 z-50 -translate-x-1/2",
      "flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200",
      "px-4 py-2 text-sm text-amber-800 shadow-lg",
    )}>
      <WifiOff className="h-4 w-4" />
      <span>当前离线运行，数据将在恢复网络后自动同步</span>
    </div>
  );
}
```

---

## 八、在 `layout.tsx` 初始化同步引擎

```tsx
// layout.tsx
"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { syncEngine } from "@/lib/sync-engine";
import { SyncIndicator } from "@/components/schedule/sync-indicator";
import { NetworkBanner } from "@/components/schedule/network-banner";

function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) syncEngine.init(session.user.id);
    });
    return () => syncEngine.destroy();
  }, []);

  return (
    <>
      {children}
      <SyncIndicator />
      <NetworkBanner />
    </>
  );
}
```

---

## 九、执行步骤

1. `npm install idb`
2. 新建 `src/lib/db.ts`
3. 新建 `src/lib/sync-engine.ts`
4. 新建 `src/components/schedule/sync-indicator.tsx`
5. 新建 `src/components/schedule/network-banner.tsx`
6. 修改所有 Provider（Schedule / Research / Log / Literature）使用 IndexedDB 作为主存储
7. 初始化同步引擎在 layout 中
8. `npm run build` 验证

## 十、验收标准

- [ ] 首次打开后 IndexedDB 中存入数据，开发者工具 Application → IndexedDB 可见
- [ ] 断开网络（F12 → Network → Offline），所有增删改操作正常
- [ ] 恢复网络后，离线期间的修改自动推送到 Supabase
- [ ] 同步状态指示器正确显示 "已同步"/"同步中"/"离线模式"
- [ ] 5MB 限制的愁没有了——附件图片/大量数据能正常存储
- [ ] `npm run build` 无 TypeScript 错误
