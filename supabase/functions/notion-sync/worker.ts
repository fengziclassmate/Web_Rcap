import {
  newTask, patchCheckin, patchTask, projectCycle, readCheckin, readTask, reconcile,
  shanghaiDate, updateEventsLinkedToDailyTask,
  type CheckinFields, type SyncBaseline, type TaskFields,
} from "./model.ts";
import {
  findNotionProperty, NotionApiError, NotionTextLimitError, notionText, notionTextValue,
  type NotionClient, type NotionPage, type NotionPropertyWrites, type NotionQueryFilter,
} from "./notion-client.ts";

type ScheduleTask = Parameters<typeof readTask>[0] & { id: string; taskType: string };
type ScheduleProject = Parameters<typeof readCheckin>[0] & { id: string };
export type ScheduleSnapshot = {
  updatedAt: string | null;
  tasks: ScheduleTask[];
  events: Parameters<typeof updateEventsLinkedToDailyTask>[0];
  projectCheckins: ScheduleProject[];
};
export type ScheduleChanges = Partial<Pick<ScheduleSnapshot, "tasks" | "events" | "projectCheckins">>;

type TodoConfig = {
  dataSourceId: string;
  title: string;
  date?: string;
  notes?: string;
  status: string;
  rcapId: string;
};
type CheckinConfig = { projectId: string; checkbox: string; note?: string };
export type SyncConfig = {
  enabledAt: string;
  todo: TodoConfig;
  daily: { dataSourceId: string; title: string; date: string; bindings: CheckinConfig[] };
  existingTaskPairs?: { rcapId: string; pageId: string }[];
};

type TaskBinding = {
  pageId: string;
  base: SyncBaseline<TaskFields>;
  openStatus?: string;
  unavailable?: true;
};
type CheckinBinding = {
  projectId: string;
  date: string;
  checkbox: string;
  noteProperty?: string;
  pageId: string;
  cycle: string;
  base: SyncBaseline<CheckinFields>;
  retainedNote: string;
  unavailable?: true;
};
type OutboundIntent<T> = { pageId?: string; base: SyncBaseline<T>; fields: Partial<T> };
type CheckinIntent = OutboundIntent<CheckinFields> & { projectId: string; checkbox: string; date: string; cycle: string; retainedNote: string };
export type SyncLedger = {
  cursor?: string;
  tasks?: Record<string, TaskBinding>;
  checkins?: Record<string, CheckinBinding>;
  oldLocalCheckins?: string[];
  checkinMappingStarts?: Record<string, string>;
  pendingTasks?: Record<string, OutboundIntent<TaskFields>>;
  pendingCheckins?: Record<string, CheckinIntent>;
};

type SyncItem = { kind: "task" | "checkin" | "mapping"; localId?: string; pageId?: string; date?: string };
export type SyncIssue = SyncItem & {
  code: "invalid-values" | "unavailable" | "duplicate" | "missing-project" | "unrecognized-id";
};
export type SyncConflict = SyncItem & { fields: string[] };
export type SyncReport = {
  counts: { tasksToRcap: number; tasksToNotion: number; checkinsToRcap: number; checkinsToNotion: number; daysCreated: number };
  conflicts: SyncConflict[];
  issues: SyncIssue[];
};
export type SyncStore = {
  load(): Promise<{ schedule: ScheduleSnapshot; ledger: SyncLedger }>;
  checkpoint(ledger: SyncLedger): Promise<void>;
  commit(expectedRevision: string | null, changes: ScheduleChanges, ledger: SyncLedger, report: SyncReport): Promise<boolean>;
};

export class ConcurrentScheduleError extends Error {
  constructor() {
    super("RCAP changed while Notion synchronization was running. Retry against the new revision.");
    this.name = "ConcurrentScheduleError";
  }
}

const openStatuses = new Set(["待处理", "下一步", "进行中", "等待"]);
const cursorOverlapMs = 5 * 60_000;

function settle<T extends object>(base: SyncBaseline<T>, local: T, remote: T, conflicts: (keyof T)[]): SyncBaseline<T> {
  const next = { local: { ...local }, remote: { ...remote } };
  for (const field of conflicts) {
    next.local[field] = base.local[field];
    next.remote[field] = base.remote[field];
  }
  return next;
}

