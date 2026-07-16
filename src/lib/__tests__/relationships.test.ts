import { describe, expect, it } from "vitest";
import { getEffectiveFollowUpStatus, matchesRelationshipSearch } from "@/lib/relationships";
import {
  relationshipFollowUpUpdateSchema,
  relationshipRecordDetailsUpdateSchema,
  relationshipRecordInputSchema,
} from "@/lib/relationships-schema";

describe("relationship follow-up status", () => {
  it("keeps user confirmation between a completed task and a completed follow-up", () => {
    expect(
      getEffectiveFollowUpStatus(
        {
          status: "task_created",
          relatedTaskId: "task-1",
          relatedScheduleEventId: null,
        },
        [{ id: "task-1", done: true }],
        [],
      ),
    ).toBe("awaiting_confirmation");
  });
});

describe("relationship search", () => {
  it("finds a record by contact, event title, or exchange item content", () => {
    const searchable = {
      contactName: "张老师",
      contactAlias: "张导",
      title: "论文返修讨论",
      description: "讨论统计方法",
      items: ["提供匿名审稿意见", "推荐目标期刊"],
    };

    expect(matchesRelationshipSearch(searchable, "张导")).toBe(true);
    expect(matchesRelationshipSearch(searchable, "返修")).toBe(true);
    expect(matchesRelationshipSearch(searchable, "目标期刊")).toBe(true);
    expect(matchesRelationshipSearch(searchable, "婚礼")).toBe(false);
  });
});

describe("relationship record input", () => {
  it("accepts multiple exchange items with optional integer minor-unit values", () => {
    const result = relationshipRecordInputSchema.safeParse({
      contactId: "c4d4ad73-421a-4d7f-8564-237eb6bb7dd2",
      direction: "received",
      title: "收到论文修改帮助",
      eventType: "research_help",
      occasion: "论文返修",
      eventDate: "2026-07-16",
      location: "",
      description: "",
      significanceLevel: 4,
      expectationLevel: "none",
      privacyLevel: "private",
      aiUsageAllowed: false,
      items: [
        { category: "service", itemName: "逐段修改", description: "", estimatedValueMinor: null },
        { category: "information", itemName: "期刊建议", description: "", estimatedValueMinor: 1250, currency: "CNY" },
      ],
      followUp: null,
      relations: [],
    });

    expect(result.success).toBe(true);
    expect(
      relationshipRecordInputSchema.safeParse({
        ...(result.success ? result.data : {}),
        items: [{ category: "cash", itemName: "礼金", estimatedValueMinor: 12.5 }],
      }).success,
    ).toBe(false);
  });
});

describe("relationship patch inputs", () => {
  it("does not synthesize omitted record fields while editing one fact", () => {
    const parsed = relationshipRecordDetailsUpdateSchema.parse({ title: "更新后的标题" });
    expect(parsed).toEqual({ title: "更新后的标题" });
  });

  it("does not unlink task or schedule relations while completing a follow-up", () => {
    const parsed = relationshipFollowUpUpdateSchema.parse({
      status: "completed",
      completedAt: "2026-07-16T02:00:00.000Z",
    });
    expect(parsed).toEqual({
      status: "completed",
      completedAt: "2026-07-16T02:00:00.000Z",
    });
  });
});
