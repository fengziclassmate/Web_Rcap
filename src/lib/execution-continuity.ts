import type { KnowledgeWorkType } from "@/lib/types";

export type ContinuityEntityLink = {
  projectId: string | null;
  taskId: string | null;
  eventId: string | null;
};

export type ResumePacketStatus = "active" | "superseded";

export type ResearchResumePacket = ContinuityEntityLink & {
  id: string;
  title: string;
  completedSummary: string;
  lastKnownState: string;
  unresolvedQuestions: string[];
  nextAction: string;
  resourceLinks: string[];
  status: ResumePacketStatus;
  createdAt: string;
  updatedAt: string;
};

export type DecisionConfidence = "low" | "medium" | "high";

export type ResearchDecision = ContinuityEntityLink & {
  id: string;
  question: string;
  options: string[];
  choice: string;
  rationale: string;
  counterEvidence: string;
  confidence: DecisionConfidence;
  revisitTrigger: string;
  createdAt: string;
  updatedAt: string;
};

export type ResearchDebtKind =
  | "citation"
  | "data"
  | "code"
  | "analysis"
  | "writing"
  | "method"
  | "other";

export type ResearchDebtSeverity = "low" | "medium" | "high" | "blocking";
export type ResearchDebtStatus = "open" | "resolved" | "accepted";

export type ResearchDebt = ContinuityEntityLink & {
  id: string;
  title: string;
  kind: ResearchDebtKind;
  severity: ResearchDebtSeverity;
  impact: string;
  dueStage: string;
  blocksSubmission: boolean;
  status: ResearchDebtStatus;
  createdAt: string;
  resolvedAt: string | null;
};

export type ExecutionOutcomeStatus =
  | "completed"
  | "negative_result"
  | "replaced"
  | "not_needed"
  | "paused"
  | "abandoned"
  | "partial";

export type WorkNovelty = "familiar" | "new";

export type ExecutionOutcome = ContinuityEntityLink & {
  id: string;
  title: string;
  status: ExecutionOutcomeStatus;
  summary: string;
  evidence: string;
  nextAction: string;
  plannedMinutes: number | null;
  actualMinutes: number | null;
  deviationReason: string;
  workType: KnowledgeWorkType;
  novelty: WorkNovelty;
  createdAt: string;
};

export type DeviationInsight = {
  workType: KnowledgeWorkType;
  sampleSize: number;
  averagePlannedMinutes: number;
  averageActualMinutes: number;
  averageDeltaMinutes: number;
  averageMultiplier: number;
  newWorkMultiplier: number | null;
  familiarWorkMultiplier: number | null;
};

export type ExecutionContinuityState = {
  resumePackets: ResearchResumePacket[];
  decisions: ResearchDecision[];
  debts: ResearchDebt[];
  outcomes: ExecutionOutcome[];
};

export const defaultExecutionContinuityState: ExecutionContinuityState = {
  resumePackets: [],
  decisions: [],
  debts: [],
  outcomes: [],
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asOptionalId(value: unknown) {
  const normalized = asString(value).trim();
  return normalized || null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item).trim()).filter(Boolean);
}

function asIsoDate(value: unknown) {
  const normalized = asString(value);
  return normalized && !Number.isNaN(Date.parse(normalized))
    ? normalized
    : new Date().toISOString();
}

