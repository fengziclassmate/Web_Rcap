export { updateEventsLinkedToDailyTask } from "../_shared/linked-daily-task-events.ts";

export type TaskFields = {
  title: string;
  date: string | null;
  notes: string;
  status: "open" | "done" | "cancelled";
};

export type CheckinFields = {
  checked: boolean;
  note?: string;
};

export type SyncBaseline<T> = { local: T; remote: T };

export function reconcile<T extends Record<string, string | boolean | null | undefined>>(
  base: SyncBaseline<T>,
  local: T,
  remote: T,
) {
  const changes = { local: {} as Partial<T>, remote: {} as Partial<T>, conflicts: [] as (keyof T)[] };
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)] as (keyof T)[]);
  for (const key of keys) {
    if (local[key] === remote[key]) continue;
    const changedLocally = local[key] !== base.local[key];
    const changedRemotely = remote[key] !== base.remote[key];
    if (changedLocally && changedRemotely) changes.conflicts.push(key);
    else if (changedLocally) changes.remote[key] = local[key];
    else if (changedRemotely) changes.local[key] = remote[key];
  }
  return changes;
}

const dateInShanghai = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function shanghaiDate(iso: string): string {
  const parts = Object.fromEntries(dateInShanghai.formatToParts(new Date(iso)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

type DailyTask = {
  name: string;
  dueDate: string;
  notes?: string;
  createdAt?: string;
  completedAt?: string | null;
  abandonedAt?: string | null;
  done: boolean;
  isTodayFocus?: boolean;
};

export function readTask(task: DailyTask): TaskFields {
  return {
    title: task.name,
    date: task.dueDate || null,
    notes: task.notes ?? "",
    status: task.abandonedAt ? "cancelled" : task.done ? "done" : "open",
  };
}

function taskStatusFields(status: TaskFields["status"], now: string, task?: DailyTask) {
  return {
    done: status === "done",
    completedAt: status === "done" ? task?.completedAt ?? now : null,
    abandonedAt: status === "cancelled" ? task?.abandonedAt ?? now : null,
    isTodayFocus: status === "cancelled" ? false : task?.isTodayFocus ?? false,
  };
}

export function newTask(id: string, fields: TaskFields, createdAt: string, now: string) {
  return {
    id,
    name: fields.title,
    dueDate: fields.date ?? shanghaiDate(createdAt),
    createdAt,
    notes: fields.notes,
    precautions: [],
    completionLog: "",
    priority: "不紧急不重要" as const,
    subtasks: [],
    taskType: "daily" as const,
    ...taskStatusFields(fields.status, now),
  };
}

export function patchTask<T extends DailyTask>(task: T, patch: Partial<TaskFields>, now: string): T {
  return {
    ...task,
    ...(patch.title !== undefined ? { name: patch.title } : {}),
    ...(patch.date !== undefined ? { dueDate: patch.date ?? (task.createdAt ? shanghaiDate(task.createdAt) : task.dueDate) } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.status !== undefined ? taskStatusFields(patch.status, now, task) : {}),
  };
}

type Project = {
  startDate: string;
  checkins: { date: string; note: string }[];
  archives?: { id: string }[];
};

export function projectCycle(project: Project): string {
  return project.archives?.[0]?.id ?? project.startDate;
}

export function readCheckin(project: Project, date: string, includeNote = false, retainedNote = ""): CheckinFields {
  const checkin = project.checkins.find((entry) => entry.date === date);
  return {
    checked: Boolean(checkin),
    ...(includeNote ? { note: checkin?.note ?? retainedNote } : {}),
  };
}

export function patchCheckin<T extends Project>(
  project: T,
  date: string,
  patch: Partial<CheckinFields>,
  retainedNote = "",
): T {
  if (date < project.startDate) return project;
  const existing = project.checkins.find((entry) => entry.date === date);
  if (patch.checked === false) {
    return existing ? { ...project, checkins: project.checkins.filter((entry) => entry.date !== date) } : project;
  }
  if (!existing && patch.checked !== true) return project;
  const note = patch.note ?? existing?.note ?? retainedNote;
  if (existing?.note === note) return project;
  return {
    ...project,
    checkins: existing
      ? project.checkins.map((entry) => entry.date === date ? { ...entry, note } : entry)
      : [...project.checkins, { date, note }],
  };
}
