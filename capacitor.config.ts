import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.schedule.personal",
  appName: "个人日程管理",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
