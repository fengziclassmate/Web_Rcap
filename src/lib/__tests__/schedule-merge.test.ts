import { describe, expect, it } from "vitest";
import { normalizePersistedSchedulePayload } from "../schedule-persistence";
import { mergeScheduleChanges } from "../schedule-merge";

const snapshot = (tasks: unknown[]) => normalizePersistedSchedulePayload({ tasks })!;
describe("concurrent schedule changes", () => {
  it("merges each panel row as one choice when devices open different panels", () => {
    const base = snapshot([]);
    const local = { ...base, ui_preferences: { ...base.ui_preferences, shoppingSectionOpen: true } };
    const remote = { ...base, ui_preferences: { ...base.ui_preferences, annualSectionOpen: true } };
    const merged = mergeScheduleChanges(base, local, remote);
    expect(merged.value.ui_preferences).toMatchObject({ shoppingSectionOpen: true, annualSectionOpen: false, longTaskSectionOpen: false });
    expect(merged.conflicts).toEqual(["schedule.ui_preferences.taskListPanel"]);
    expect(mergeScheduleChanges(base, local, remote, "remote").value.ui_preferences).toMatchObject({ shoppingSectionOpen: false, annualSectionOpen: true });
  });

  it("keeps independent panel choices from different rows", () => {
    const base = snapshot([]);
    const local = { ...base, ui_preferences: { ...base.ui_preferences, shoppingSectionOpen: true } };
    const remote = { ...base, ui_preferences: { ...base.ui_preferences, footprintSectionOpen: true } };
    const merged = mergeScheduleChanges(base, local, remote);
    expect(merged.conflicts).toEqual([]);
    expect(merged.value.ui_preferences).toMatchObject({ shoppingSectionOpen: true, footprintSectionOpen: true, annualSectionOpen: false, projectSectionOpen: false });
    expect(JSON.stringify(merged.value.ui_preferences)).toBe(JSON.stringify(normalizePersistedSchedulePayload(merged.value)!.ui_preferences));
  });

  it("retains independent additions from two devices", () => {
    const result = mergeScheduleChanges(snapshot([]), snapshot([{ id: "a", name: "A" }]), snapshot([{ id: "b", name: "B" }]));
    expect(result.value.tasks.map((item) => item.id).sort()).toEqual(["a", "b"]);
    expect(result.conflicts).toEqual([]);
  });
  it("merges a title edit with a completion made on another device", () => {
    const base = snapshot([{ id: "a", name: "original", done: false }]);
    const result = mergeScheduleChanges(base, snapshot([{ id: "a", name: "changed", done: false }]), snapshot([{ id: "a", name: "original", done: true }]));
    expect(result.value.tasks[0]).toMatchObject({ name: "changed", done: true });
    expect(result.conflicts).toEqual([]);
  });
  it("keeps a deletion when the other device did not edit that task", () => {
    const base = snapshot([{ id: "a" }]);
    const result = mergeScheduleChanges(base, snapshot([]), snapshot([{ id: "a" }, { id: "b" }]));
    expect(result.value.tasks.map((item) => item.id)).toEqual(["b"]);
  });
  it("requires a choice when a deletion conflicts with an edit", () => {
    const base = snapshot([{ id: "a", name: "original" }]);
    const remote = snapshot([{ id: "a", name: "remote edit" }]);
    expect(mergeScheduleChanges(base, snapshot([]), remote).conflicts).toEqual(["schedule.tasks[a]"]);
    expect(mergeScheduleChanges(base, snapshot([]), remote, "remote").value.tasks[0].name).toBe("remote edit");
  });
});
