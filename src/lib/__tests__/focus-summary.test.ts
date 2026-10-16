import { describe, expect, it } from "vitest";
import { focusDaySummary, focusHistory, focusTargets, normalizeFocusState, type FocusState } from "../execution-insights";
import { createProjectBoard } from "../project-boards";

describe("focus goals and summaries", () => {
  it("adds work segments without counting the paused gap or counting an unfinished run", () => {
    const start = new Date(2026, 9, 16, 10).getTime();
    const state: FocusState = { sessions: [
      { id: "task", title: "数据核验", category: "科研", sessionId: "first", runId: "run", startedAt: start, endedAt: start + 60000 },
      { id: "task", title: "数据核验", category: "科研", sessionId: "second", runId: "run", startedAt: start + 6 * 60000, endedAt: start + 7 * 60000 },
    ], active: { id: "task", title: "数据核验", category: "科研", runId: "run", startedAt: start + 10 * 60000, elapsedMs: 120000 } };
    expect(focusHistory(state.sessions)).toHaveLength(1);
    expect(focusHistory(state.sessions)[0].durationMs).toBe(120000);
    expect(focusDaySummary(state, new Date(start + 10.5 * 60000))).toEqual({ minutes: 2.5, completed: 0 });
    expect(focusDaySummary({ ...state, active: null }, new Date(start + 10.5 * 60000))).toEqual({ minutes: 2, completed: 1 });
  });

  it("splits saved and currently running work at midnight", () => {
    const midnight = new Date(2026, 9, 16).getTime();
    const state: FocusState = { sessions: [{ id: "night", title: "夜间", category: "任务", sessionId: "one", startedAt: midnight - 600000, endedAt: midnight + 600000 }], active: { id: "current", title: "当前", category: "任务", elapsedMs: 0, startedAt: midnight + 600000 } };
    expect(focusDaySummary(state, new Date(midnight + 900000)).minutes).toBe(15);
  });

  it("keeps legacy focus records and removes invalid goal metadata", () => {
    const normalized = normalizeFocusState({ active: { id: "a", title: "旧记录", category: "任务", startedAt: null, elapsedMs: 60000, goalMinutes: -25, runId: 123 }, sessions: [] });
    expect(normalized.active).toEqual({ id: "a", title: "旧记录", category: "任务", startedAt: null, elapsedMs: 60000 });
  });

  it("omits completed and archived project tasks from the target chooser", () => {
    const board = createProjectBoard("research", "用地诊断");
    board.tasks[0].status = "done";
    const archived = { ...createProjectBoard("learning", "旧计划"), archived: true };
    const targets = focusTargets([], [], [board, archived], "2026-10-16");
    expect(targets.filter((target) => target.group === "项目任务")).toHaveLength(3);
    expect(targets.find((target) => target.title === board.tasks[0].title)).toBeUndefined();
    expect(targets.find((target) => target.category === "旧计划")).toBeUndefined();
  });
});
