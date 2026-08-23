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

type ChatSessionRecord = {
  id: string;
  title: string;
  messages: unknown[];
  contextSources: unknown[];
  createdAt: string;
  updatedAt: string;
};

type SyncMetaRecord = {
  userId: string;
  lastSyncTimestamp: string;
  pendingChanges: number;
};

interface AppDBSchema extends DBSchema {
  "schedule-data": {
    key: string;
    value: UserPayloadRecord;
  };
  logs: {
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

type AppStoreName = StoreNames<AppDBSchema>;
type AppDatabase = IDBPDatabase<AppDBSchema>;

let dbInstance: AppDatabase | null = null;

async function getDB(): Promise<AppDatabase> {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AppDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("schedule-data")) {
        db.createObjectStore("schedule-data", { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains("logs")) {
        db.createObjectStore("logs", { keyPath: "userId" });
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
