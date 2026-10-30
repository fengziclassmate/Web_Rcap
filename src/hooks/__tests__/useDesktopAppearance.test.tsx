import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppearance } from "../useDesktopAppearance";
import { defaultDashboardUiPreferences } from "@/lib/normalizers";
import type { DashboardUiPreferences, DesktopAppearance } from "@/lib/types";

let change: ((value: DesktopAppearance) => void) | undefined;
const unsubscribe = vi.fn();
const getAppearance = vi.fn();
const applyAppearance = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  getAppearance.mockResolvedValue({ backgroundOpacity: 55, cardOpacity: 70 });
  applyAppearance.mockResolvedValue(undefined);
  window.rcapDesktopAuth = { report: vi.fn(), getAppearance, applyAppearance, onAppearanceChange: (callback) => { change = callback; return unsubscribe; } };
});
afterEach(() => { cleanup(); delete window.rcapDesktopAuth; });

describe("account desktop appearance", () => {
  it("waits for account hydration, uses cloud values over the local cache, and saves slider changes", async () => {
    const { result, rerender, unmount } = renderHook(({ ready }) => {
      const [preferences, setPreferences] = useState<DashboardUiPreferences>({ ...defaultDashboardUiPreferences, desktopAppearance: { backgroundOpacity: 35, cardOpacity: 65 } });
      useDesktopAppearance("account-a", ready, preferences.desktopAppearance, setPreferences);
      return preferences;
    }, { initialProps: { ready: false } });
    expect(applyAppearance).not.toHaveBeenCalled();
    rerender({ ready: true });
    await waitFor(() => expect(applyAppearance).toHaveBeenCalledWith({ backgroundOpacity: 35, cardOpacity: 65 }));
    expect(getAppearance).not.toHaveBeenCalled();
    act(() => change!({ backgroundOpacity: 45, cardOpacity: 75 }));
    expect(result.current.desktopAppearance).toEqual({ backgroundOpacity: 45, cardOpacity: 75 });
    await waitFor(() => expect(applyAppearance).toHaveBeenLastCalledWith({ backgroundOpacity: 45, cardOpacity: 75 }));
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("imports legacy local values only when this account has no saved appearance", async () => {
    const { result } = renderHook(() => {
      const [preferences, setPreferences] = useState(defaultDashboardUiPreferences);
      useDesktopAppearance("account-a", true, preferences.desktopAppearance, setPreferences);
      return preferences;
    });
    await waitFor(() => expect(result.current.desktopAppearance).toEqual({ backgroundOpacity: 55, cardOpacity: 70 }));
    expect(getAppearance).toHaveBeenCalledOnce();
    expect(applyAppearance).toHaveBeenCalledWith(result.current.desktopAppearance);
  });

  it("discards an unfinished migration after the account signs out", async () => {
    let resolve!: (value: DesktopAppearance) => void;
    getAppearance.mockReturnValue(new Promise<DesktopAppearance>((done) => { resolve = done; }));
    const save = vi.fn();
    const { rerender } = renderHook(({ owner }: { owner: string | null }) => useDesktopAppearance(owner, true, undefined, save), { initialProps: { owner: "account-a" as string | null } });
    rerender({ owner: null });
    await act(async () => { resolve({ backgroundOpacity: 55, cardOpacity: 70 }); });
    expect(save).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
