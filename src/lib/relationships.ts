export type RelationshipFollowUpStatus =
  | "pending_decision"
  | "pending"
  | "task_created"
  | "scheduled"
  | "completed"
  | "cancelled"
  | "not_needed";

export type EffectiveRelationshipFollowUpStatus =
  | RelationshipFollowUpStatus
  | "awaiting_confirmation"
  | "missing_link";

type FollowUpStatusSource = {
  status: RelationshipFollowUpStatus;
  relatedTaskId: string | null;
  relatedScheduleEventId: string | null;
};

type TaskStatusSource = { id: string; done: boolean };
type EventStatusSource = { id: string; isCompleted: boolean };

export type RelationshipDirection = "received" | "given" | "mutual";
export type RelationshipRecordStatus = "active" | "archived" | "cancelled";
export type RelationshipTargetType =
  | "task"
  | "schedule_event"
  | "research_project"
  | "research_paper"
  | "research_submission"
  | "research_meeting"
  | "log_post"
  | "literature";

export type RelationshipContact = {
  id: string;
  name: string;
  alias: string;
  relationshipType: string;
  organization: string;
  role: string;
  phone: string;
  email: string;
  notes: string;
  importantDates: Array<{ label: string; date: string }>;
  aiUsageAllowed: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RelationshipExchangeItem = {
  id: string;
  relationshipRecordId: string;
  category: string;
  itemName: string;
  description: string;
  quantity: number | null;
  estimatedValueMinor: number | null;
  currency: string;
  materialValueLevel: number | null;
  isReturnable: boolean;
  returnStatus: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type RelationshipFollowUp = {
  id: string;
  relationshipRecordId: string;
  followUpType: string;
  actionText: string;
  responsibleParty: "me" | "other" | "mutual";
  triggerType: string;
  triggerDate: string | null;
  triggerEntityType: RelationshipTargetType | null;
  triggerEntityId: string | null;
  dueDate: string | null;
  status: RelationshipFollowUpStatus;
  relatedTaskId: string | null;
  relatedScheduleEventId: string | null;
  completedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type RelationshipRecordRelation = {
  id: string;
  relationshipRecordId: string;
  targetType: RelationshipTargetType;
  targetId: string;
  relationType: "context" | "source" | "outcome";
  createdAt: string;
};

export type RelationshipAttachment = {
  id: string;
  relationshipRecordId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  signedUrl: string;
  createdAt: string;
};

export type RelationshipRecord = {
  id: string;
  contactId: string;
  direction: RelationshipDirection;
  title: string;
  eventType: string;
  occasion: string;
  eventDate: string;
  occurredAt: string | null;
  location: string;
  description: string;
  significanceLevel: number | null;
  expectationLevel: "none" | "unclear" | "implicit" | "explicit";
  status: RelationshipRecordStatus;
  privacyLevel: "private" | "sensitive";
  aiUsageAllowed: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  contact: RelationshipContact;
  items: RelationshipExchangeItem[];
  followUps: RelationshipFollowUp[];
  relations: RelationshipRecordRelation[];
  attachments: RelationshipAttachment[];
};

export type RelationshipWorkspace = {
  contacts: RelationshipContact[];
  records: RelationshipRecord[];
};

export const relationshipDirectionOptions = [
  { value: "received" as const, label: "我收到" },
  { value: "given" as const, label: "我给予" },
  { value: "mutual" as const, label: "共同往来" },
];

export const relationshipTypeOptions = [
  ["family", "家人"], ["relative", "亲属"], ["friend", "朋友"], ["classmate", "同学"],
  ["mentor", "导师"], ["colleague", "同事"], ["collaborator", "合作者"], ["student", "学生"],
  ["neighbor", "邻居"], ["service_provider", "服务人员"], ["other", "其他"],
] as const;

export const relationshipEventTypeOptions = [
  ["gift", "礼物"], ["money", "礼金/款项"], ["meal", "请客用餐"], ["expense_payment", "代付费用"],
  ["loan", "借用/借款"], ["material_support", "物质支持"], ["research_help", "科研帮助"], ["work_help", "工作帮助"],
  ["life_help", "生活帮助"], ["information", "信息"], ["advice", "建议"], ["introduction", "引荐"],
  ["recommendation", "推荐"], ["opportunity", "机会"], ["emotional_support", "情绪支持"], ["invitation", "邀请"],
  ["visit", "探望"], ["celebration", "庆祝"], ["condolence", "慰问"], ["accompaniment", "陪伴"], ["other", "其他"],
] as const;

export const relationshipItemCategoryOptions = [
  ["gift", "礼物"], ["cash", "现金/礼金"], ["meal", "餐食"], ["item", "物品"], ["service", "帮助/服务"],
  ["information", "信息"], ["resource", "资源"], ["introduction", "引荐"], ["opportunity", "机会"],
  ["recommendation", "推荐"], ["time", "时间投入"], ["emotional_support", "情绪支持"], ["other", "其他"],
] as const;

export const relationshipFollowUpTypeOptions = [
  ["thank", "感谢"], ["return_gift", "回礼"], ["repay", "偿还"], ["return_item", "归还物品"],
  ["invite_meal", "回请"], ["provide_help", "提供帮助"], ["complete_promise", "完成承诺"], ["send_material", "发送材料"],
  ["maintain_contact", "保持联系"], ["congratulate", "祝贺"], ["visit", "探望"], ["other", "其他"],
] as const;

export function relationshipOptionLabel(options: ReadonlyArray<readonly [string, string]>, value: string) {
  return options.find(([option]) => option === value)?.[1] ?? value;
}

export function formatRelationshipMoney(minor: number | null, currency: string) {
  if (minor === null) return "";
  const formatter = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: currency || "CNY",
    minimumFractionDigits: 2,
  });
  return formatter.format(minor / 100);
}

export type RelationshipSearchSource = {
  contactName: string;
  contactAlias: string;
  title: string;
  description: string;
  items: string[];
};

export function getEffectiveFollowUpStatus(
  followUp: FollowUpStatusSource,
  tasks: TaskStatusSource[],
  events: EventStatusSource[],
): EffectiveRelationshipFollowUpStatus {
  if (followUp.status === "task_created" && followUp.relatedTaskId) {
    const task = tasks.find((item) => item.id === followUp.relatedTaskId);
    if (!task) return "missing_link";
    return task.done ? "awaiting_confirmation" : followUp.status;
  }

  if (followUp.status === "scheduled" && followUp.relatedScheduleEventId) {
    const event = events.find((item) => item.id === followUp.relatedScheduleEventId);
    if (!event) return "missing_link";
    return event.isCompleted ? "awaiting_confirmation" : followUp.status;
  }

  return followUp.status;
}

export function matchesRelationshipSearch(source: RelationshipSearchSource, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;
  return [
    source.contactName,
    source.contactAlias,
    source.title,
    source.description,
    ...source.items,
  ]
    .join("\n")
    .toLocaleLowerCase()
    .includes(normalizedQuery);
}