function asNullableMinutes(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

const knowledgeWorkTypes: KnowledgeWorkType[] = [
  "reading",
  "writing",
  "coding",
  "data",
  "experiment",
  "meeting",
  "admin",
  "other",
];

function average(values: number[]) {
  return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
}

export function buildDeviationInsights(outcomes: ExecutionOutcome[]): DeviationInsight[] {
  return knowledgeWorkTypes.flatMap((workType) => {
    const measurable = outcomes.filter((item) =>
      item.workType === workType &&
      item.plannedMinutes !== null &&
      item.actualMinutes !== null &&
      item.plannedMinutes > 0,
    );
    if (!measurable.length) return [];
    const multiplierFor = (novelty?: WorkNovelty) => {
      const rows = novelty ? measurable.filter((item) => item.novelty === novelty) : measurable;
      if (!rows.length) return null;
      return average(rows.map((item) => (item.actualMinutes ?? 0) / (item.plannedMinutes ?? 1)));
    };
    return [{
      workType,
      sampleSize: measurable.length,
      averagePlannedMinutes: Math.round(average(measurable.map((item) => item.plannedMinutes ?? 0))),
      averageActualMinutes: Math.round(average(measurable.map((item) => item.actualMinutes ?? 0))),
      averageDeltaMinutes: Math.round(average(measurable.map((item) => (item.actualMinutes ?? 0) - (item.plannedMinutes ?? 0)))),
      averageMultiplier: Number((multiplierFor() ?? 1).toFixed(2)),
      newWorkMultiplier: (() => {
        const value = multiplierFor("new");
        return value === null ? null : Number(value.toFixed(2));
      })(),
      familiarWorkMultiplier: (() => {
        const value = multiplierFor("familiar");
        return value === null ? null : Number(value.toFixed(2));
      })(),
    }];
  }).sort((a, b) => b.sampleSize - a.sampleSize);
}

function normalizeLink(value: Record<string, unknown>): ContinuityEntityLink {
  return {
    projectId: asOptionalId(value.projectId),
    taskId: asOptionalId(value.taskId),
    eventId: asOptionalId(value.eventId),
  };
}

export function normalizeExecutionContinuityState(value: unknown): ExecutionContinuityState {
  if (!value || typeof value !== "object") return defaultExecutionContinuityState;
  const input = value as Partial<Record<keyof ExecutionContinuityState, unknown>>;

  const resumePackets = Array.isArray(input.resumePackets)
    ? input.resumePackets.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const id = asString(row.id).trim();
        const title = asString(row.title).trim();
        if (!id || !title) return [];
        const createdAt = asIsoDate(row.createdAt);
        return [{
          id,
          title,
          completedSummary: asString(row.completedSummary),
          lastKnownState: asString(row.lastKnownState),
          unresolvedQuestions: asStringArray(row.unresolvedQuestions),
          nextAction: asString(row.nextAction),
          resourceLinks: asStringArray(row.resourceLinks),
          status: row.status === "superseded" ? "superseded" as const : "active" as const,
          createdAt,
          updatedAt: asIsoDate(row.updatedAt ?? createdAt),
          ...normalizeLink(row),
        }];
      })
    : [];

  const decisions = Array.isArray(input.decisions)
    ? input.decisions.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const id = asString(row.id).trim();
        const question = asString(row.question).trim();
        if (!id || !question) return [];
        const confidence: DecisionConfidence = row.confidence === "high"
          ? "high"
          : row.confidence === "low"
            ? "low"
            : "medium";
        const createdAt = asIsoDate(row.createdAt);
        return [{
          id,
          question,
          options: asStringArray(row.options),
          choice: asString(row.choice),
          rationale: asString(row.rationale),
          counterEvidence: asString(row.counterEvidence),
          confidence,
          revisitTrigger: asString(row.revisitTrigger),
          createdAt,
          updatedAt: asIsoDate(row.updatedAt ?? createdAt),
          ...normalizeLink(row),
        }];
      })
    : [];

  const debtKinds: ResearchDebtKind[] = ["citation", "data", "code", "analysis", "writing", "method", "other"];
  const debtSeverities: ResearchDebtSeverity[] = ["low", "medium", "high", "blocking"];
  const debtStatuses: ResearchDebtStatus[] = ["open", "resolved", "accepted"];
  const debts = Array.isArray(input.debts)
    ? input.debts.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const id = asString(row.id).trim();
        const title = asString(row.title).trim();
        if (!id || !title) return [];
        const status = debtStatuses.includes(row.status as ResearchDebtStatus)
          ? row.status as ResearchDebtStatus
          : "open";
        return [{
          id,
          title,
          kind: debtKinds.includes(row.kind as ResearchDebtKind) ? row.kind as ResearchDebtKind : "other",
          severity: debtSeverities.includes(row.severity as ResearchDebtSeverity)
            ? row.severity as ResearchDebtSeverity
            : "medium",
          impact: asString(row.impact),
          dueStage: asString(row.dueStage),
          blocksSubmission: row.blocksSubmission === true,
          status,
          createdAt: asIsoDate(row.createdAt),
          resolvedAt: status === "resolved" ? asIsoDate(row.resolvedAt) : null,
          ...normalizeLink(row),
        }];
      })
    : [];

  const outcomeStatuses: ExecutionOutcomeStatus[] = [
    "completed",
    "negative_result",
    "replaced",
    "not_needed",
    "paused",
    "abandoned",
    "partial",
  ];
  const outcomes = Array.isArray(input.outcomes)
    ? input.outcomes.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const id = asString(row.id).trim();
        const title = asString(row.title).trim();
        if (!id || !title) return [];
        return [{
          id,
          title,
          status: outcomeStatuses.includes(row.status as ExecutionOutcomeStatus)
            ? row.status as ExecutionOutcomeStatus
            : "completed",
          summary: asString(row.summary),
          evidence: asString(row.evidence),
          nextAction: asString(row.nextAction),
          plannedMinutes: asNullableMinutes(row.plannedMinutes),
          actualMinutes: asNullableMinutes(row.actualMinutes),
          deviationReason: asString(row.deviationReason),
          workType: knowledgeWorkTypes.includes(row.workType as KnowledgeWorkType)
            ? row.workType as KnowledgeWorkType
            : "other",
          novelty: row.novelty === "new" ? "new" as const : "familiar" as const,
          createdAt: asIsoDate(row.createdAt),
          ...normalizeLink(row),
        }];
      })
    : [];

  return { resumePackets, decisions, debts, outcomes };
}