function differs<T extends object>(before: T, after: T): boolean {
  return (Object.keys(after) as (keyof T)[]).some((key) => before[key] !== after[key]);
}

function recoverBase<T extends object>(base: SyncBaseline<T>, remote: T, pending?: OutboundIntent<T>): SyncBaseline<T> {
  if (!pending) return base;
  const recovered = { local: { ...pending.base.local }, remote: { ...pending.base.remote } };
  for (const field of Object.keys(pending.fields) as (keyof T)[]) {
    if (remote[field] === pending.fields[field]) {
      recovered.local[field] = remote[field];
      recovered.remote[field] = remote[field];
    }
  }
  return recovered;
}

function pageIsInSource(page: NotionPage, dataSourceId: string): boolean {
  return !page.in_trash && page.parent.type === "data_source_id" && page.parent.data_source_id === dataSourceId;
}

function readDate(page: NotionPage, propertyId: string): string | null | undefined {
  const property = findNotionProperty(page, propertyId);
  if (property?.type !== "date") return undefined;
  const start = property.date?.start;
  if (!start) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return start;
  return Number.isFinite(Date.parse(start)) ? shanghaiDate(start) : undefined;
}

function readRcapTask(task: ScheduleTask, config: TodoConfig): TaskFields {
  const fields = readTask(task);
  return { ...fields, date: config.date ? fields.date : null, notes: config.notes ? fields.notes : "" };
}

function readNotionTask(page: NotionPage, config: TodoConfig) {
  const title = findNotionProperty(page, config.title);
  const status = findNotionProperty(page, config.status);
  const notes = config.notes ? findNotionProperty(page, config.notes) : undefined;
  const date = config.date ? readDate(page, config.date) : null;
  if (title?.type !== "title" || status?.type !== "select" || date === undefined
    || (config.notes && notes?.type !== "rich_text")) return null;
  const titleText = notionText(title).trim();
  const statusName = status.select?.name;
  if (!titleText || (statusName && !openStatuses.has(statusName) && statusName !== "已完成" && statusName !== "取消")) return null;
  const fields: TaskFields = {
    title: titleText,
    date,
    notes: notionText(notes),
    status: statusName === "已完成" ? "done" : statusName === "取消" ? "cancelled" : "open",
  };
  return { fields, openStatus: statusName && openStatuses.has(statusName) ? statusName : undefined };
}

function writeNotionTask(patch: Partial<TaskFields>, config: TodoConfig, openStatus?: string): NotionPropertyWrites {
  const properties: NotionPropertyWrites = {};
  if (patch.title !== undefined) properties[config.title] = { title: notionTextValue(patch.title) };
  if (config.date && patch.date !== undefined) properties[config.date] = { date: patch.date ? { start: patch.date } : null };
  if (config.notes && patch.notes !== undefined) properties[config.notes] = { rich_text: notionTextValue(patch.notes) };
  if (patch.status !== undefined) {
    const name = patch.status === "done" ? "已完成" : patch.status === "cancelled" ? "取消" : openStatus ?? "待处理";
    properties[config.status] = { select: { name } };
  }
  return properties;
}

function readNotionCheckin(page: NotionPage, config: CheckinConfig): CheckinFields | null {
  const checked = findNotionProperty(page, config.checkbox);
  const note = config.note ? findNotionProperty(page, config.note) : undefined;
  if (checked?.type !== "checkbox" || (config.note && note?.type !== "rich_text")) return null;
  return { checked: checked.checkbox, ...(config.note && { note: notionText(note) }) };
}

function writeNotionCheckin(patch: Partial<CheckinFields>, config: CheckinConfig): NotionPropertyWrites {
  const properties: NotionPropertyWrites = {};
  if (patch.checked !== undefined) properties[config.checkbox] = { checkbox: patch.checked };
  if (config.note && patch.note !== undefined) properties[config.note] = { rich_text: notionTextValue(patch.note) };
  return properties;
}

function checkinKey(config: CheckinConfig, date: string) {
  return JSON.stringify([config.projectId, config.checkbox, date]);
}

