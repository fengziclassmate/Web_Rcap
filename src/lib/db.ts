import { openDB, type DBSchema, type IDBPDatabase, type StoreNames } from "idb";

const DB_NAME = "schedule-app";
const DB_VERSION = 1;

type UserPayloadRecord = {
  userId: string;
  payload?: unknown;
  items?: unknown[];
  tags?: unknown[];
  attachments?: unknown[];
  updatedAt: string;
};

export type ChatSessionRecord = {
  id: string;
  title: string;
  messages: unknown[];
  contextSources: unknown[];
  createdAt: string;
  updatedAt: string;
};

export type SyncMetaRecord = {
  userId: string;
  lastSyncTimestamp: string;
  pendingChanges: number;
};

interface AppDBSchema extends DBSchema {
  "schedule-data": {
    key: string;
    value: UserPayloadRecord;
  };
  "research-workflow": {
    key: string;
    value: UserPayloadRecord;
  };
  logs: {
    key: string;
    value: UserPayloadRecord;
  };
  literature: {
    key: string;
    value: UserPayloadRecord;
  };
  "chat-sessions": {
    key: string;
    value: ChatSessionRecord;
  };
  "sync-meta": {
    key: string;
    value: SyncMetaRecord;
  };
}

export type AppStoreName = StoreNames<AppDBSchema>;
export type AppDatabase = IDBPDatabase<AppDBSchema>;

let dbInstance: AppDatabase | null = null;

export async function getDB(): Promise<AppDatabase> {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AppDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
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

export async function dbGet<T>(storeName: AppStoreName, key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get(storeName, key) as Promise<T | undefined>;
}

export async function dbGetAll<T>(storeName: AppStoreName): Promise<T[]> {
  const db = await getDB();
  return db.getAll(storeName) as Promise<T[]>;
}

export async function dbPut<T>(storeName: AppStoreName, value: T): Promise<void> {
  const db = await getDB();
  await db.put(storeName, value as never);
}

export async function dbDelete(storeName: AppStoreName, key: string): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, key);
}

export async function dbClear(storeName: AppStoreName): Promise<void> {
  const db = await getDB();
  await db.clear(storeName);
}
