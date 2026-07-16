import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  RelationshipContactInput,
  RelationshipFollowUpUpdate,
  RelationshipRecordInput,
  RelationshipRecordDetailsUpdate,
} from "@/lib/relationships-schema";
import type {
  RelationshipAttachment,
  RelationshipContact,
  RelationshipExchangeItem,
  RelationshipFollowUp,
  RelationshipRecord,
  RelationshipRecordRelation,
  RelationshipTargetType,
  RelationshipWorkspace,
} from "@/lib/relationships";

type AuthContext = { supabase: SupabaseClient; user: User };

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function mapContact(row: Record<string, unknown>): RelationshipContact {
  return {
    id: text(row.id),
    name: text(row.name),
    alias: text(row.alias),
    relationshipType: text(row.relationship_type),
    organization: text(row.organization),
    role: text(row.role),
    phone: text(row.phone),
    email: text(row.email),
    notes: text(row.notes),
    importantDates: Array.isArray(row.important_dates)
      ? row.important_dates.filter(
          (item): item is { label: string; date: string } =>
            Boolean(item) && typeof item === "object" && "label" in item && "date" in item,
        )
      : [],
    aiUsageAllowed: Boolean(row.ai_usage_allowed),
    archivedAt: nullableText(row.archived_at),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function mapItem(row: Record<string, unknown>): RelationshipExchangeItem {
  return {
    id: text(row.id),
    relationshipRecordId: text(row.relationship_record_id),
    category: text(row.category),
    itemName: text(row.item_name),
    description: text(row.description),
    quantity: numberOrNull(row.quantity),
    estimatedValueMinor: numberOrNull(row.estimated_value_minor),
    currency: text(row.currency).trim(),
    materialValueLevel: numberOrNull(row.material_value_level),
    isReturnable: Boolean(row.is_returnable),
    returnStatus: text(row.return_status),
    notes: text(row.notes),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function mapFollowUp(row: Record<string, unknown>): RelationshipFollowUp {
  return {
    id: text(row.id),
    relationshipRecordId: text(row.relationship_record_id),
    followUpType: text(row.follow_up_type),
    actionText: text(row.action_text),
    responsibleParty: (row.responsible_party as RelationshipFollowUp["responsibleParty"]) ?? "me",
    triggerType: text(row.trigger_type),
    triggerDate: nullableText(row.trigger_date),
    triggerEntityType: (row.trigger_entity_type as RelationshipTargetType | null) ?? null,
    triggerEntityId: nullableText(row.trigger_entity_id),
    dueDate: nullableText(row.due_date),
    status: row.status as RelationshipFollowUp["status"],
    relatedTaskId: nullableText(row.related_task_id),
    relatedScheduleEventId: nullableText(row.related_schedule_event_id),
    completedAt: nullableText(row.completed_at),
    notes: text(row.notes),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function mapRelation(row: Record<string, unknown>): RelationshipRecordRelation {
  return {
    id: text(row.id),
    relationshipRecordId: text(row.relationship_record_id),
    targetType: row.target_type as RelationshipTargetType,
    targetId: text(row.target_id),
    relationType: row.relation_type as RelationshipRecordRelation["relationType"],
    createdAt: text(row.created_at),
  };
}

function mapAttachment(row: Record<string, unknown>, signedUrl = ""): RelationshipAttachment {
  return {
    id: text(row.id),
    relationshipRecordId: text(row.relationship_record_id),
    fileName: text(row.file_name),
    mimeType: text(row.mime_type),
    fileSize: Number(row.file_size ?? 0),
    storagePath: text(row.storage_path),
    signedUrl,
    createdAt: text(row.created_at),
  };
}

export async function loadRelationshipWorkspace({ supabase, user }: AuthContext): Promise<RelationshipWorkspace> {
  const [contactsResult, recordsResult, itemsResult, followUpsResult, relationsResult, attachmentsResult] =
    await Promise.all([
      supabase.from("contacts").select("*").eq("user_id", user.id).order("name"),
      supabase.from("relationship_records").select("*").eq("user_id", user.id).order("event_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("relationship_exchange_items").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("relationship_follow_ups").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("relationship_record_relations").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("relationship_attachments").select("*").eq("user_id", user.id).order("created_at"),
    ]);

  const firstError = [contactsResult, recordsResult, itemsResult, followUpsResult, relationsResult, attachmentsResult]
    .find((result) => result.error)?.error;
  if (firstError) throw new Error("Unable to load relationship workspace.");

  const contacts = (contactsResult.data ?? []).map((row) => mapContact(row));
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const items = (itemsResult.data ?? []).map((row) => mapItem(row));
  const followUps = (followUpsResult.data ?? []).map((row) => mapFollowUp(row));
  const relations = (relationsResult.data ?? []).map((row) => mapRelation(row));
  const rawAttachments = attachmentsResult.data ?? [];
  const attachments = await Promise.all(
    rawAttachments.map(async (row) => {
      const storagePath = text(row.storage_path);
      const { data } = await supabase.storage.from("relationship-attachments").createSignedUrl(storagePath, 15 * 60);
      return mapAttachment(row, data?.signedUrl ?? "");
    }),
  );

  const itemsByRecord = new Map<string, RelationshipExchangeItem[]>();
  const followUpsByRecord = new Map<string, RelationshipFollowUp[]>();
  const relationsByRecord = new Map<string, RelationshipRecordRelation[]>();
  const attachmentsByRecord = new Map<string, RelationshipAttachment[]>();
  for (const item of items) itemsByRecord.set(item.relationshipRecordId, [...(itemsByRecord.get(item.relationshipRecordId) ?? []), item]);
  for (const item of followUps) followUpsByRecord.set(item.relationshipRecordId, [...(followUpsByRecord.get(item.relationshipRecordId) ?? []), item]);
  for (const item of relations) relationsByRecord.set(item.relationshipRecordId, [...(relationsByRecord.get(item.relationshipRecordId) ?? []), item]);
  for (const item of attachments) attachmentsByRecord.set(item.relationshipRecordId, [...(attachmentsByRecord.get(item.relationshipRecordId) ?? []), item]);

  const records = (recordsResult.data ?? []).flatMap((row): RelationshipRecord[] => {
    const contact = contactById.get(text(row.contact_id));
    if (!contact) return [];
    const id = text(row.id);
    return [{
      id,
      contactId: contact.id,
      direction: row.direction as RelationshipRecord["direction"],
      title: text(row.title),
      eventType: text(row.event_type),
      occasion: text(row.occasion),
      eventDate: text(row.event_date),
      occurredAt: nullableText(row.occurred_at),
      location: text(row.location),
      description: text(row.description),
      significanceLevel: numberOrNull(row.significance_level),
      expectationLevel: row.expectation_level as RelationshipRecord["expectationLevel"],
      status: row.status as RelationshipRecord["status"],
      privacyLevel: row.privacy_level as RelationshipRecord["privacyLevel"],
      aiUsageAllowed: Boolean(row.ai_usage_allowed),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
      archivedAt: nullableText(row.archived_at),
      contact,
      items: itemsByRecord.get(id) ?? [],
      followUps: followUpsByRecord.get(id) ?? [],
      relations: relationsByRecord.get(id) ?? [],
      attachments: attachmentsByRecord.get(id) ?? [],
    }];
  });

  return { contacts, records };
}

export async function createRelationshipContact(
  { supabase, user }: AuthContext,
  input: RelationshipContactInput,
) {
  const { data, error } = await supabase.from("contacts").insert({
    user_id: user.id,
    name: input.name,
    alias: input.alias,
    relationship_type: input.relationshipType,
    organization: input.organization,
    role: input.role,
    phone: input.phone,
    email: input.email,
    notes: input.notes,
    important_dates: input.importantDates,
    ai_usage_allowed: input.aiUsageAllowed,
  }).select("*").single();
  if (error) throw new Error("Unable to create contact.");
  return mapContact(data);
}

const targetTables: Partial<Record<RelationshipTargetType, string>> = {
  research_project: "research_projects",
  research_paper: "research_papers",
  research_submission: "research_submissions",
  research_meeting: "research_meetings",
  log_post: "log_posts",
  literature: "literatures",
};

async function validateRelationOwnership(context: AuthContext, input: RelationshipRecordInput) {
  if (input.relations.length === 0) return;
  const { supabase, user } = context;
  const scheduleRelations = input.relations.filter((relation) => relation.targetType === "task" || relation.targetType === "schedule_event");
  if (scheduleRelations.length > 0) {
    const { data, error } = await supabase.from("schedule_data").select("tasks,events").eq("user_id", user.id).maybeSingle();
    if (error || !data) throw new Error("Unable to verify task or schedule relation.");
    const taskIds = new Set(Array.isArray(data.tasks) ? data.tasks.map((item) => item && typeof item === "object" && "id" in item ? String(item.id) : "") : []);
    const eventIds = new Set(Array.isArray(data.events) ? data.events.map((item) => item && typeof item === "object" && "id" in item ? String(item.id) : "") : []);
    for (const relation of scheduleRelations) {
      const valid = relation.targetType === "task" ? taskIds.has(relation.targetId) : eventIds.has(relation.targetId);
      if (!valid) throw new Error("Task or schedule relation does not belong to the current user.");
    }
  }

  for (const [targetType, table] of Object.entries(targetTables)) {
    const ids = input.relations.filter((relation) => relation.targetType === targetType).map((relation) => relation.targetId);
    if (ids.length === 0 || !table) continue;
    const { data, error } = await supabase.from(table).select("id").eq("user_id", user.id).in("id", ids);
    if (error || (data ?? []).length !== new Set(ids).size) {
      throw new Error("A related entity does not belong to the current user.");
    }
  }
}

export async function createRelationshipRecord(context: AuthContext, input: RelationshipRecordInput) {
  const { supabase, user } = context;
  const [contactResult] = await Promise.all([
    supabase.from("contacts").select("id").eq("id", input.contactId).eq("user_id", user.id).is("archived_at", null).maybeSingle(),
    validateRelationOwnership(context, input),
  ]);
  if (contactResult.error || !contactResult.data) throw new Error("Contact not found.");

  const { data, error } = await supabase.rpc("create_relationship_record_atomic", { p_payload: input });
  if (error || !data) throw new Error("Unable to create relationship record.");
  return String(data);
}

export async function updateRelationshipFollowUp(
  context: AuthContext,
  id: string,
  input: RelationshipFollowUpUpdate,
) {
  const { supabase, user } = context;
  if (input.relatedTaskId || input.relatedScheduleEventId) {
    const { data, error } = await supabase.from("schedule_data").select("tasks,events").eq("user_id", user.id).maybeSingle();
    if (error || !data) throw new Error("Unable to verify task or schedule relation.");
    const taskIds = new Set(Array.isArray(data.tasks) ? data.tasks.map((item) => item && typeof item === "object" && "id" in item ? String(item.id) : "") : []);
    const eventIds = new Set(Array.isArray(data.events) ? data.events.map((item) => item && typeof item === "object" && "id" in item ? String(item.id) : "") : []);
    if (input.relatedTaskId && !taskIds.has(input.relatedTaskId)) throw new Error("Related task does not belong to the current user.");
    if (input.relatedScheduleEventId && !eventIds.has(input.relatedScheduleEventId)) throw new Error("Related schedule event does not belong to the current user.");
  }
  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.relatedTaskId !== undefined) patch.related_task_id = input.relatedTaskId;
  if (input.relatedScheduleEventId !== undefined) patch.related_schedule_event_id = input.relatedScheduleEventId;
  if (input.completedAt !== undefined) patch.completed_at = input.completedAt;
  const { data, error } = await supabase.from("relationship_follow_ups").update(patch).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) throw new Error("Follow-up not found.");
}

export async function updateRelationshipRecord(
  { supabase, user }: AuthContext,
  id: string,
  input: RelationshipRecordDetailsUpdate,
) {
  const columns: Record<keyof RelationshipRecordDetailsUpdate, string> = {
    title: "title",
    eventType: "event_type",
    occasion: "occasion",
    eventDate: "event_date",
    location: "location",
    description: "description",
    significanceLevel: "significance_level",
    expectationLevel: "expectation_level",
    privacyLevel: "privacy_level",
    aiUsageAllowed: "ai_usage_allowed",
    status: "status",
  };
  const patch = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [columns[key as keyof RelationshipRecordDetailsUpdate], value]),
  );
  const { data, error } = await supabase.from("relationship_records").update(patch).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) throw new Error("Relationship record not found.");
}

export async function archiveRelationshipContact({ supabase, user }: AuthContext, id: string) {
  const { data, error } = await supabase.from("contacts").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) throw new Error("Contact not found.");
}

async function cleanQueuedRelationshipStorage({ supabase, user }: AuthContext) {
  const { data, error } = await supabase.from("relationship_storage_cleanup").select("storage_path").eq("user_id", user.id);
  if (error) throw new Error("Unable to inspect queued relationship attachments.");
  const paths = (data ?? []).map((item) => text(item.storage_path)).filter(Boolean);
  if (paths.length === 0) return;
  const { error: storageError } = await supabase.storage.from("relationship-attachments").remove(paths);
  if (storageError) throw new Error("Relationship data was deleted; attachment cleanup remains queued.");
  const { error: queueError } = await supabase.from("relationship_storage_cleanup").delete().eq("user_id", user.id).in("storage_path", paths);
  if (queueError) throw new Error("Attachment cleanup confirmation failed.");
}

export async function deleteRelationshipRecord(context: AuthContext, id: string) {
  const { data, error } = await context.supabase.rpc("delete_relationship_record_atomic", { p_record_id: id });
  if (error) throw new Error("Unable to delete relationship record.");
  await cleanQueuedRelationshipStorage(context);
  if (!data) throw new Error("Relationship record not found.");
}

export async function deleteRelationshipAttachment(context: AuthContext, id: string) {
  const { data, error } = await context.supabase.rpc("delete_relationship_attachment_atomic", { p_attachment_id: id });
  if (error) throw new Error("Unable to delete relationship attachment.");
  await cleanQueuedRelationshipStorage(context);
  if (!data) throw new Error("Relationship attachment not found.");
}

export async function clearRelationshipWorkspace(context: AuthContext) {
  const { error } = await context.supabase.rpc("clear_relationship_workspace_atomic");
  if (error) throw new Error("Unable to clear relationship workspace.");
  await cleanQueuedRelationshipStorage(context);
}
