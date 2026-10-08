"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribeToNetworkStatus(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

export function NetworkBanner() {
  const online = useSyncExternalStore(
    subscribeToNetworkStatus,
    () => navigator.onLine,
    () => true,
  );

  if (online) return null;

  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[70] flex justify-center px-4 py-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 shadow-lg">
        <WifiOff className="h-4 w-4" />
        当前离线：日程与任务保存在本机；日志发布和消费记录需要联网。
      </div>
    </div>
  );
}
