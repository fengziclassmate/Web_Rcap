import { describe, expect, it, vi } from "vitest";
import {
  ConcurrentScheduleError, runNotionSync,
  type ScheduleSnapshot, type SyncConfig, type SyncLedger, type SyncStore,
} from "./worker.ts";
import {
  NotionApiError, notionTextValue,
  type NotionClient, type NotionPage, type NotionProperty, type NotionPropertyWrites, type NotionQueryFilter,
} from "./notion-client.ts";

const enabledAt = "2026-11-18T00:00:00.000Z";
const oldTime = "2026-11-17T00:00:00.000Z";
const currentTime = "2026-11-18T05:00:00.000Z";
const currentDay = "2026-11-18";
const options = { now: new Date(currentTime) };
const todo = { dataSourceId: "todo", title: "title", date: "plan", notes: "notes", status: "status", rcapId: "rcap-id" };
const daily = {
  dataSourceId: "daily", title: "title", date: "date", bindings: [
    { projectId: "reading", checkbox: "reading-box", note: "reading-note" },
    { projectId: "writing", checkbox: "writing-box" },
  ],
};
const config: SyncConfig = { enabledAt, todo, daily };

function mockTask(id: string, extra: Partial<ScheduleSnapshot["tasks"][number]> = {}) {
  return { id, taskType: "daily", name: id, dueDate: currentDay, done: false, notes: "", createdAt: currentTime, ...extra };
}

function mockProject(id: string, dates: { date: string; note: string }[] = []) {
  return { id, startDate: "2026-11-16", checkins: dates, archives: [] as { id: string }[] };
}

function taskPage(id: string, overrides: NotionPropertyWrites = {}, created = currentTime) {
  return page(id, "todo", {
    title: { title: notionTextValue(id) }, plan: { date: null }, notes: { rich_text: [] },
    status: { select: { name: "进行中" } }, "rcap-id": { rich_text: [] }, ...overrides,
  }, created);
}

function dayPage(id: string, date: string, overrides: NotionPropertyWrites = {}, time = oldTime) {
  return page(id, "daily", {
    title: { title: notionTextValue(date) }, date: { date: { start: date } },
    "reading-box": { checkbox: false }, "reading-note": { rich_text: [] }, "writing-box": { checkbox: false },
    untouched: { rich_text: notionTextValue("personal") }, ...overrides,
  }, time);
}

function page(id: string, source: string, properties: NotionPropertyWrites, created: string): NotionPage {
  return {
    object: "page", id, created_time: created, last_edited_time: created, in_trash: false,
    parent: { type: "data_source_id", data_source_id: source }, properties: materialize(properties),
  };
}

function materialize(properties: NotionPropertyWrites): Record<string, NotionProperty> {
  return Object.fromEntries(Object.entries(properties).map(([id, value]) => {
    if ("title" in value) return [id, { id, type: "title", title: value.title }];
    if ("rich_text" in value) return [id, { id, type: "rich_text", rich_text: value.rich_text }];
    if ("date" in value) return [id, { id, type: "date", date: value.date }];
    if ("checkbox" in value) return [id, { id, type: "checkbox", checkbox: value.checkbox }];
    if ("select" in value) {
      const name = value.select && ("name" in value.select ? value.select.name : value.select.id);
      return [id, { id, type: "select", select: name ? { id: name, name } : null }];
    }
    throw new Error("Unexpected test property");
  }));
}

function passesFilter(page: NotionPage, filter?: NotionQueryFilter): boolean {
  if (!filter) return true;
  if ("and" in filter) return filter.and.every((part) => passesFilter(page, part));
  if ("or" in filter) return filter.or.some((part) => passesFilter(page, part));
  if ("timestamp" in filter) {
    const condition = filter.timestamp === "created_time" ? filter.created_time : filter.last_edited_time;
    expect(Object.keys(condition)).toHaveLength(1);
    const value = page[filter.timestamp];
    return (!condition.on_or_after || value >= condition.on_or_after) && (!condition.on_or_before || value <= condition.on_or_before);
  }
  const property = page.properties[filter.property];
  if ("rich_text" in filter) return property?.type === "rich_text" && property.rich_text[0]?.text?.content === filter.rich_text.equals;
  if (property?.type !== "date" || !property.date) return false;
  expect(Object.keys(filter.date)).toHaveLength(1);
  if (filter.date.equals) return property.date.start === filter.date.equals;
  const time = Date.parse(property.date.start);
  return (!filter.date.on_or_after || time >= Date.parse(filter.date.on_or_after)) && (!filter.date.before || time < Date.parse(filter.date.before));
}

