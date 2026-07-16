import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).default("");

export const relationshipDirectionSchema = z.enum(["received", "given", "mutual"]);
export const relationshipEventTypeSchema = z.enum([
  "gift",
  "money",
  "meal",
  "expense_payment",
  "loan",
  "material_support",
  "research_help",
  "work_help",
  "life_help",
  "information",
  "advice",
  "introduction",
  "recommendation",
  "opportunity",
  "emotional_support",
  "invitation",
  "visit",
  "celebration",
  "condolence",
  "accompaniment",
  "other",
]);
export const relationshipItemCategorySchema = z.enum([
  "gift",
  "cash",
  "meal",
  "item",
  "service",
  "information",
  "resource",
  "introduction",
  "opportunity",
  "recommendation",
  "time",
  "emotional_support",
  "other",
]);
export const relationshipFollowUpTypeSchema = z.enum([
  "thank",
  "return_gift",
  "repay",
  "return_item",
  "invite_meal",
  "provide_help",
  "complete_promise",
  "send_material",
  "maintain_contact",
  "congratulate",
  "visit",
  "other",
]);
export const relationshipFollowUpStatusSchema = z.enum([
  "pending_decision",
  "pending",
  "task_created",
  "scheduled",
  "completed",
  "cancelled",
  "not_needed",
]);
export const relationshipTargetTypeSchema = z.enum([
  "task",
  "schedule_event",
  "research_project",
  "research_paper",
  "research_submission",
  "research_meeting",
  "log_post",
  "literature",
]);

export const relationshipContactInputSchema = z.object({
  name: z.string().trim().min(1, "联系人姓名不能为空").max(120),
  alias: optionalText(120),
  relationshipType: z.enum([
    "family",
    "relative",
    "friend",
    "classmate",
    "mentor",
    "colleague",
    "collaborator",
    "student",
    "neighbor",
    "service_provider",
    "other",
  ]),
  organization: optionalText(180),
  role: optionalText(120),
  phone: optionalText(80),
  email: z.union([z.literal(""), z.string().trim().email("邮箱格式不正确")]).default(""),
  notes: optionalText(4000),
  importantDates: z.array(z.object({ label: z.string().trim().min(1).max(80), date: z.iso.date() })).max(20).default([]),
  aiUsageAllowed: z.boolean().default(false),
});

export const relationshipExchangeItemInputSchema = z.object({
  category: relationshipItemCategorySchema,
  itemName: z.string().trim().min(1, "往来内容不能为空").max(240),
  description: optionalText(2000),
  quantity: z.number().positive().max(1_000_000).nullable().default(null),
  estimatedValueMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().default(null),
  currency: z.union([z.literal(""), z.string().trim().length(3).transform((value) => value.toUpperCase())]).default(""),
  materialValueLevel: z.number().int().min(1).max(5).nullable().default(null),
  isReturnable: z.boolean().default(false),
  returnStatus: z.enum(["not_applicable", "not_returned", "partially_returned", "returned", "waived"]).default("not_applicable"),
  notes: optionalText(2000),
}).superRefine((value, context) => {
  if (value.estimatedValueMinor !== null && !value.currency) {
    context.addIssue({ code: "custom", path: ["currency"], message: "填写金额时需要选择币种" });
  }
});

export const relationshipFollowUpInputSchema = z.object({
  followUpType: relationshipFollowUpTypeSchema,
  actionText: z.string().trim().min(1).max(500),
  responsibleParty: z.enum(["me", "other", "mutual"]).default("me"),
  triggerType: z.enum(["immediate", "date", "event", "entity_status_change", "manual"]).default("manual"),
  triggerDate: z.iso.date().nullable().default(null),
  triggerEntityType: relationshipTargetTypeSchema.nullable().default(null),
  triggerEntityId: z.string().trim().max(160).nullable().default(null),
  dueDate: z.iso.date().nullable().default(null),
  status: relationshipFollowUpStatusSchema.default("pending_decision"),
  relatedTaskId: z.string().trim().max(160).nullable().default(null),
  relatedScheduleEventId: z.string().trim().max(160).nullable().default(null),
  notes: optionalText(2000),
}).refine((value) => !(value.relatedTaskId && value.relatedScheduleEventId), {
  message: "一个后续行动只能关联任务或日程中的一个",
});

export const relationshipRelationInputSchema = z.object({
  targetType: relationshipTargetTypeSchema,
  targetId: z.string().trim().min(1).max(160),
  relationType: z.enum(["context", "source", "outcome"]).default("context"),
});

export const relationshipRecordInputSchema = z.object({
  contactId: z.string().uuid(),
  direction: relationshipDirectionSchema,
  title: z.string().trim().min(1, "事件标题不能为空").max(240),
  eventType: relationshipEventTypeSchema,
  occasion: optionalText(160),
  eventDate: z.iso.date(),
  location: optionalText(240),
  description: optionalText(8000),
  significanceLevel: z.number().int().min(1).max(5).nullable().default(null),
  expectationLevel: z.enum(["none", "unclear", "implicit", "explicit"]).default("none"),
  privacyLevel: z.enum(["private", "sensitive"]).default("private"),
  aiUsageAllowed: z.boolean().default(false),
  items: z.array(relationshipExchangeItemInputSchema).min(1).max(20),
  followUp: relationshipFollowUpInputSchema.nullable().default(null),
  relations: z.array(relationshipRelationInputSchema).max(30).default([]),
});

export const relationshipRecordDetailsUpdateSchema = z.object({
  title: z.string().trim().min(1, "事件标题不能为空").max(240).optional(),
  eventType: relationshipEventTypeSchema.optional(),
  occasion: z.string().trim().max(160).optional(),
  eventDate: z.iso.date().optional(),
  location: z.string().trim().max(240).optional(),
  description: z.string().trim().max(8000).optional(),
  significanceLevel: z.number().int().min(1).max(5).nullable().optional(),
  expectationLevel: z.enum(["none", "unclear", "implicit", "explicit"]).optional(),
  privacyLevel: z.enum(["private", "sensitive"]).optional(),
  aiUsageAllowed: z.boolean().optional(),
  status: z.enum(["active", "archived", "cancelled"]).optional(),
})
  .refine((value) => Object.keys(value).length > 0, { message: "至少需要修改一个字段" });

export const relationshipFollowUpUpdateSchema = z.object({
  status: relationshipFollowUpStatusSchema.optional(),
  relatedTaskId: z.string().trim().max(160).nullable().optional(),
  relatedScheduleEventId: z.string().trim().max(160).nullable().optional(),
  completedAt: z.iso.datetime().nullable().optional(),
});

export type RelationshipContactInput = z.infer<typeof relationshipContactInputSchema>;
export type RelationshipRecordInput = z.infer<typeof relationshipRecordInputSchema>;
export type RelationshipRecordDetailsUpdate = z.infer<typeof relationshipRecordDetailsUpdateSchema>;
export type RelationshipFollowUpUpdate = z.infer<typeof relationshipFollowUpUpdateSchema>;
