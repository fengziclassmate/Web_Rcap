import type { FollowUpStatus, LongTask } from "@/lib/types";

export const followUpStatuses: Record<FollowUpStatus | "resolved", { label: string; color: string }> = {
  pending: { label: "待解决", color: "text-stone-600 bg-stone-100" },
  trying: { label: "尝试中", color: "text-sky-800 bg-sky-50" },
  verifying: { label: "待验证", color: "text-amber-800 bg-amber-50" },
  paused: { label: "暂搁置", color: "text-slate-600 bg-slate-100" },
  resolved: { label: "已解决", color: "text-emerald-800 bg-emerald-50" },
};

export function normalizeFollowUpStatus(value: unknown): FollowUpStatus {
  return value === "trying" || value === "verifying" || value === "paused" ? value : "pending";
}

export function getFollowUpStatus(task: LongTask) {
  return task.done ? "resolved" : normalizeFollowUpStatus(task.followUpStatus);
}

export function followUpStatusPatch(value: string): Partial<LongTask> {
  return value === "resolved"
    ? { done: true }
    : { done: false, followUpStatus: normalizeFollowUpStatus(value) };
}
