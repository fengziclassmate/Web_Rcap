import { describe, expect, it } from "vitest";
import { elapsedFocusMs, focusDaySummary, focusHistory, weeklyInsights, type FocusSession } from "../execution-insights";
import { mergeScheduleChanges } from "../schedule-merge";
import { normalizePersistedSchedulePayload } from "../schedule-persistence";

const empty = () => normalizePersistedSchedulePayload({})!;
const start = new Date(2026, 9, 16, 10).getTime();
const segment: FocusSession = { id: "task", title: "数据核验", category: "科研", sessionId: "one", runId: "run", startedAt: start, endedAt: start + 60000 };

describe("cross-device focus merge", () => {
  it("unions immutable history and keeps independently started timers atomic", () => {
    const base = empty();
    const local = { ...base, focus_state: { active: { id: "local", title: "本机任务", category: "科研", runId: "local-run", startedAt: start, elapsedMs: 0 }, sessions: [segment] } };
    const remote = { ...base, focus_state: { active: { id: "remote", title: "另一台电脑", category: "学习", runId: "remote-run", startedAt: start + 1000, elapsedMs: 3000 }, sessions: [{ ...segment, sessionId: "two", runId: "other", startedAt: start - 120000, endedAt: start - 60000 }] } };
    const merged = mergeScheduleChanges(base, local, remote);
    expect(merged.conflicts).toEqual(["schedule.focus_state.active"]);
    expect(merged.value.focus_state?.active).toEqual(local.focus_state.active);
    expect(merged.value.focus_state?.sessions).toHaveLength(2);
    expect(mergeScheduleChanges(base, local, remote, "remote").value.focus_state?.active).toEqual(remote.focus_state.active);
  });

  it("does not resurrect a timer finished on another device when the local timer is unchanged", () => {
    const base = { ...empty(), focus_state: { active: { id: "task", title: "任务", category: "科研", runId: "run", startedAt: start, elapsedMs: 0 }, sessions: [] } };
    const remote = { ...base, focus_state: { active: null, sessions: [segment] } };
    expect(mergeScheduleChanges(base, base, remote).value.focus_state).toEqual(remote.focus_state);
  });

  it("deduplicates retries and overlapping pauses from two devices in every statistic", () => {
    const base = empty();
    const local = { ...base, focus_state: { active: null, sessions: [segment] } };
    const remote = { ...base, focus_state: { active: null, sessions: [segment, { ...segment, sessionId: "remote-pause", endedAt: start + 120000 }] } };
    const merged = mergeScheduleChanges(base, local, remote).value.focus_state!;
    expect(merged.sessions).toHaveLength(2);
    expect(focusHistory(merged.sessions)[0].durationMs).toBe(120000);
    expect(focusDaySummary(merged, new Date(start + 180000))).toEqual({ minutes: 2, completed: 1 });
    expect(weeklyInsights([], [], merged.sessions, new Date(start), new Date(start)).actual).toBe(2);
    expect(elapsedFocusMs({ ...merged, active: { id: "task", title: "任务", category: "科研", runId: "run", startedAt: start + 60000, elapsedMs: 60000 } }, start + 180000)).toBe(180000);
  });
});
