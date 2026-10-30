export const desktopLoginStateKey = "rcap-desktop-login-state";

declare global {
  interface Window {
    rcapDesktopAuth?: {
      report: (state: { signedIn: boolean; error: string | null }) => void;
      openBrowserLogin?: () => Promise<void>;
      onAuthorization?: (callback: (token: string) => void) => () => void;
    };
  }
}

export function loginErrorMessage(error: { message: string; code?: string }) {
  if (error.code === "otp_expired" || /expired|already.used|invalid.*link/i.test(error.message)) return "登录链接已过期或已使用，请重新发送并打开最新邮件。";
  if (/code.verifier|flow.state|pkce/i.test(error.message)) return "此链接无法在当前窗口完成登录，请从桌面版重新发送登录邮件。";
  return `登录失败：${error.message}`;
}