export async function runNotionSync(
  config: SyncConfig,
  client: Pick<NotionClient, "query" | "getPage" | "createPage" | "updatePage">,
  store: SyncStore,
  options: { now?: Date; signal?: AbortSignal; dryRun?: boolean } = {},
): Promise<SyncReport> {
  const now = (options.now ?? new Date()).toISOString();
  const enabledAt = Date.parse(config.enabledAt);
  if (!Number.isFinite(enabledAt)) throw new Error("Invalid Notion synchronization start date.");
  const report: SyncReport = {
    counts: { tasksToRcap: 0, tasksToNotion: 0, checkinsToRcap: 0, checkinsToNotion: 0, daysCreated: 0 },
    conflicts: [], issues: [],
  };
  const active = Date.parse(now) >= enabledAt;
  if (!active && !options.dryRun) return report;
  const { schedule, ledger } = await store.load();
  const { todo, daily } = config;
  const enabledDay = shanghaiDate(config.enabledAt);
  const today = shanghaiDate(now);
  const since = new Date(Math.max(enabledAt, (ledger.cursor ? Date.parse(ledger.cursor) : enabledAt) - cursorOverlapMs)).toISOString();
  const edited: NotionQueryFilter = { and: [
    { timestamp: "last_edited_time", last_edited_time: { on_or_after: since } },
    { timestamp: "last_edited_time", last_edited_time: { on_or_before: now } },
  ] };
  const todoProperties = [todo.title, todo.status, todo.rcapId, ...(todo.date ? [todo.date] : []), ...(todo.notes ? [todo.notes] : [])];
  const dailyProperties = [daily.date, ...daily.bindings.flatMap((binding) => [binding.checkbox, ...(binding.note ? [binding.note] : [])])];
  const [taskPages, datePages] = active ? await Promise.all([
    client.query(todo.dataSourceId, { filter: edited, propertyIds: todoProperties }),
    daily.bindings.length ? client.query(daily.dataSourceId, { filter: edited, propertyIds: dailyProperties }) : [],
  ]) : [[], []];
  const taskPagesById = new Map(taskPages.map((page) => [page.id, page]));
  const taskBindings = { ...ledger.tasks };
  const checkinBindings = { ...ledger.checkins };
  const boundPageIds = new Set(Object.values(taskBindings).map((binding) => binding.pageId));
  const requestedPairs = new Map(config.existingTaskPairs?.map((pair) => [pair.rcapId, pair.pageId]));
  const reservedPages = new Set(requestedPairs.values());
  const tasks = new Map(schedule.tasks.map((task) => [task.id, task]));
  const projects = new Map(schedule.projectCheckins.map((project) => [project.id, project]));
  const oldLocalCheckins = new Set(ledger.oldLocalCheckins ?? []);
  const checkinMappingStarts = { ...ledger.checkinMappingStarts };
  const pendingTasks = { ...ledger.pendingTasks };
  const pendingCheckins = { ...ledger.pendingCheckins };
  const reconciledTasks = new Set<string>();
  const reconciledCheckins = new Set<string>();
  async function checkpoint() {
    options.signal?.throwIfAborted();
    await store.checkpoint({ ...ledger, pendingTasks, pendingCheckins,
      checkinMappingStarts, oldLocalCheckins: [...oldLocalCheckins] });
    options.signal?.throwIfAborted();
  }

  function encodeProperties(item: SyncItem, encode: () => NotionPropertyWrites): NotionPropertyWrites | null {
    try {
      return encode();
    } catch (error) {
      if (!(error instanceof NotionTextLimitError)) throw error;
      report.issues.push({ ...item, code: "invalid-values" });
      return null;
    }
  }

  async function submitProperties(item: SyncItem, write: () => Promise<NotionPage>): Promise<NotionPage | null> {
    try {
      return await write();
    } catch (error) {
      if (!(error instanceof NotionApiError) || error.status !== 400 || error.code !== "validation_error") throw error;
      report.issues.push({ ...item, code: "invalid-values" });
      return null;
    }
  }
  let events = schedule.events;
  let tasksChanged = false;
  let projectsChanged = false;

  async function getPage(pageId: string, properties: string[]): Promise<NotionPage | undefined> {
    try {
      return await client.getPage(pageId, properties);
    } catch (error) {
      if (error instanceof NotionApiError && error.status === 404) return undefined;
      throw error;
    }
  }

  for (const [localId, binding] of Object.entries(taskBindings)) {
    if (tasks.get(localId)?.taskType !== "daily") {
      report.issues.push({ kind: "task", code: "unavailable", localId, pageId: binding.pageId });
    }
  }
  for (const task of tasks.values()) {
    options.signal?.throwIfAborted();
    if (task.taskType !== "daily") continue;
    const existing = Object.hasOwn(taskBindings, task.id) ? taskBindings[task.id] : undefined;
    const intent = Object.hasOwn(pendingTasks, task.id) ? pendingTasks[task.id] : undefined;
    const requestedPage = requestedPairs.get(task.id);
    if (!existing && !requestedPage && !(Date.parse(task.createdAt ?? "") >= enabledAt)) continue;
    const local = readRcapTask(task, todo);
    const item = { kind: "task", localId: task.id } as const;
    const pageId = existing?.pageId ?? requestedPage;
    if (existing && requestedPage && requestedPage !== existing.pageId) {
      report.issues.push({ ...item, pageId: existing.pageId, code: "duplicate" });
      continue;
    }
    if (!existing && requestedPage && boundPageIds.has(requestedPage)) {
      report.issues.push({ ...item, pageId: requestedPage, code: "duplicate" });
      continue;
    }
    let page = pageId ? taskPagesById.get(pageId) : undefined;
    if (pageId && !page) {
      if (!existing || intent || differs(existing.base.local, local)) page = await getPage(pageId, todoProperties);
      else {
        if (existing.unavailable) report.issues.push({ ...item, pageId, code: "unavailable" });
        continue;
      }
    }
    if (!pageId) {
      const matching = await client.query(todo.dataSourceId, {
        filter: { property: todo.rcapId, rich_text: { equals: task.id } }, limit: 2, propertyIds: todoProperties,
      });
      if (matching.length > 1 || (matching[0] && boundPageIds.has(matching[0].id))) {
        report.issues.push({ ...item, code: "duplicate" });
        continue;
      }
      page = matching[0];
      if (!page) {
        const properties = encodeProperties(item, () => ({
          ...writeNotionTask(local, todo),
          [todo.rcapId]: { rich_text: notionTextValue(task.id) },
        }));
        if (!properties) continue;
        if (!options.dryRun) {
          pendingTasks[task.id] = { fields: local, base: { local, remote: local } };
          await checkpoint();
          const created = await submitProperties(item, () => client.createPage(todo.dataSourceId, properties));
          if (!created) {
            if (intent) pendingTasks[task.id] = intent;
            else delete pendingTasks[task.id];
            continue;
          }
          const decoded = readNotionTask(created, todo);
          if (!decoded || !pageIsInSource(created, todo.dataSourceId)) throw new Error("Created Notion task could not be verified.");
          taskBindings[task.id] = { pageId: created.id, base: { local, remote: decoded.fields }, openStatus: decoded.openStatus };
          boundPageIds.add(created.id);
          reconciledTasks.add(task.id);
        }
        report.counts.tasksToNotion++;
        continue;
      }
    }
    if (!page || !pageIsInSource(page, todo.dataSourceId)) {
      report.issues.push({ ...item, pageId, code: "unavailable" });
      if (existing) taskBindings[task.id] = { ...existing, unavailable: true };
      continue;
    }
    const remoteId = notionText(findNotionProperty(page, todo.rcapId));
    if (remoteId && remoteId !== task.id) {
      report.issues.push({ ...item, pageId: page.id, code: "unrecognized-id" });
      continue;
    }
    const decoded = readNotionTask(page, todo);
    if (!decoded) {
      report.issues.push({ ...item, pageId: page.id, code: "invalid-values" });
      continue;
    }
    let remote = decoded.fields;
    let openStatus = decoded.openStatus ?? existing?.openStatus;
    // Without a shared baseline, differing fields need review before either side can win.
    const originalBase = existing?.base ?? { local: remote, remote: local };
    const appliedIntent = intent && (!intent.pageId || intent.pageId === page.id) ? intent : undefined;
    const identifiedItem = { ...item, pageId: page.id };
    let base = recoverBase(originalBase, remote, appliedIntent);
    let delta = reconcile(base, local, remote);
    let properties = encodeProperties(identifiedItem, () => writeNotionTask(delta.remote, todo, openStatus));
    if (!properties) continue;
    if (Object.keys(properties).length && !options.dryRun && taskPagesById.has(page.id)) {
      const latest = await getPage(page.id, todoProperties);
      if (!latest || !pageIsInSource(latest, todo.dataSourceId)) {
        report.issues.push({ ...item, pageId: page.id, code: "unavailable" });
        if (existing) taskBindings[task.id] = { ...existing, unavailable: true };
        continue;
      }
      const current = readNotionTask(latest, todo);
      const latestId = notionText(findNotionProperty(latest, todo.rcapId));
      if (!current || (latestId && latestId !== task.id)) {
        report.issues.push({ ...item, pageId: page.id, code: current ? "unrecognized-id" : "invalid-values" });
        continue;
      }
      remote = current.fields;
      openStatus = current.openStatus ?? openStatus;
      base = recoverBase(originalBase, remote, appliedIntent);
      delta = reconcile(base, local, remote);
      properties = encodeProperties(identifiedItem, () => writeNotionTask(delta.remote, todo, openStatus));
      if (!properties) continue;
    }
    if (delta.conflicts.length) report.conflicts.push({ ...item, pageId: page.id, fields: delta.conflicts });
    if (Object.keys(properties).length) {
      if (!options.dryRun) {
        pendingTasks[task.id] = { pageId: page.id, base, fields: delta.remote };
        await checkpoint();
        const payload = properties;
        if (!await submitProperties(identifiedItem, () => client.updatePage(identifiedItem.pageId, payload))) {
          if (intent) pendingTasks[task.id] = intent;
          else delete pendingTasks[task.id];
          continue;
        }
      }
      report.counts.tasksToNotion++;
    }
    let nextLocal = local;
    if (Object.keys(delta.local).length) {
      const nextTask = patchTask(task, delta.local, now);
      tasks.set(task.id, nextTask);
      nextLocal = readRcapTask(nextTask, todo);
      tasksChanged = true;
      if (task.done !== nextTask.done) events = updateEventsLinkedToDailyTask(events, task.id, nextTask.done);
      report.counts.tasksToRcap++;
    }
    taskBindings[task.id] = {
      pageId: page.id,
      base: settle(base, nextLocal, { ...remote, ...delta.remote }, delta.conflicts),
      openStatus,
    };
    boundPageIds.add(page.id);
    reconciledTasks.add(task.id);
  }

  for (const [localId, pageId] of requestedPairs) {
    if (tasks.get(localId)?.taskType !== "daily" && !Object.hasOwn(taskBindings, localId)) {
      report.issues.push({ kind: "task", code: "unavailable", localId, pageId });
    }
  }
  for (const page of taskPages) {
    options.signal?.throwIfAborted();
    if (boundPageIds.has(page.id) || reservedPages.has(page.id) || Date.parse(page.created_time) < enabledAt
      || !pageIsInSource(page, todo.dataSourceId)) continue;
    const remoteId = notionText(findNotionProperty(page, todo.rcapId));
    const decoded = readNotionTask(page, todo);
    if (remoteId || !decoded) {
      report.issues.push({ kind: "task", pageId: page.id, code: remoteId ? "unrecognized-id" : "invalid-values" });
      continue;
    }
    const id = crypto.randomUUID();
    const task = newTask(id, decoded.fields, page.created_time, now);
    tasks.set(id, task);
    const local = readRcapTask(task, todo);
    taskBindings[id] = {
      pageId: page.id,
      base: { local, remote: decoded.fields },
      openStatus: decoded.openStatus,
    };
    tasksChanged = true;
    report.counts.tasksToRcap++;
  }

  const changedDates = new Set(datePages.flatMap((page) => {
    const day = readDate(page, daily.date);
    return day && day <= today ? [day] : [];
  }));
  const boundCheckinDates = new Map(Object.values(checkinBindings).map(({ pageId, date }) => [pageId, date]));
  const loadedDays = new Map<string, NotionPage[]>();
  const newDays = new Set<string>();
  for (const mapping of daily.bindings) {
    const storedProject = projects.get(mapping.projectId);
    if (!storedProject) {
      report.issues.push({ kind: "mapping", localId: mapping.projectId, code: "missing-project" });
      continue;
    }
    let project = storedProject;
    const cycle = projectCycle(project);
    const mappingId = JSON.stringify([daily.dataSourceId, mapping.projectId, mapping.checkbox]);
    const startDay = checkinMappingStarts[mappingId] ?? (ledger.cursor ? today : enabledDay);
    if (!checkinMappingStarts[mappingId]) {
      checkinMappingStarts[mappingId] = startDay;
      for (const entry of project.checkins) {
        if (entry.date < startDay) oldLocalCheckins.add(checkinKey(mapping, entry.date));
      }
    }
    const days = new Set([...changedDates].filter((date) => date >= startDay || checkinBindings[checkinKey(mapping, date)]));
    if (active && ledger.cursor && shanghaiDate(ledger.cursor) !== today && today >= startDay) days.add(today);
    for (const intent of Object.values(pendingCheckins)) {
      if (intent.projectId === mapping.projectId && intent.checkbox === mapping.checkbox) days.add(intent.date);
    }
    for (const entry of project.checkins) {
      const key = checkinKey(mapping, entry.date);
      const existing = checkinBindings[key];
      if (!existing ? !oldLocalCheckins.has(key) : differs(existing.base.local, readCheckin(project, entry.date, Boolean(mapping.note), existing.retainedNote))) {
        days.add(entry.date);
      }
    }
    for (const binding of Object.values(checkinBindings)) {
      if (binding.projectId !== mapping.projectId || binding.checkbox !== mapping.checkbox) continue;
      if (binding.cycle !== cycle || differs(binding.base.local, readCheckin(project, binding.date, Boolean(mapping.note), binding.retainedNote))) {
        days.add(binding.date);
      } else if (binding.unavailable && !days.has(binding.date)) {
        report.issues.push({ kind: "checkin", date: binding.date, localId: mapping.projectId, pageId: binding.pageId, code: "unavailable" });
      }
    }

    for (const date of days) {
      options.signal?.throwIfAborted();
      const key = checkinKey(mapping, date);
      if (date < project.startDate) {
        reconciledCheckins.add(key);
        continue;
      }
      if (date > today) continue;
      const existing = checkinBindings[key];
      const intent = pendingCheckins[key];
      const item = { kind: "checkin", localId: mapping.projectId, date } as const;
      const sameCycle = existing?.cycle === cycle;
      const localNote = project.checkins.find((entry) => entry.date === date)?.note;
      let retainedNote = localNote ?? (intent?.cycle === cycle ? intent.retainedNote : undefined)
        ?? (sameCycle ? existing?.retainedNote : undefined) ?? "";
      const local = readCheckin(project, date, Boolean(mapping.note), retainedNote);
      const reusedDayLookup = loadedDays.has(date);
      let matching = loadedDays.get(date);
      if (!matching) {
        const midnight = `${date}T00:00:00+08:00`;
        const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
        const nextMidnight = `${next}T00:00:00+08:00`;
        matching = (await client.query(daily.dataSourceId, {
          filter: { or: [
            { property: daily.date, date: { equals: date } },
            { and: [
              { property: daily.date, date: { on_or_after: midnight } },
              { property: daily.date, date: { before: nextMidnight } },
            ] },
          ] },
          propertyIds: dailyProperties,
        })).filter((candidate) => readDate(candidate, daily.date) === date);
        loadedDays.set(date, matching);
      }
      if (matching.length > 1) {
        report.issues.push({ ...item, code: "duplicate" });
        continue;
      }
      const [page] = matching;
      const boundDate = page && boundCheckinDates.get(page.id);
      if ((existing && page?.id !== existing.pageId)
        || (page && (!pageIsInSource(page, daily.dataSourceId) || (boundDate && boundDate !== date)))) {
        report.issues.push({ ...item, pageId: existing?.pageId ?? page?.id, code: "unavailable" });
        if (existing) checkinBindings[key] = { ...existing, unavailable: true };
        continue;
      }
      const empty: CheckinFields = { checked: false, ...(mapping.note && { note: "" }) };
      let remote = page ? readNotionCheckin(page, mapping) : empty;
      if (!remote) {
        report.issues.push({ ...item, pageId: page?.id, code: "invalid-values" });
        continue;
      }
      let base = existing?.base ?? { local: empty, remote: empty };
      const matchedIntent = intent && (!intent.pageId || intent.pageId === page?.id) ? intent : undefined;
      if ((existing && !sameCycle) || (matchedIntent && matchedIntent.cycle !== cycle)) {
        // Opening a new stage must not undo the previous stage's Notion checkmark.
        base = { local: empty, remote: recoverBase(base, remote, matchedIntent).remote };
      }
      if (existing && existing.noteProperty !== mapping.note) {
        base = { local: { ...base.local, note: local.note }, remote: { ...base.remote, note: remote.note } };
      }
      const originalBase = base;
      const appliedIntent = matchedIntent?.cycle === cycle ? matchedIntent : undefined;
      const identifiedItem = { ...item, pageId: page?.id };
      base = recoverBase(originalBase, remote, appliedIntent);
      let delta = reconcile(base, local, remote);
      let properties = encodeProperties(identifiedItem, () => writeNotionCheckin(delta.remote, mapping));
      if (!properties) continue;
      if (page && reusedDayLookup && Object.keys(properties).length && !options.dryRun) {
        const latest = await getPage(page.id, dailyProperties);
        if (!latest || !pageIsInSource(latest, daily.dataSourceId) || readDate(latest, daily.date) !== date) {
          report.issues.push({ ...item, pageId: page.id, code: "unavailable" });
          loadedDays.delete(date);
          if (existing) checkinBindings[key] = { ...existing, unavailable: true };
          continue;
        }
        const current = readNotionCheckin(latest, mapping);
        if (!current) {
          report.issues.push({ ...item, pageId: page.id, code: "invalid-values" });
          continue;
        }
        loadedDays.set(date, [latest]);
        remote = current;
        base = recoverBase(originalBase, remote, appliedIntent);
        delta = reconcile(base, local, remote);
        properties = encodeProperties(identifiedItem, () => writeNotionCheckin(delta.remote, mapping));
        if (!properties) continue;
      }
      if (delta.conflicts.length) report.conflicts.push({ ...item, pageId: page?.id, fields: delta.conflicts });
      let syncedPageId = page?.id;
      if (Object.keys(properties).length) {
        if (!options.dryRun) {
          pendingCheckins[key] = { projectId: mapping.projectId, checkbox: mapping.checkbox, date, cycle, retainedNote,
            pageId: page?.id, base, fields: delta.remote };
          await checkpoint();
          const payload = properties;
          const updated = await submitProperties(identifiedItem, () => page
            ? client.updatePage(page.id, payload)
            : client.createPage(daily.dataSourceId, {
              [daily.title]: { title: notionTextValue(date) },
              [daily.date]: { date: { start: date } },
              ...payload,
            }));
          if (!updated) {
            if (intent) pendingCheckins[key] = intent;
            else delete pendingCheckins[key];
            continue;
          }
          if (!pageIsInSource(updated, daily.dataSourceId) || readDate(updated, daily.date) !== date) {
            throw new Error("Notion check-in date changed during synchronization.");
          }
          loadedDays.set(date, [updated]);
          syncedPageId = updated.id;
        }
        report.counts.checkinsToNotion++;
        if (!page) newDays.add(date);
      }
      if (Object.keys(delta.local).length) {
        retainedNote = delta.local.note ?? retainedNote;
        const nextProject = patchCheckin(project, date, delta.local, retainedNote);
        if (nextProject !== project) {
          project = nextProject;
          projects.set(project.id, project);
          projectsChanged = true;
          report.counts.checkinsToRcap++;
        }
      }
      if (syncedPageId && (local.checked || remote.checked || existing || delta.conflicts.length)) {
        checkinBindings[key] = {
          projectId: mapping.projectId, date, checkbox: mapping.checkbox, noteProperty: mapping.note,
          pageId: syncedPageId, cycle, retainedNote,
          base: settle(base, readCheckin(project, date, Boolean(mapping.note), retainedNote), { ...remote, ...delta.remote }, delta.conflicts),
        };
      }
      reconciledCheckins.add(key);
    }
  }

  report.counts.daysCreated = newDays.size;
  if (!options.dryRun) {
    options.signal?.throwIfAborted();
    for (const id of reconciledTasks) delete pendingTasks[id];
    for (const key of reconciledCheckins) delete pendingCheckins[key];
    const committed = await store.commit(schedule.updatedAt, {
      ...(tasksChanged && { tasks: [...tasks.values()] }),
      ...(events !== schedule.events && { events }),
      ...(projectsChanged && { projectCheckins: [...projects.values()] }),
    }, { cursor: now, tasks: taskBindings, checkins: checkinBindings, oldLocalCheckins: [...oldLocalCheckins],
      checkinMappingStarts, pendingTasks, pendingCheckins }, report);
    if (!committed) throw new ConcurrentScheduleError();
  }
  return report;
}
