import { isValid, parseISO } from "date-fns";

export type ResearchDraft = { completed: string; insight: string; nextPlan: string };
export type ResearchLocalState = {
  drafts: Record<string, ResearchDraft>;
  restDays: string[];
  selectedDate: string;
};

export const emptyResearchDraft: ResearchDraft = { completed: "", insight: "", nextPlan: "" };
export const hasResearchDraft = (draft?: ResearchDraft) => Boolean(draft && (draft.completed.trim() || draft.insight.trim() || draft.nextPlan.trim()));
export const isResearchDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
export const researchStorageKey = (userId: string) => `research-progress:v1:${userId}`;

function sameDraft(left?: ResearchDraft, right?: ResearchDraft) {
  return left?.completed === right?.completed && left?.insight === right?.insight && left?.nextPlan === right?.nextPlan;
}

// Patch only this action's changes into the latest browser snapshot.
export function mergeResearchLocalState(previous: ResearchLocalState, next: ResearchLocalState, latest: ResearchLocalState): ResearchLocalState {
  const drafts = { ...latest.drafts };
  for (const day of new Set([...Object.keys(previous.drafts), ...Object.keys(next.drafts)])) {
    if (sameDraft(previous.drafts[day], next.drafts[day])) continue;
    if (next.drafts[day]) {
      const draft = { ...emptyResearchDraft, ...latest.drafts[day] };
      for (const field of ["completed", "insight", "nextPlan"] as const) {
        if ((previous.drafts[day]?.[field] ?? "") !== next.drafts[day][field]) draft[field] = next.drafts[day][field];
      }
      drafts[day] = draft;
    }
    // A completed request must not delete text edited in another tab meanwhile.
    else if (sameDraft(latest.drafts[day], previous.drafts[day])) delete drafts[day];
  }
  const restDays = new Set(latest.restDays);
  for (const day of previous.restDays) if (!next.restDays.includes(day)) restDays.delete(day);
  for (const day of next.restDays) if (!previous.restDays.includes(day)) restDays.add(day);
  return { drafts, restDays: [...restDays], selectedDate: next.selectedDate };
}

export function parseResearchLocalState(raw: string | null, today: string): ResearchLocalState {
  const state: ResearchLocalState = { drafts: {}, restDays: [], selectedDate: today };
  if (!raw) return state;
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object") return state;
  if (data.drafts && typeof data.drafts === "object") {
    for (const [date, draft] of Object.entries(data.drafts)) {
      if (!isResearchDate(date) || !draft || typeof draft !== "object") continue;
      const fields = draft as Record<string, unknown>;
      if (["completed", "insight", "nextPlan"].every((key) => typeof fields[key] === "string")) {
        state.drafts[date] = { completed: fields.completed as string, insight: fields.insight as string, nextPlan: fields.nextPlan as string };
      }
    }
  }
  if (Array.isArray(data.restDays)) state.restDays = data.restDays.filter((day: unknown): day is string => typeof day === "string" && isResearchDate(day));
  if (typeof data.selectedDate === "string" && isResearchDate(data.selectedDate) && data.selectedDate <= today) state.selectedDate = data.selectedDate;
  return state;
}
