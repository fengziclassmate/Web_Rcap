import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWeeklyReportData, buildWeeklyReportPrompt } from "../report/weekly-report";
import { buildEfficiencyStats } from "../llm/analysis-prompts";
import { parseQuickCreateResponse } from "../llm/quick-create-prompts";
import { resolveLLMEndpoint } from "../llm/endpoint";
import { normalizeEvents, normalizeTasks, normalizeProjectCheckins } from "../normalizers";

afterEach(() => vi.useRealTimers());
describe("report data and AI input boundaries", () => {
  it("counts recurring instances, overnight segments and actual task completion dates", () => {
    const events = normalizeEvents([
      { date: "2026-09-01", title: "阅读", startHour: 9, endHour: 9.5, recurrence: { kind: "daily" } },
      { date: "2026-10-02", title: "实验", startHour: 23, endHour: 1 },
    ]);
    const tasks = normalizeTasks([{ name: "提前完成", done: true, dueDate: "2026-11-01", completedAt: "2026-10-02T10:00:00" }]);
    const report = buildWeeklyReportData(new Date(2026, 8, 28, 10), events, tasks, []);
    expect(report.events.filter((event) => event.title === "阅读")).toHaveLength(7);
    expect(report.categoryHours.reduce((sum, item) => sum + item.hours, 0)).toBe(5.5);
    expect(report.completedTasks).toHaveLength(1);
    expect(buildWeeklyReportPrompt(report)).toContain("09:00-09:30");
  });
  it("includes the whole first day and clips overnight hours at the report boundary", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 2, 18));
    const events = normalizeEvents([{ date: "2026-09-25", startHour: 23, endHour: 2 }, { date: "2026-09-26", startHour: 8, endHour: 9 }]);
    const stats = buildEfficiencyStats(7, events, [], [], []);
    expect(stats.categoryHours.reduce((sum, item) => sum + item.hours, 0)).toBe(3);
  });
  it("rejects invalid AI dates and times before confirmation", () => {
    for (const value of [null, { type: "event", title: "x", date: "2026-99-99", startHour: 30, endHour: -2 }, { type: "task", title: "x", dueDate: "2026-02-30" }]) {
      expect(() => parseQuickCreateResponse(JSON.stringify(value))).toThrow();
    }
    expect(parseQuickCreateResponse('{"type":"event","title":"夜间实验","date":"2026-10-02","startHour":23,"endHour":1}').type).toBe("event");
  });
  it("ignores malformed stored records without crashing the entire workspace", () => {
    expect(normalizeEvents([null, 2, { title: "保留" }])).toHaveLength(1);
    expect(normalizeTasks([{ subtasks: [null, { name: "保留" }] }])[0].subtasks).toHaveLength(1);
    expect(normalizeProjectCheckins([{ checkins: [null], dailyCheckins: [null] }])[0].checkins).toEqual([]);
  });
  it("only sends provider credentials to a server-trusted HTTPS destination", () => {
    const config = { provider: "openai" as const, apiKey: "dummy", model: "dummy" };
    expect(resolveLLMEndpoint(config, "")).toBe("https://api.openai.com/v1/chat/completions");
    for (const baseUrl of ["http://127.0.0.1", "https://api.openai.com.evil.invalid", "https://api.openai.com@evil.invalid", "https://evil.invalid"]) {
      expect(() => resolveLLMEndpoint({ ...config, baseUrl }, "")).toThrow();
    }
  });
});
