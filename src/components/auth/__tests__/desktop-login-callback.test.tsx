import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DesktopLoginCallback } from "../desktop-login-callback";

afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

describe("desktop email callback", () => {
  it("returns only the authorization code and state to the desktop app", () => {
    window.history.replaceState(null, "", "/auth/desktop?code=one-time-code&state=desktop-state");
    render(<DesktopLoginCallback />);
    expect(screen.getByRole("link", { name: "打开桌面版并登录" }).getAttribute("href")).toBe("rcap-desktop://auth?code=one-time-code&state=desktop-state");
  });
  it("explains an expired or consumed link instead of displaying a silent login screen", () => {
    window.history.replaceState(null, "", "/auth/desktop#error=access_denied&error_code=otp_expired&error_description=Email%20link%20has%20expired");
    render(<DesktopLoginCallback />);
    expect(screen.getByRole("alert").textContent).toContain("已过期或已使用");
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("does not forward access or refresh tokens from an old link", () => {
    window.history.replaceState(null, "", "/auth/desktop#access_token=not-a-real-token&refresh_token=not-a-real-refresh");
    render(<DesktopLoginCallback />);
    expect(screen.getByRole("alert").textContent).toContain("重新发送");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
