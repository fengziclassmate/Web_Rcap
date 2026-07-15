import { describe, expect, it } from "vitest";
import {
  buildDeviationInsights,
  defaultExecutionContinuityState,
  normalizeExecutionContinuityState,
} from "@/lib/execution-continuity";

describe("normalizeExecutionContinuityState", () => {
  it("returns an empty compatible state for missing data", () => {
    expect(normalizeExecutionContinuityState(undefined)).toEqual(defaultExecutionContinuityState);
  });

  it("drops malformed rows and normalizes optional links and minutes", () => {
    const result = normalizeExecutionContinuityState({
      resumePackets: [
        {
          id: "resume-1",
          title: "模型中断点",
          nextAction: "运行最小样本",
          unresolvedQuestions: ["参数是否稳定", ""],
          projectId: "project-1",
          status: "unexpected",
          createdAt: "2026-07-15T00:00:00.000Z",
        },
        { id: "", title: "无效记录" },
      ],
      decisions: [],
      debts: [
        {
          id: "debt-1",
          title: "核验引用",
          kind: "citation",
          severity: "blocking",
          status: "resolved",
          resolvedAt: "2026-07-15T02:00:00.000Z",
          blocksSubmission: true,
        },
      ],
      outcomes: [
        {
          id: "outcome-1",
          title: "数据清洗",
          status: "negative_result",
          plannedMinutes: 50.4,
          actualMinutes: -20,
        },
      ],
    });

    expect(result.resumePackets).toHaveLength(1);
    expect(result.resumePackets[0]).toMatchObject({
      projectId: "project-1",
      taskId: null,
      status: "active",
      unresolvedQuestions: ["参数是否稳定"],
    });
    expect(result.debts[0]).toMatchObject({
      kind: "citation",
      severity: "blocking",
      status: "resolved",
      blocksSubmission: true,
    });
    expect(result.outcomes[0]).toMatchObject({
      status: "negative_result",
      plannedMinutes: 50,
      actualMinutes: null,
      workType: "other",
      novelty: "familiar",
    });
  });

  it("learns separate estimation multipliers by work type and novelty", () => {
    const outcomes = normalizeExecutionContinuityState({
      outcomes: [
        { id: "1", title: "新数据", status: "completed", workType: "data", novelty: "new", plannedMinutes: 60, actualMinutes: 120 },
        { id: "2", title: "熟悉清洗", status: "completed", workType: "data", novelty: "familiar", plannedMinutes: 60, actualMinutes: 75 },
        { id: "3", title: "阅读", status: "completed", workType: "reading", plannedMinutes: 30, actualMinutes: 45 },
      ],
    }).outcomes;

    expect(buildDeviationInsights(outcomes)).toEqual([
      expect.objectContaining({
        workType: "data",
        sampleSize: 2,
        averageMultiplier: 1.63,
        newWorkMultiplier: 2,
        familiarWorkMultiplier: 1.25,
      }),
      expect.objectContaining({
        workType: "reading",
        sampleSize: 1,
        averageMultiplier: 1.5,
      }),
    ]);
  });
});
