"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarPlus,
  Check,
  ChevronDown,
  Download,
  Gift,
  Handshake,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createRelationshipContact,
  createRelationshipRecord,
  clearRelationshipWorkspace,
  archiveRelationshipContact,
  downloadRelationshipExport,
  fetchRelationshipWorkspace,
  patchRelationshipFollowUp,
  patchRelationshipRecord,
  removeRelationshipRecord,
  removeRelationshipAttachment,
  uploadRelationshipAttachment,
} from "@/lib/relationships-api";
import {
  formatRelationshipMoney,
  getEffectiveFollowUpStatus,
  matchesRelationshipSearch,
  relationshipDirectionOptions,
  relationshipEventTypeOptions,
  relationshipFollowUpTypeOptions,
  relationshipItemCategoryOptions,
  relationshipOptionLabel,
  relationshipTypeOptions,
  type RelationshipContact,
  type RelationshipFollowUp,
  type RelationshipRecord,
} from "@/lib/relationships";
import type { RelationshipContactInput, RelationshipRecordInput } from "@/lib/relationships-schema";
import type { ResearchWorkflowState } from "@/lib/research-workflow";
import type { LongTask, ScheduleEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type ViewId = "overview" | "records" | "people" | "followups";
type RelationOption = { id: string; label: string };

type Props = {
  userId: string;
  tasks: LongTask[];
  events: ScheduleEvent[];
  workflow: ResearchWorkflowState;
  onCreateTask: (input: { title: string; dueDate?: string; notes?: string }) => string | null;
  onCreateEvent: (input: { title: string; date: string; notes?: string }) => string | null;
};

const fieldClass = "h-9 rounded-xl border-stone-200 bg-white/80";
const selectClass = `${fieldClass} w-full px-3 text-sm text-stone-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15`;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateLabel(value: string | null) {
  if (!value) return "未设日期";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function directionMeta(direction: RelationshipRecord["direction"]) {
  if (direction === "received") return { label: "我收到", icon: ArrowDownLeft, className: "bg-emerald-50 text-emerald-700" };
  if (direction === "given") return { label: "我给出", icon: ArrowUpRight, className: "bg-amber-50 text-amber-700" };
  return { label: "共同往来", icon: Handshake, className: "bg-sky-50 text-sky-700" };
}

function formatItemTotals(items: RelationshipRecord["items"]) {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.estimatedValueMinor === null) continue;
    const currency = item.currency || "CNY";
    totals.set(currency, (totals.get(currency) ?? 0) + item.estimatedValueMinor);
  }
  return [...totals].map(([currency, minor]) => formatRelationshipMoney(minor, currency)).join(" · ") || "—";
}

function FollowUpBadge({ status }: { status: ReturnType<typeof getEffectiveFollowUpStatus> }) {
  const labels: Record<string, string> = {
    pending_decision: "待决定",
    pending: "待处理",
    task_created: "已建任务",
    scheduled: "已排日程",
    awaiting_confirmation: "待确认完成",
    missing_link: "关联已丢失",
    completed: "已完成",
    cancelled: "已取消",
    not_needed: "无需跟进",
  };
  const done = status === "completed" || status === "not_needed";
  return <span className={cn("rounded-full px-2 py-1 text-[11px] font-medium", done ? "bg-stone-100 text-stone-500" : "bg-rose-50 text-rose-700")}>{labels[status] ?? status}</span>;
}

