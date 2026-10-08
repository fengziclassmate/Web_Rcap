import type { PersistedSchedulePayload } from "./schedule-persistence";

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const records = (value: unknown): value is Array<Record<string, unknown> & { id: string }> =>
  Array.isArray(value) && value.every((item) => object(item) && typeof item.id === "string")
  && new Set(value.map((item) => item.id)).size === value.length;

/** Merge changes against the last acknowledged snapshot; never silently choose a conflicting edit. */
export function mergeScheduleChanges(
  base: PersistedSchedulePayload,
  local: PersistedSchedulePayload,
  remote: PersistedSchedulePayload,
  prefer: "local" | "remote" = "local",
) {
  const conflicts: string[] = [];
  function merge(before: unknown, ours: unknown, theirs: unknown, path: string): unknown {
    if (same(ours, before)) return theirs;
    if (same(theirs, before) || same(ours, theirs)) return ours;
    if (object(before) && object(ours) && object(theirs)) {
      return Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(ours), ...Object.keys(theirs)])]
        .map((key) => [key, merge(before[key], ours[key], theirs[key], `${path}.${key}`)])
        .filter(([, value]) => value !== undefined));
    }
    if (records(before) && records(ours) && records(theirs)) {
      const original = new Map(before.map((item) => [item.id, item]));
      const localItems = new Map(ours.map((item) => [item.id, item]));
      const remoteItems = new Map(theirs.map((item) => [item.id, item]));
      const localOrderChanged = !same(ours.filter((item) => original.has(item.id)).map((item) => item.id), before.filter((item) => localItems.has(item.id)).map((item) => item.id));
      const order = localOrderChanged ? [...ours, ...theirs] : [...theirs, ...ours];
      return [...new Set(order.map((item) => item.id))].map((id) => merge(original.get(id), localItems.get(id), remoteItems.get(id), `${path}[${id}]`)).filter((item) => item !== undefined);
    }
    conflicts.push(path);
    return prefer === "local" ? ours : theirs;
  }
  return { value: merge(base, local, remote, "schedule") as PersistedSchedulePayload, conflicts };
}
