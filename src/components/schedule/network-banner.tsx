"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function NetworkBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex justify-center px-4 py-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 shadow-lg">
        <WifiOff className="h-4 w-4" />
        当前处于离线状态，新数据会先保存在本地，联网后再同步。
      </div>
    </div>
  );
}