function notion(pages: NotionPage[]) {
  const pageById = new Map(pages.map((entry) => [entry.id, entry]));
  const query = vi.fn<NotionClient["query"]>(async (id, options) => [...pageById.values()]
    .filter((item) => item.parent.data_source_id === id && !item.in_trash && passesFilter(item, options?.filter))
    .slice(0, options?.limit));
  const getPage = vi.fn<NotionClient["getPage"]>(async (id) => {
    const item = pageById.get(id);
    if (!item) throw new NotionApiError(404, "object_not_found", null);
    return item;
  });
  const createPage = vi.fn<NotionClient["createPage"]>(async (source, input) => {
    const id = `new-${pageById.size}`;
    const date = input.date && "date" in input.date ? input.date.date?.start : undefined;
    const item = source === "daily" ? dayPage(id, date!, input, currentTime) : taskPage(id, input);
    pageById.set(id, item);
    return item;
  });
  const updatePage = vi.fn<NotionClient["updatePage"]>(async (id, input) => {
    const updated: NotionPage = { ...pageById.get(id)!, properties: { ...pageById.get(id)?.properties, ...materialize(input) }, last_edited_time: currentTime };
    pageById.set(id, updated);
    return updated;
  });
  return { query, getPage, createPage, updatePage, pageById };
}

function database(patch: Partial<ScheduleSnapshot>) {
  const data = {
    schedule: { updatedAt: currentTime, tasks: [], events: [], projectCheckins: [], ...patch } as ScheduleSnapshot,
    ledger: {} as SyncLedger,
  };
  const load = vi.fn<SyncStore["load"]>(async () => data);
  const checkpoint = vi.fn<SyncStore["checkpoint"]>(async (ledger) => {
    data.ledger = structuredClone(ledger);
  });
  const commit = vi.fn<SyncStore["commit"]>(async (revision, changes, ledger) => {
    if (revision !== data.schedule.updatedAt) return false;
    data.schedule = { ...data.schedule, ...changes };
    data.ledger = ledger;
    return true;
  });
  return { load, checkpoint, commit, data };
}