function ContactDialog({
  open,
  onOpenChange,
  onCreate,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: RelationshipContactInput) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipContactInput["relationshipType"]>("friend");
  const [organization, setOrganization] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-stone-200 bg-[#fbfaf6] p-6">
        <DialogHeader>
          <DialogTitle className="text-xl text-stone-950">新建联系人</DialogTitle>
          <DialogDescription>先记录最少信息，其他资料可后续补全。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-stone-700">姓名<Input autoFocus className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="姓名或称呼" /></label>
          <label className="grid gap-1.5 text-sm font-medium text-stone-700">关系<select className={selectClass} value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as RelationshipContactInput["relationshipType"])}>{relationshipTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium text-stone-700">单位（可选）<Input className={fieldClass} value={organization} onChange={(event) => setOrganization(event.target.value)} /></label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button disabled={!name.trim() || pending} onClick={() => onCreate({ name, relationshipType, organization, alias: "", role: "", phone: "", email: "", notes: "", importantDates: [], aiUsageAllowed: false })}>{pending ? "保存中…" : "保存联系人"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type DraftItem = { category: RelationshipRecordInput["items"][number]["category"]; itemName: string; amount: string };

function QuickAddDialog({
  open,
  onOpenChange,
  userId,
  contacts,
  tasks,
  events,
  projects,
  papers,
  meetings,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  userId: string;
  contacts: RelationshipContact[];
  tasks: LongTask[];
  events: ScheduleEvent[];
  projects: RelationOption[];
  papers: RelationOption[];
  meetings: RelationOption[];
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["relationships", userId] as const;
  const activeContacts = contacts.filter((contact) => !contact.archivedAt);
  const [contactId, setContactId] = useState("");
  const [direction, setDirection] = useState<RelationshipRecordInput["direction"]>("received");
  const [eventType, setEventType] = useState<RelationshipRecordInput["eventType"]>("gift");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(today);
  const [items, setItems] = useState<DraftItem[]>([{ category: "gift", itemName: "", amount: "" }]);
  const [occasion, setOccasion] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [significanceLevel, setSignificanceLevel] = useState(3);
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [followUpType, setFollowUpType] = useState<NonNullable<RelationshipRecordInput["followUp"]>["followUpType"]>("thank");
  const [followUpText, setFollowUpText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [executionLink, setExecutionLink] = useState("");
  const [relation, setRelation] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const contactMutation = useMutation({
    mutationFn: createRelationshipContact,
    onSuccess: (contact) => {
      queryClient.setQueryData(queryKey, (current: { contacts: RelationshipContact[]; records: RelationshipRecord[] } | undefined) => current ? { ...current, contacts: [...current.contacts, contact] } : current);
      setContactId(contact.id);
      setContactOpen(false);
      toast.success("联系人已创建");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const recordMutation = useMutation({
    mutationFn: async ({ input, attachments }: { input: RelationshipRecordInput; attachments: File[] }) => {
      const result = await createRelationshipRecord(input);
      try {
        for (const file of attachments) await uploadRelationshipAttachment(result.id, file);
      } catch (error) {
        await removeRelationshipRecord(result.id).catch(() => undefined);
        throw error;
      }
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("往来记录已保存");
      onOpenChange(false);
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function submit() {
    const cleanItems = items.filter((item) => item.itemName.trim());
    if (!contactId || !title.trim() || cleanItems.length === 0) {
      toast.error("请选择联系人，并填写事件标题与往来内容");
      return;
    }
    const [targetType, targetId] = relation.split(":");
    const [executionType, executionId] = executionLink.split(":");
    const input: RelationshipRecordInput = {
      contactId,
      direction,
      title,
      eventType,
      occasion,
      eventDate,
      location,
      description,
      significanceLevel,
      expectationLevel: "none",
      privacyLevel: "private",
      aiUsageAllowed: false,
      items: cleanItems.map((item) => ({
        category: item.category,
        itemName: item.itemName,
        description: "",
        quantity: null,
        estimatedValueMinor: item.amount ? Math.round(Number(item.amount) * 100) : null,
        currency: item.amount ? "CNY" : "",
        materialValueLevel: null,
        isReturnable: false,
        returnStatus: "not_applicable",
        notes: "",
      })),
      followUp: needsFollowUp ? {
        followUpType,
        actionText: followUpText.trim() || `${relationshipOptionLabel(relationshipFollowUpTypeOptions, followUpType)}：${title.trim()}`,
        responsibleParty: "me",
        triggerType: dueDate ? "date" : "manual",
        triggerDate: dueDate || null,
        triggerEntityType: null,
        triggerEntityId: null,
        dueDate: dueDate || null,
        status: executionType === "task" ? "task_created" : executionType === "event" ? "scheduled" : "pending_decision",
        relatedTaskId: executionType === "task" ? executionId : null,
        relatedScheduleEventId: executionType === "event" ? executionId : null,
        notes: "",
      } : null,
      relations: targetType && targetId ? [{ targetType: targetType as RelationshipRecordInput["relations"][number]["targetType"], targetId, relationType: "context" }] : [],
    };
    recordMutation.mutate({ input, attachments: files });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88vh] max-w-[760px] overflow-y-auto rounded-[2rem] border-stone-200 bg-[#f8f6ef] p-0">
          <div className="border-b border-stone-200 bg-stone-950 px-7 py-6 text-white">
            <DialogHeader><DialogTitle className="text-2xl text-white">记一笔往来</DialogTitle><DialogDescription className="text-stone-300">先记清楚人与事，再决定是否需要行动。</DialogDescription></DialogHeader>
          </div>
          <div className="grid gap-5 p-7">
            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-stone-700">联系人<div className="flex gap-2"><select className={selectClass} value={contactId} onChange={(event) => setContactId(event.target.value)}><option value="">选择联系人</option>{activeContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.alias ? ` · ${contact.alias}` : ""}</option>)}</select><Button variant="outline" size="icon" className="size-9 shrink-0 rounded-xl" onClick={() => setContactOpen(true)} aria-label="新建联系人"><UserPlus /></Button></div></label>
              <label className="grid gap-1.5 text-sm font-medium text-stone-700">日期<Input type="date" className={fieldClass} value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
            </div>
            <div className="grid grid-cols-3 gap-2" aria-label="往来方向">{relationshipDirectionOptions.map((option) => <button key={option.value} type="button" onClick={() => setDirection(option.value)} className={cn("rounded-2xl border px-3 py-3 text-sm font-medium transition", direction === option.value ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-600 hover:border-stone-400")}>{option.label}</button>)}</div>
            <div className="grid grid-cols-[220px_1fr] gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-stone-700">类型<select className={selectClass} value={eventType} onChange={(event) => setEventType(event.target.value as RelationshipRecordInput["eventType"])}>{relationshipEventTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="grid gap-1.5 text-sm font-medium text-stone-700">事件标题<Input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：王老师帮忙修改研究方案" /></label>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white/75 p-4">
              <div className="mb-3 flex items-center justify-between"><div><p className="font-semibold text-stone-900">往来内容</p><p className="text-xs text-stone-500">金额可留空，非物质帮助无需估价。</p></div><Button variant="outline" size="sm" onClick={() => setItems((current) => [...current, { category: "gift", itemName: "", amount: "" }])}><Plus />增加一项</Button></div>
              <div className="grid gap-2">{items.map((item, index) => <div key={index} className="grid grid-cols-[150px_1fr_140px_32px] gap-2"><select aria-label={`第 ${index + 1} 项类别`} className={selectClass} value={item.category} onChange={(event) => updateItem(index, { category: event.target.value as DraftItem["category"] })}>{relationshipItemCategoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Input aria-label={`第 ${index + 1} 项内容`} className={fieldClass} value={item.itemName} onChange={(event) => updateItem(index, { itemName: event.target.value })} placeholder="礼物、帮助或资源" /><Input aria-label={`第 ${index + 1} 项金额`} type="number" min="0" step="0.01" className={fieldClass} value={item.amount} onChange={(event) => updateItem(index, { amount: event.target.value })} placeholder="金额（元）" /><Button aria-label={`删除第 ${index + 1} 项`} variant="ghost" size="icon" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></Button></div>)}</div>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4"><input type="checkbox" checked={needsFollowUp} onChange={(event) => setNeedsFollowUp(event.target.checked)} className="size-4 accent-rose-700" /><span><span className="block text-sm font-semibold text-stone-900">这件事需要后续行动</span><span className="block text-xs text-stone-500">保存后可以创建任务或日程，但不会自动确认完成。</span></span></label>
            {needsFollowUp ? <div className="grid grid-cols-[160px_1fr_150px_190px] gap-3 rounded-2xl border border-rose-100 bg-white p-4"><select aria-label="后续行动类型" className={selectClass} value={followUpType} onChange={(event) => setFollowUpType(event.target.value as typeof followUpType)}>{relationshipFollowUpTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Input aria-label="后续行动" className={fieldClass} value={followUpText} onChange={(event) => setFollowUpText(event.target.value)} placeholder="具体要做什么" /><Input aria-label="后续截止日期" type="date" className={fieldClass} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><select aria-label="关联现有任务或日程" className={selectClass} value={executionLink} onChange={(event) => setExecutionLink(event.target.value)}><option value="">保存后再决定</option><optgroup label="现有任务">{tasks.filter((task) => !task.done).map((task) => <option key={task.id} value={`task:${task.id}`}>{task.name}</option>)}</optgroup><optgroup label="现有日程">{events.filter((event) => !event.isCompleted).map((event) => <option key={event.id} value={`event:${event.id}`}>{event.date} · {event.title}</option>)}</optgroup></select></div> : null}
            <button type="button" className="flex items-center gap-2 text-sm font-medium text-stone-600" onClick={() => setAdvanced((value) => !value)}><ChevronDown className={cn("transition-transform", advanced && "rotate-180")} />更多背景信息</button>
            {advanced ? <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white/60 p-4"><div className="grid grid-cols-3 gap-3"><Input className={fieldClass} value={occasion} onChange={(event) => setOccasion(event.target.value)} placeholder="场合 / 缘由" /><Input className={fieldClass} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="地点" /><label className="flex items-center gap-2 text-sm text-stone-600">重要程度<input type="range" min="1" max="5" value={significanceLevel} onChange={(event) => setSignificanceLevel(Number(event.target.value))} />{significanceLevel}</label></div><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="补充背景、承诺或需要记住的细节" /><select aria-label="关联科研上下文" className={selectClass} value={relation} onChange={(event) => setRelation(event.target.value)}><option value="">不关联科研事项</option><optgroup label="科研项目">{projects.map((option) => <option key={option.id} value={`research_project:${option.id}`}>{option.label}</option>)}</optgroup><optgroup label="论文">{papers.map((option) => <option key={option.id} value={`research_paper:${option.id}`}>{option.label}</option>)}</optgroup><optgroup label="组会">{meetings.map((option) => <option key={option.id} value={`research_meeting:${option.id}`}>{option.label}</option>)}</optgroup></select><label className="grid gap-1.5 text-sm font-medium text-stone-700">附件（PDF、图片或 Office 文件，单个不超过 10MB）<Input type="file" multiple className="h-10 pt-1.5" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx,.xls,.xlsx" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label></div> : null}
            <div className="flex justify-end gap-2 border-t border-stone-200 pt-5"><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button className="bg-stone-950 text-white" disabled={recordMutation.isPending} onClick={submit}>{recordMutation.isPending ? "保存中…" : "保存往来"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} onCreate={(input) => contactMutation.mutate(input)} pending={contactMutation.isPending} />
    </>
  );
}

function EditRecordDialog({ record, open, onOpenChange, onSave, pending }: { record: RelationshipRecord | null; open: boolean; onOpenChange: (open: boolean) => void; onSave: (input: { title: string; eventType: RelationshipRecordInput["eventType"]; eventDate: string; location: string; description: string }) => void; pending: boolean }) {
  const [title, setTitle] = useState(record?.title ?? "");
  const [eventType, setEventType] = useState<RelationshipRecordInput["eventType"]>((record?.eventType as RelationshipRecordInput["eventType"] | undefined) ?? "other");
  const [eventDate, setEventDate] = useState(record?.eventDate ?? today());
  const [location, setLocation] = useState(record?.location ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-lg rounded-3xl border-stone-200 bg-[#fbfaf6] p-6"><DialogHeader><DialogTitle className="text-xl">编辑往来事实</DialogTitle><DialogDescription>往来内容和金额保持不变，仅修改事件背景。</DialogDescription></DialogHeader><div className="grid gap-4"><label className="grid gap-1.5 text-sm font-medium">标题<Input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} /></label><div className="grid grid-cols-2 gap-3"><label className="grid gap-1.5 text-sm font-medium">类型<select className={selectClass} value={eventType} onChange={(event) => setEventType(event.target.value as typeof eventType)}>{relationshipEventTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium">日期<Input type="date" className={fieldClass} value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label></div><label className="grid gap-1.5 text-sm font-medium">地点<Input className={fieldClass} value={location} onChange={(event) => setLocation(event.target.value)} /></label><label className="grid gap-1.5 text-sm font-medium">事情经过<Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={!title.trim() || pending} onClick={() => onSave({ title, eventType, eventDate, location, description })}>{pending ? "保存中…" : "保存修改"}</Button></div></div></DialogContent></Dialog>;
}

function RecordRow({ record, onDelete, onEdit }: { record: RelationshipRecord; onDelete: (record: RelationshipRecord) => void; onEdit: (record: RelationshipRecord) => void }) {
  const queryClient = useQueryClient();
  const attachmentDeleteMutation = useMutation({
    mutationFn: removeRelationshipAttachment,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["relationships"] }); toast.success("附件已删除"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const meta = directionMeta(record.direction);
  const Icon = meta.icon;
  return <article className="grid grid-cols-[54px_160px_minmax(260px,1fr)_190px_150px_72px] items-center gap-4 border-b border-stone-100 px-5 py-4 last:border-0 hover:bg-stone-50/70"><div className={cn("flex size-10 items-center justify-center rounded-2xl", meta.className)}><Icon className="size-4" /></div><div><p className="font-semibold text-stone-900">{record.contact.name}</p><p className="text-xs text-stone-400">{relationshipOptionLabel(relationshipTypeOptions, record.contact.relationshipType)}</p></div><div className="min-w-0"><p className="truncate font-medium text-stone-900">{record.title}</p><p className="mt-1 truncate text-xs text-stone-500">{record.items.map((item) => item.itemName).join(" · ")}</p>{record.attachments.length ? <div className="mt-1 flex flex-wrap gap-2">{record.attachments.map((attachment) => <span key={attachment.id} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px]"><a className="max-w-32 truncate text-teal-700 hover:underline" href={attachment.signedUrl} target="_blank" rel="noreferrer">{attachment.fileName}</a><button type="button" className="text-stone-400 hover:text-red-600" aria-label={`删除附件 ${attachment.fileName}`} onClick={() => attachmentDeleteMutation.mutate(attachment.id)}>×</button></span>)}</div> : null}</div><div><span className={cn("rounded-full px-2 py-1 text-xs font-medium", meta.className)}>{meta.label}</span><span className="ml-2 text-xs text-stone-500">{relationshipOptionLabel(relationshipEventTypeOptions, record.eventType)}</span></div><div className="text-right"><p className="text-sm font-medium text-stone-800">{formatItemTotals(record.items)}</p><p className="text-xs text-stone-400">{dateLabel(record.eventDate)}</p></div><div className="flex"><Button variant="ghost" size="icon" aria-label={`编辑 ${record.title}`} onClick={() => onEdit(record)}><Pencil /></Button><Button variant="ghost" size="icon" aria-label={`删除 ${record.title}`} onClick={() => onDelete(record)}><Trash2 /></Button></div></article>;
}

function FollowUpRow({
  followUp,
  record,
  tasks,
  events,
  onCreateTask,
  onCreateEvent,
  onComplete,
}: {
  followUp: RelationshipFollowUp;
  record: RelationshipRecord;
  tasks: LongTask[];
  events: ScheduleEvent[];
  onCreateTask: () => void;
  onCreateEvent: () => void;
  onComplete: () => void;
}) {
  const status = getEffectiveFollowUpStatus(followUp, tasks, events);
  const actionable = !["completed", "cancelled", "not_needed"].includes(status);
  return <article className="grid grid-cols-[54px_minmax(260px,1fr)_160px_300px] items-center gap-4 border-b border-stone-100 px-5 py-4 last:border-0"><div className="flex size-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><ListTodo /></div><div><div className="flex items-center gap-2"><p className="font-semibold text-stone-900">{followUp.actionText}</p><FollowUpBadge status={status} /></div><p className="mt-1 text-xs text-stone-500">源自 {record.contact.name} · {record.title}</p></div><div><p className="text-xs uppercase tracking-wider text-stone-400">截止日期</p><p className="mt-1 text-sm text-stone-700">{dateLabel(followUp.dueDate)}</p></div><div className="flex justify-end gap-2">{followUp.status === "pending_decision" ? <><Button variant="outline" size="sm" onClick={onCreateTask}><ListTodo />建任务</Button><Button variant="outline" size="sm" onClick={onCreateEvent}><CalendarPlus />排日程</Button></> : null}{actionable ? <Button size="sm" onClick={onComplete}><Check />确认完成</Button> : null}</div></article>;
}

export function RelationshipExchangePanel({ userId, tasks, events, workflow, onCreateTask, onCreateEvent }: Props) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewId>("overview");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RelationshipRecord | null>(null);
  const [editTarget, setEditTarget] = useState<RelationshipRecord | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<RelationshipContact | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [directionFilter, setDirectionFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [peopleQuery, setPeopleQuery] = useState("");
  const queryKey = ["relationships", userId] as const;
  const relationshipQuery = useQuery({ queryKey, queryFn: fetchRelationshipWorkspace, enabled: Boolean(userId), staleTime: 30_000 });
  const workspace = relationshipQuery.data ?? { contacts: [], records: [] };
  const records = useMemo(() => workspace.records.filter((record) => (!directionFilter || record.direction === directionFilter) && (!eventTypeFilter || record.eventType === eventTypeFilter) && matchesRelationshipSearch({ contactName: record.contact.name, contactAlias: record.contact.alias, title: record.title, description: record.description, items: record.items.map((item) => item.itemName) }, deferredQuery)), [workspace.records, deferredQuery, directionFilter, eventTypeFilter]);
  const followUps = useMemo(() => workspace.records.flatMap((record) => record.followUps.map((followUp) => ({ followUp, record }))).sort((a, b) => (a.followUp.dueDate ?? "9999").localeCompare(b.followUp.dueDate ?? "9999")), [workspace.records]);
  const pendingCount = followUps.filter(({ followUp }) => !["completed", "cancelled", "not_needed"].includes(getEffectiveFollowUpStatus(followUp, tasks, events))).length;
  const totalValue = formatItemTotals(workspace.records.flatMap((record) => record.items));
  const patchMutation = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof patchRelationshipFollowUp>[1] }) => patchRelationshipFollowUp(id, patch), onSuccess: () => queryClient.invalidateQueries({ queryKey }), onError: (error: Error) => toast.error(error.message) });
  const deleteMutation = useMutation({ mutationFn: removeRelationshipRecord, onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success("往来记录已删除"); }, onError: (error: Error) => toast.error(error.message) });
  const editMutation = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof patchRelationshipRecord>[1] }) => patchRelationshipRecord(id, input), onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setEditTarget(null); toast.success("往来记录已更新"); }, onError: (error: Error) => toast.error(error.message) });
  const archiveMutation = useMutation({ mutationFn: archiveRelationshipContact, onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setArchiveTarget(null); toast.success("联系人已归档，历史记录仍保留"); }, onError: (error: Error) => toast.error(error.message) });
  const clearMutation = useMutation({ mutationFn: clearRelationshipWorkspace, onSuccess: () => { queryClient.setQueryData(queryKey, { contacts: [], records: [] }); toast.success("人情往来数据已清空"); }, onError: (error: Error) => toast.error(error.message) });
  const selectedContact = workspace.contacts.find((contact) => contact.id === selectedContactId) ?? workspace.contacts[0];
  const selectedRecords = selectedContact ? workspace.records.filter((record) => record.contactId === selectedContact.id) : [];
  const visibleContacts = workspace.contacts.filter((contact) => `${contact.name}\n${contact.alias}\n${contact.organization}`.toLocaleLowerCase().includes(peopleQuery.trim().toLocaleLowerCase()));
  const projects = workflow.projects.map((item) => ({ id: item.id, label: item.title }));
  const papers = workflow.papers.map((item) => ({ id: item.id, label: item.title }));
  const meetings = workflow.meetings.map((item) => ({ id: item.id, label: `${item.date} · ${item.title}` }));

  function createTaskFor(item: { followUp: RelationshipFollowUp; record: RelationshipRecord }) {
    const id = onCreateTask({ title: item.followUp.actionText, dueDate: item.followUp.dueDate ?? undefined, notes: `人情往来：${item.record.contact.name} · ${item.record.title}` });
    if (!id) return toast.error("任务创建失败");
    patchMutation.mutate({ id: item.followUp.id, patch: { status: "task_created", relatedTaskId: id, relatedScheduleEventId: null } });
    toast.success("已创建任务");
  }

  function createEventFor(item: { followUp: RelationshipFollowUp; record: RelationshipRecord }) {
    const id = onCreateEvent({ title: item.followUp.actionText, date: item.followUp.dueDate ?? today(), notes: `人情往来：${item.record.contact.name} · ${item.record.title}` });
    if (!id) return toast.error("日程创建失败");
    patchMutation.mutate({ id: item.followUp.id, patch: { status: "scheduled", relatedScheduleEventId: id, relatedTaskId: null } });
    toast.success("已加入日程");
  }

  const views: Array<{ id: ViewId; label: string; icon: typeof Gift }> = [{ id: "overview", label: "总览", icon: Gift }, { id: "records", label: "全部往来", icon: Handshake }, { id: "people", label: "联系人", icon: Users }, { id: "followups", label: `待办 ${pendingCount || ""}`, icon: ListTodo }];
  if (relationshipQuery.isLoading) return <section className="glass-panel min-h-[620px] rounded-[1.5rem] p-8 text-sm text-stone-500">正在整理往来簿…</section>;
  if (relationshipQuery.isError) return <section className="glass-panel rounded-[1.5rem] p-8"><p className="font-semibold text-stone-900">暂时无法加载人情往来</p><p className="mt-2 text-sm text-stone-500">{relationshipQuery.error.message}</p><Button className="mt-4" onClick={() => relationshipQuery.refetch()}>重试</Button></section>;

  return <section className="min-h-[720px] overflow-hidden rounded-[1.6rem] border border-white/70 bg-[#f6f3eb]/90 shadow-[0_24px_70px_rgba(65,58,45,0.12)]">
    <header className="flex items-center justify-between border-b border-stone-200/80 bg-stone-950 px-7 py-5 text-white"><div><p className="text-xs uppercase tracking-[0.24em] text-teal-300">Relationship ledger</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">人情往来</h1><p className="mt-1 text-sm text-stone-400">记住帮助，也把该做的事落到执行里。</p></div><div className="flex gap-2"><Button variant="ghost" className="text-stone-400 hover:bg-white/10 hover:text-white" onClick={() => setClearOpen(true)}>清空</Button><Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15" onClick={() => void downloadRelationshipExport()}><Download />导出</Button><Button className="bg-[#d7f4e7] text-stone-950 hover:bg-white" onClick={() => setQuickAddOpen(true)}><Plus />记一笔往来</Button></div></header>
    <div className="grid grid-cols-[210px_minmax(0,1fr)]">
      <aside className="border-r border-stone-200/80 bg-white/45 p-4"><nav className="grid gap-1">{views.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setView(item.id)} className={cn("flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition", view === item.id ? "bg-stone-950 text-white shadow-lg" : "text-stone-600 hover:bg-white hover:text-stone-950")}><Icon className="size-4" />{item.label}</button>; })}</nav><div className="mt-8 rounded-2xl border border-stone-200 bg-white/70 p-4"><p className="text-xs uppercase tracking-wider text-stone-400">本月提醒</p><p className="mt-2 text-3xl font-semibold text-stone-950">{pendingCount}</p><p className="mt-1 text-xs leading-5 text-stone-500">件往来需要你做决定或确认。</p></div></aside>
      <div className="min-w-0 p-6">
        {view === "overview" ? <div className="grid gap-5"><div className="grid grid-cols-3 gap-4"><div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-xs uppercase tracking-wider text-stone-400">往来记录</p><p className="mt-3 text-3xl font-semibold text-stone-950">{workspace.records.length}</p><p className="mt-1 text-sm text-stone-500">与 {workspace.contacts.filter((item) => !item.archivedAt).length} 位联系人</p></div><div className="rounded-3xl bg-[#e8f3ed] p-5"><p className="text-xs uppercase tracking-wider text-teal-700">已记录价值</p><p className="mt-3 text-xl font-semibold text-stone-950">{totalValue}</p><p className="mt-1 text-sm text-stone-500">按币种分开，仅统计主动填写项</p></div><div className="rounded-3xl bg-[#f6e8e5] p-5"><p className="text-xs uppercase tracking-wider text-rose-700">待后续</p><p className="mt-3 text-3xl font-semibold text-stone-950">{pendingCount}</p><p className="mt-1 text-sm text-stone-500">完成后仍需你确认</p></div></div><div className="overflow-hidden rounded-3xl border border-stone-200 bg-white"><div className="flex items-center justify-between px-5 py-4"><div><h2 className="font-semibold text-stone-950">最近往来</h2><p className="text-xs text-stone-500">按发生日期排列</p></div><Button variant="ghost" size="sm" onClick={() => setView("records")}>查看全部</Button></div>{workspace.records.slice(0, 6).map((record) => <RecordRow key={record.id} record={record} onDelete={setDeleteTarget} onEdit={setEditTarget} />)}{workspace.records.length === 0 ? <EmptyState onAdd={() => setQuickAddOpen(true)} /> : null}</div></div> : null}
        {view === "records" ? <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white"><div className="flex items-center justify-between gap-3 border-b border-stone-100 p-5"><div><h2 className="text-lg font-semibold text-stone-950">全部往来</h2><p className="text-xs text-stone-500">搜索并筛选事实记录</p></div><select aria-label="方向筛选" className={`${selectClass} w-32`} value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value)}><option value="">全部方向</option>{relationshipDirectionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select aria-label="类型筛选" className={`${selectClass} w-36`} value={eventTypeFilter} onChange={(event) => setEventTypeFilter(event.target.value)}><option value="">全部类型</option>{relationshipEventTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><div className="relative w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" /><Input className="h-10 rounded-2xl border-stone-200 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索往来簿" /></div></div>{records.map((record) => <RecordRow key={record.id} record={record} onDelete={setDeleteTarget} onEdit={setEditTarget} />)}{records.length === 0 ? <EmptyState onAdd={() => setQuickAddOpen(true)} /> : null}</div> : null}
        {view === "people" ? <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-5"><div className="rounded-3xl border border-stone-200 bg-white p-3"><div className="flex items-center justify-between px-2 py-2"><h2 className="font-semibold text-stone-950">联系人</h2><span className="text-xs text-stone-400">{workspace.contacts.length}</span></div><Input className="my-2 h-9 rounded-xl" value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} placeholder="搜索联系人" /><div className="grid gap-1">{visibleContacts.map((contact) => <button key={contact.id} type="button" onClick={() => setSelectedContactId(contact.id)} className={cn("rounded-2xl px-3 py-3 text-left", selectedContact?.id === contact.id ? "bg-stone-950 text-white" : "hover:bg-stone-50")}><p className="font-medium">{contact.name}</p><p className={cn("mt-1 text-xs", selectedContact?.id === contact.id ? "text-stone-400" : "text-stone-500")}>{relationshipOptionLabel(relationshipTypeOptions, contact.relationshipType)}{contact.archivedAt ? " · 已归档" : ""}</p></button>)}</div></div><div className="overflow-hidden rounded-3xl border border-stone-200 bg-white">{selectedContact ? <><div className="flex items-start justify-between border-b border-stone-100 p-6"><div><div className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-lg font-semibold text-teal-800">{selectedContact.name.slice(0, 1)}</div><h2 className="mt-4 text-xl font-semibold text-stone-950">{selectedContact.name}</h2><p className="mt-1 text-sm text-stone-500">{selectedContact.organization || relationshipOptionLabel(relationshipTypeOptions, selectedContact.relationshipType)}</p></div>{!selectedContact.archivedAt ? <Button variant="outline" size="sm" onClick={() => setArchiveTarget(selectedContact)}>归档联系人</Button> : null}</div>{selectedRecords.map((record) => <RecordRow key={record.id} record={record} onDelete={setDeleteTarget} onEdit={setEditTarget} />)}{selectedRecords.length === 0 ? <p className="p-8 text-sm text-stone-500">还没有与这位联系人的往来记录。</p> : null}</> : <EmptyState onAdd={() => setQuickAddOpen(true)} />}</div></div> : null}
        {view === "followups" ? <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white"><div className="border-b border-stone-100 p-5"><h2 className="text-lg font-semibold text-stone-950">后续行动</h2><p className="text-xs text-stone-500">创建任务或日程后，最终完成状态仍由你确认。</p></div>{followUps.map((item) => <FollowUpRow key={item.followUp.id} {...item} tasks={tasks} events={events} onCreateTask={() => createTaskFor(item)} onCreateEvent={() => createEventFor(item)} onComplete={() => patchMutation.mutate({ id: item.followUp.id, patch: { status: "completed", completedAt: new Date().toISOString() } })} />)}{followUps.length === 0 ? <p className="p-8 text-sm text-stone-500">没有需要跟进的往来。</p> : null}</div> : null}
      </div>
    </div>
    <QuickAddDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} userId={userId} contacts={workspace.contacts} tasks={tasks} events={events} projects={projects} papers={papers} meetings={meetings} onSaved={() => setView("records")} />
    <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title="删除这条往来记录？" description="关联的往来内容、后续行动和附件也会一并删除，且无法恢复。" confirmLabel="删除记录" onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }} />
    <ConfirmDialog open={clearOpen} onOpenChange={setClearOpen} title="清空全部人情往来数据？" description="所有联系人、往来记录、后续行动和附件都会永久删除。建议先导出备份。" confirmLabel="永久清空" onConfirm={() => clearMutation.mutate()} />
    <ConfirmDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)} title="归档这个联系人？" description="联系人将不再出现在新建记录的选择列表中，已有往来时间线会完整保留。" confirmLabel="归档联系人" variant="warning" onConfirm={() => { if (archiveTarget) archiveMutation.mutate(archiveTarget.id); }} />
    <EditRecordDialog key={editTarget?.id ?? "closed"} record={editTarget} open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)} pending={editMutation.isPending} onSave={(input) => { if (editTarget) editMutation.mutate({ id: editTarget.id, input }); }} />
  </section>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <div className="flex flex-col items-center px-8 py-16 text-center"><div className="flex size-14 items-center justify-center rounded-3xl bg-stone-100 text-stone-500"><Gift /></div><p className="mt-4 font-semibold text-stone-900">往来簿还是空的</p><p className="mt-1 max-w-sm text-sm leading-6 text-stone-500">从一件最近收到的帮助或送出的心意开始，不需要把所有细节一次写完。</p><Button className="mt-4" onClick={onAdd}><Plus />记第一笔</Button></div>;
}
