export type SyncStatus = "idle" | "syncing" | "error" | "offline";

type SyncListener = (status: SyncStatus, message?: string) => void;

class SyncEngine {
  private listeners = new Set<SyncListener>();
  private userId: string | null = null;
  private status: SyncStatus = "idle";
  private message = "已就绪";
  private onlineHandler = () => this.setStatus("idle", "网络已恢复");
  private offlineHandler = () => this.setStatus("offline", "当前离线，变更会先保存在本地");

  init(userId: string) {
    this.userId = userId;
    this.destroyListeners();

    if (typeof window !== "undefined") {
      window.addEventListener("online", this.onlineHandler);
      window.addEventListener("offline", this.offlineHandler);
      this.setStatus(navigator.onLine ? "idle" : "offline", navigator.onLine ? "已就绪" : "当前离线");
    }
  }

  destroy() {
    this.userId = null;
    this.destroyListeners();
    this.setStatus("idle", "已就绪");
  }

  getUserId() {
    return this.userId;
  }

  getSnapshot() {
    return { status: this.status, message: this.message };
  }

  subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    listener(this.status, this.message);
    return () => {
      this.listeners.delete(listener);
    };
  }

  markSyncing(message = "正在同步") {
    this.setStatus("syncing", message);
  }

  markIdle(message = "已同步") {
    this.setStatus("idle", message);
  }

  markError(message = "同步失败") {
    this.setStatus("error", message);
  }

  private destroyListeners() {
    if (typeof window === "undefined") return;
    window.removeEventListener("online", this.onlineHandler);
    window.removeEventListener("offline", this.offlineHandler);
  }

  private setStatus(status: SyncStatus, message?: string) {
    this.status = status;
    this.message = message ?? "";
    for (const listener of this.listeners) listener(this.status, this.message);
  }
}

export const syncEngine = new SyncEngine();
