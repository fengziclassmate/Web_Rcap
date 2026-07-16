"use client";

import { supabase } from "@/lib/supabase";
import type { RelationshipContact, RelationshipWorkspace } from "@/lib/relationships";
import type { RelationshipContactInput, RelationshipFollowUpUpdate, RelationshipRecordDetailsUpdate, RelationshipRecordInput } from "@/lib/relationships-schema";

async function authorizedFetch(input: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("登录状态已失效，请重新登录。");
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? "请求失败，请稍后重试。");
  }
  return response;
}

export async function fetchRelationshipWorkspace(): Promise<RelationshipWorkspace> {
  return (await authorizedFetch("/api/relationships")).json();
}

export async function createRelationshipContact(input: RelationshipContactInput): Promise<RelationshipContact> {
  const response = await authorizedFetch("/api/relationships/contacts", { method: "POST", body: JSON.stringify(input) });
  const payload = await response.json() as { contact: RelationshipContact };
  return payload.contact;
}

export async function createRelationshipRecord(input: RelationshipRecordInput) {
  const response = await authorizedFetch("/api/relationships", { method: "POST", body: JSON.stringify(input) });
  return response.json() as Promise<{ id: string }>;
}

export async function uploadRelationshipAttachment(recordId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  await authorizedFetch(`/api/relationships/records/${recordId}/attachments`, { method: "POST", body: form });
}

export async function removeRelationshipAttachment(id: string) {
  await authorizedFetch(`/api/relationships/attachments/${id}`, { method: "DELETE" });
}

export async function patchRelationshipRecord(id: string, input: RelationshipRecordDetailsUpdate) {
  await authorizedFetch(`/api/relationships/records/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function patchRelationshipFollowUp(id: string, input: RelationshipFollowUpUpdate) {
  await authorizedFetch(`/api/relationships/follow-ups/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function removeRelationshipRecord(id: string) {
  await authorizedFetch(`/api/relationships/records/${id}`, { method: "DELETE" });
}

export async function clearRelationshipWorkspace() {
  await authorizedFetch("/api/relationships", { method: "DELETE" });
}

export async function archiveRelationshipContact(id: string) {
  await authorizedFetch("/api/relationships/contacts", { method: "DELETE", body: JSON.stringify({ id }) });
}

export async function downloadRelationshipExport() {
  const response = await authorizedFetch("/api/relationships/export");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `relationship-exchange-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