describe("Notion synchronization worker", () => {
  it("imports and exports new tasks, preserves Notion open stages, and keeps empty execution dates empty", async () => {
    const store = database({ tasks: [mockTask("Export"), mockTask("Old", { createdAt: oldTime }), mockTask("Long", { taskType: "long" })] });
    const remote = notion([taskPage("Import"), taskPage("Old-remote", {}, oldTime)]);
    const result = await runNotionSync(config, remote, store, options);
    expect(result.counts).toMatchObject({ tasksToNotion: 1, tasksToRcap: 1 });
    expect(store.data.schedule.tasks.map((task) => task.name)).toEqual(["Export", "Old", "Long", "Import"]);
    const imported = store.data.schedule.tasks.at(-1)!;
    expect(imported.dueDate).toBe(currentDay);
    await runNotionSync(config, remote, store, options);
    expect(remote.createPage).toHaveBeenCalledTimes(1);
    expect(remote.updatePage).not.toHaveBeenCalled();
    store.data.schedule.tasks = store.data.schedule.tasks.map((task) => task.id === imported.id ? { ...task, notes: "local note" } : task);
    await runNotionSync(config, remote, store, options);
    expect(remote.updatePage).toHaveBeenCalledWith("Import", { notes: { rich_text: notionTextValue("local note") } });
    expect(remote.pageById.get("Import")?.properties).toMatchObject({ status: { select: { name: "进行中" } }, plan: { date: null } });
  });

  it("applies independent changes, reports field conflicts, and propagates completion to linked events", async () => {
    const store = database({ tasks: [], events: [] });
    const remote = notion([taskPage("Task")]);
    await runNotionSync(config, remote, store, options);
    const imported = store.data.schedule.tasks[0];
    store.data.schedule.events = [{ isCompleted: false, linkedDailyTaskId: imported.id }];
    store.data.schedule.tasks = [{ ...imported, name: "Local name", notes: "local note" }];
    await remote.updatePage("Task", { title: { title: notionTextValue("Remote name") }, status: { select: { name: "已完成" } } });
    remote.updatePage.mockClear();

    const report = await runNotionSync(config, remote, store, options);
    expect(report.conflicts).toEqual([{ kind: "task", localId: imported.id, pageId: "Task", fields: ["title"] }]);
    expect(remote.updatePage).toHaveBeenCalledExactlyOnceWith("Task", { notes: { rich_text: notionTextValue("local note") } });
    expect(store.data.schedule.tasks[0]).toMatchObject({ done: true, name: "Local name" });
    expect(store.data.schedule.events[0].isCompleted).toBe(true);

    await remote.updatePage("Task", { status: { select: { name: "取消" } } });
    await runNotionSync(config, remote, store, options);
    expect(store.data.schedule.tasks[0]).toMatchObject({ done: false, abandonedAt: currentTime });
    expect(store.data.schedule.events[0].isCompleted).toBe(false);

    store.data.schedule.tasks[0].abandonedAt = null;
    await runNotionSync(config, remote, store, options);
    expect(remote.updatePage).toHaveBeenLastCalledWith("Task", { status: { select: { name: "进行中" } } });
  });

  it("reuses an outgoing task after a rejected revision or an uncertain create", async () => {
    const store = database({ tasks: [mockTask("Export")] });
    const remote = notion([]);
    store.commit.mockResolvedValueOnce(false);
    await expect(runNotionSync(config, remote, store, options)).rejects.toBeInstanceOf(ConcurrentScheduleError);
    await runNotionSync(config, remote, store, options);
    expect(remote.createPage).toHaveBeenCalledTimes(1);
    expect(Object.values(store.data.ledger.tasks ?? {})).toHaveLength(1);

    store.data.schedule.tasks.push(mockTask("Pending"));
    const create = remote.createPage.getMockImplementation()!;
    remote.createPage.mockImplementationOnce(async (...args) => { await create(...args); throw new Error("timeout"); });
    await expect(runNotionSync(config, remote, store, options)).rejects.toThrow("timeout");
    await runNotionSync(config, remote, store, options);
    expect(remote.createPage).toHaveBeenCalledTimes(2);
    expect(Object.values(store.data.ledger.tasks ?? {})).toHaveLength(2);
  });

  it("does not reimport its own task write after a newer local edit rejects the commit", async () => {
    const store = database({});
    const remote = notion([taskPage("original")]);
    await runNotionSync(config, remote, store, options);
    store.data.schedule.tasks[0].name = "changed";
    store.commit.mockImplementationOnce(async () => {
      store.data.schedule.tasks[0].name = "original";
      return false;
    });
    await expect(runNotionSync(config, remote, store, options)).rejects.toBeInstanceOf(ConcurrentScheduleError);
    expect(remote.updatePage).toHaveBeenLastCalledWith("original", { title: { title: notionTextValue("changed") } });

    const update = remote.updatePage.getMockImplementation()!;
    remote.updatePage.mockRejectedValueOnce(new Error("timeout while retrying"));
    await expect(runNotionSync(config, remote, store, options)).rejects.toThrow("timeout while retrying");
    remote.updatePage.mockImplementation(update);
    const result = await runNotionSync(config, remote, store, options);
    expect(result.conflicts).toEqual([]);
    expect(store.data.schedule.tasks[0].name).toBe("original");
    expect(remote.updatePage).toHaveBeenLastCalledWith("original", { title: { title: notionTextValue("original") } });
    expect(store.data.ledger.pendingTasks).toEqual({});
  });

  it("keeps a newer local check-in withdrawal after the first outbound check was saved remotely", async () => {
    const remote = notion([dayPage("prebuilt", currentDay)]);
    const store = database({ projectCheckins: [mockProject("reading", [{ date: currentDay, note: "keep" }])] });
    store.commit.mockImplementationOnce(async () => {
      store.data.schedule.projectCheckins[0].checkins = [];
      return false;
    });
    await expect(runNotionSync(config, remote, store, options)).rejects.toBeInstanceOf(ConcurrentScheduleError);
    expect(remote.updatePage).toHaveBeenLastCalledWith("prebuilt", { "reading-box": { checkbox: true }, "reading-note": { rich_text: notionTextValue("keep") } });

    const result = await runNotionSync(config, remote, store, options);
    expect(result.conflicts).toEqual([]);
    expect(store.data.schedule.projectCheckins[0].checkins).toEqual([]);
    expect(remote.updatePage).toHaveBeenLastCalledWith("prebuilt", { "reading-box": { checkbox: false } });
    expect(store.data.ledger.pendingCheckins).toEqual({});
  });

  it("reports invalid task values and continues to synchronize other tasks", async () => {
    const remote = notion([taskPage("Incoming")]);
    const store = database({ tasks: [mockTask("Oversized", { notes: "x".repeat(200_001) }), mockTask("Rejected"), mockTask("Outgoing")] });
    remote.createPage.mockRejectedValueOnce(new NotionApiError(400, "validation_error", null));

    const result = await runNotionSync({ ...config, daily: { ...daily, bindings: [] } }, remote, store, options);
    expect(result.issues).toEqual([
      { kind: "task", localId: "Oversized", code: "invalid-values" },
      { kind: "task", localId: "Rejected", code: "invalid-values" },
    ]);
    expect(result.counts).toMatchObject({ tasksToRcap: 1, tasksToNotion: 1 });
    expect(remote.createPage).toHaveBeenCalledTimes(2);
    expect(store.data.schedule.tasks.at(-1)?.name).toBe("Incoming");
    expect(store.data.ledger.pendingTasks).toEqual({});
  });

  it("keeps processing other project mappings after Notion rejects a check-in update", async () => {
    const remote = notion([dayPage("prebuilt", currentDay)]);
    const store = database({ projectCheckins: [
      mockProject("reading", [{ date: currentDay, note: "Rejected" }]),
      mockProject("writing", [{ date: currentDay, note: "Accepted" }]),
    ] });
    remote.updatePage.mockRejectedValueOnce(new NotionApiError(400, "validation_error", null));

    const report = await runNotionSync(config, remote, store, options);
    expect(report.issues).toContainEqual({ kind: "checkin", localId: "reading", date: currentDay, pageId: "prebuilt", code: "invalid-values" });
    expect(report.counts.checkinsToNotion).toBe(1);
    expect(remote.updatePage).toHaveBeenLastCalledWith("prebuilt", { "writing-box": { checkbox: true } });
    expect(store.data.ledger.pendingCheckins).toEqual({});
  });

  it("excludes prior dates when a project mapping is added after a task-only rollout", async () => {
    const remote = notion([]);
    const store = database({ projectCheckins: [mockProject("reading", [{ date: currentDay, note: "existing before mapping" }])] });
    await runNotionSync({ ...config, daily: { ...daily, bindings: [] } }, remote, store, options);
    const start = { now: new Date("2026-11-19T05:00:00.000Z") };
    await runNotionSync(config, remote, store, start);
    expect(remote.createPage).not.toHaveBeenCalled();
    store.data.schedule.projectCheckins[0].checkins.push({ date: "2026-11-17", note: "explicit backfill after mapping" });
    await runNotionSync(config, remote, store, start);
    expect(remote.createPage).toHaveBeenCalledExactlyOnceWith("daily", {
      title: { title: notionTextValue("2026-11-17") }, date: { date: { start: "2026-11-17" } },
      "reading-box": { checkbox: true }, "reading-note": { rich_text: notionTextValue("explicit backfill after mapping") },
    });
  });

  it("previews explicitly paired historic tasks without writing and retains tombstones after removal", async () => {
    const withPair: SyncConfig = { ...config, existingTaskPairs: [{ rcapId: "Old", pageId: "Legacy" }] };
    const remote = notion([taskPage("Legacy", { title: { title: notionTextValue("Old") }, plan: { date: { start: currentDay } } }, oldTime)]);
    const store = database({ tasks: [mockTask("Old", { name: "Changed", createdAt: oldTime })] });
    const preview = await runNotionSync({ ...withPair, enabledAt: "2026-11-19T00:00:00.000Z" }, remote, store, { ...options, dryRun: true });
    expect(preview.conflicts[0].fields).toEqual(["title"]);
    expect(store.commit).not.toHaveBeenCalled();
    expect(store.checkpoint).not.toHaveBeenCalled();
    expect(remote.updatePage).not.toHaveBeenCalled();

    await runNotionSync(withPair, remote, store, options);
    store.data.schedule.tasks[0].name = "Old";
    expect((await runNotionSync(withPair, remote, store, options)).conflicts).toEqual([]);

    remote.pageById.get("Legacy")!.in_trash = true;
    store.data.schedule.tasks[0].notes = "changed after the Notion page was trashed";
    const report = await runNotionSync(withPair, remote, store, options);
    expect(report.issues).toContainEqual({ kind: "task", localId: "Old", pageId: "Legacy", code: "unavailable" });
    expect(remote.createPage).not.toHaveBeenCalled();
    store.data.schedule.tasks = [];
    await runNotionSync(withPair, remote, store, options);
    expect(store.data.ledger.tasks?.Old.pageId).toBe("Legacy");
    expect(store.data.schedule.tasks).toHaveLength(0);
  });

  it("reuses a prebuilt date, updates only mapped properties, and restores a revoked note", async () => {
    const remote = notion([dayPage("prebuilt", "2026-11-17T16:10:00.000Z")]);
    const store = database({ projectCheckins: [mockProject("reading", [{ date: currentDay, note: "preserve me" }]), mockProject("writing", [{ date: currentDay, note: "RCAP only" }])] });
    await runNotionSync(config, remote, store, options);
    expect(remote.createPage).not.toHaveBeenCalled();
    expect(remote.updatePage.mock.calls).toEqual([
      ["prebuilt", { "reading-box": { checkbox: true }, "reading-note": { rich_text: notionTextValue("preserve me") } }],
      ["prebuilt", { "writing-box": { checkbox: true } }],
    ]);
    expect(remote.pageById.get("prebuilt")?.properties.untouched).toMatchObject({ rich_text: notionTextValue("personal") });

    await remote.updatePage("prebuilt", { "reading-box": { checkbox: false } });
    await runNotionSync(config, remote, store, options);
    expect(store.data.schedule.projectCheckins[0].checkins).toEqual([]);
    expect(Object.values(store.data.ledger.checkins!).find((entry) => entry.projectId === "reading")?.retainedNote).toBe("preserve me");

    await remote.updatePage("prebuilt", { "reading-box": { checkbox: true } });
    await runNotionSync(config, remote, store, options);
    expect(store.data.schedule.projectCheckins[0].checkins).toEqual([{ date: currentDay, note: "preserve me" }]);
    expect(store.data.schedule.projectCheckins[1].checkins).toEqual([{ date: currentDay, note: "RCAP only" }]);
  });

  it("does not turn archive or a duplicate date into an update and allows a new retroactive check-in", async () => {
    const remote = notion([dayPage("today", currentDay, { "reading-box": { checkbox: true } }, currentTime)]);
    const store = database({ projectCheckins: [mockProject("reading"), mockProject("writing", [{ date: "2026-11-16", note: "old only" }])] });
    await runNotionSync(config, remote, store, options);
    expect(store.data.schedule.projectCheckins[0].checkins).toHaveLength(1);
    expect(remote.createPage).not.toHaveBeenCalled();

    store.data.schedule.projectCheckins[0] = { ...mockProject("reading"), startDate: currentDay, archives: [{ id: "archive" }] };
    store.data.schedule.projectCheckins[1].checkins.push({ date: "2026-11-17", note: "new retroactive" });
    await runNotionSync(config, remote, store, options);
    expect(remote.updatePage).not.toHaveBeenCalled();
    expect(store.data.schedule.projectCheckins[0].checkins).toEqual([]);
    expect(remote.createPage).toHaveBeenCalledExactlyOnceWith("daily", { title: { title: notionTextValue("2026-11-17") }, date: { date: { start: "2026-11-17" } }, "writing-box": { checkbox: true } });

    remote.pageById.set("duplicate", dayPage("duplicate", currentDay));
    store.data.schedule.projectCheckins[1].checkins.push({ date: currentDay, note: "duplicate date" });
    const report = await runNotionSync(config, remote, store, options);
    expect(report.issues).toContainEqual({ kind: "checkin", localId: "writing", date: currentDay, code: "duplicate" });
    expect(remote.updatePage).not.toHaveBeenCalled();

    const retroactivePage = [...remote.pageById.keys()].find((id) => id.startsWith("new-"))!;
    await remote.updatePage(retroactivePage, { "writing-box": { checkbox: false } });
    await runNotionSync(config, remote, store, options);
    expect(store.data.schedule.projectCheckins[1].checkins.map(({ date }) => date)).toEqual(["2026-11-16", currentDay]);
  });
});
