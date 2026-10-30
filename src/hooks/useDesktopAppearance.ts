"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import type { DashboardUiPreferences } from "@/lib/types";
import "@/lib/desktop-auth";

export function useDesktopAppearance(owner: string | null, ready: boolean, appearance: DashboardUiPreferences["desktopAppearance"], setPreferences: Dispatch<SetStateAction<DashboardUiPreferences>>) {
  useEffect(() => {
    if (!owner || !ready) return;
    return window.rcapDesktopAuth?.onAppearanceChange?.((desktopAppearance) => {
      setPreferences((previous) => ({ ...previous, desktopAppearance }));
    });
  }, [owner, ready, setPreferences]);

  useEffect(() => {
    const desktop = window.rcapDesktopAuth;
    if (!owner || !ready || !desktop?.getAppearance || !desktop.applyAppearance) return;
    let active = true;
    if (appearance) {
      void desktop.applyAppearance(appearance).catch((error: Error) => { if (active) toast.error(`桌面外观应用失败：${error.message}`); });
    } else {
      // Migrate this computer's legacy values only when the account has no saved appearance.
      void desktop.getAppearance().then((desktopAppearance) => {
        if (active) setPreferences((previous) => previous.desktopAppearance ? previous : { ...previous, desktopAppearance });
      }).catch((error: Error) => { if (active) toast.error(`桌面外观读取失败：${error.message}`); });
    }
    return () => { active = false; };
  }, [owner, ready, appearance, setPreferences]);
}
