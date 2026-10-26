"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction, type KeyboardEvent } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { getEventTagInfo } from "@/lib/event-tags";
import type { ScheduleEvent } from "@/lib/types";

type ScheduleEventContentProps = {
  event: ScheduleEvent;
  timeLabel: string;
  fullTimeLabel: string;
  categoryName: string;
  durationHour: number;
  dense: boolean;
  moving?: boolean;
  onOpenEdit: () => void;
  onRename: (title: string) => void;
  onNotesChange: (notes: string) => void;
  onToggleSelection: () => void;
  onEditingChange: Dispatch<SetStateAction<string | null>>;
};

export function ScheduleEventContent({ event, timeLabel, fullTimeLabel, categoryName, durationHour, dense, moving = false, onOpenEdit, onRename, onNotesChange, onToggleSelection, onEditingChange }: ScheduleEventContentProps) {
  const [editor, setEditor] = useState<{ field: "title" | "notes"; initial: string; value: string } | null>(null);
  const cancelled = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const micro = durationHour < 0.75;
  const showNotes = Boolean(event.notes.trim()) && durationHour >= 1;
  const showMetadata = durationHour >= 1.5;
  const tagLabel = event.tag ? getEventTagInfo(event.tag).label : null;

  useEffect(() => () => {
    onEditingChange((current) => current === event.id ? null : current);
  }, [event.id, onEditingChange]);

  function beginEditing(field: "title" | "notes") {
    if (editor) return;
    cancelled.current = false;
    setPreviewOpen(false);
    setEditor({ field, initial: event[field], value: event[field] });
    onEditingChange(event.id);
  }

  function saveEditor(value: string) {
    if (cancelled.current) return;
    const { field, initial } = editor!;
    const text = value.trim();
    if (field === "title" && !text) { toast.error("标题不能为空"); return; }
    if (event[field] !== initial && text !== event[field]) {
      toast.error(`${field === "title" ? "标题" : "补充信息"}已在其他页面更新，请复制当前内容后取消并重新编辑。`);
      return;
    }
    if (text !== event[field]) {
      if (field === "title") onRename(text);
      else onNotesChange(text);
    }
    setEditor(null);
    onEditingChange(null);
  }

  function handleEditorKeyDown(keyEvent: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    keyEvent.stopPropagation();
    if (keyEvent.nativeEvent.isComposing) return;
    if (keyEvent.key === "Escape") {
      keyEvent.preventDefault();
      cancelled.current = true;
      setEditor(null);
      onEditingChange(null);
    }
    if (keyEvent.key === "Enter" && (editor!.field === "title" || keyEvent.ctrlKey || keyEvent.metaKey)) {
      keyEvent.preventDefault();
      keyEvent.currentTarget.blur();
    }
  }

  const titleControl = editor?.field === "title" ? (
    <input
      autoFocus
      data-inline-title-editor
      data-inline-editor
      className="schedule-title-input text-xs"
      aria-label={`修改标题：${event.title}`}
      value={editor.value}
      onFocus={(focusEvent) => { onEditingChange(event.id); focusEvent.currentTarget.select(); }}
      onChange={(changeEvent) => setEditor({ ...editor, value: changeEvent.target.value })}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onBlur={(blurEvent) => saveEditor(blurEvent.currentTarget.value)}
      onKeyDown={handleEditorKeyDown}
    />
  ) : (
    <button
      type="button"
      className={`schedule-event-title relative z-20 min-w-0 text-left text-xs font-semibold ${micro ? "truncate" : "break-words"}`}
      aria-label={`修改 ${event.title} 标题`}
      title={event.title}
      onClick={(mouseEvent) => {
        mouseEvent.stopPropagation();
        beginEditing("title");
      }}
    >
      {event.title}
    </button>
  );

  return (
    <Popover.Root open={previewOpen && !moving} onOpenChange={(open) => setPreviewOpen(editor === null && !moving && open)}>
      <div
        className="schedule-event-content relative flex min-h-0 min-w-0 flex-1 flex-col text-xs"
        data-micro={micro || undefined}
        data-compact={durationHour < 1 || undefined}
        data-dense={dense || undefined}
        data-notes={showNotes || undefined}
        data-editing-notes={editor?.field === "notes" || undefined}
        data-tall={durationHour >= 2 || undefined}
        onClickCapture={(mouseEvent) => {
          if (!(mouseEvent.ctrlKey || mouseEvent.metaKey) || (mouseEvent.target as HTMLElement).closest("[data-inline-editor]")) return;
          mouseEvent.preventDefault();
          mouseEvent.stopPropagation();
          setPreviewOpen(false);
          onToggleSelection();
        }}
      >
        <button
          type="button"
          className="schedule-event-open absolute inset-0 z-10 rounded-[inherit] text-left"
          aria-label={`打开 ${event.title} 编辑窗口`}
          onClick={onOpenEdit}
        />
        <div className="schedule-event-time-row relative flex min-w-0 items-center gap-1">
          <Popover.Trigger
            openOnHover
            delay={250}
            closeDelay={150}
            className="schedule-event-time relative z-20 shrink-0 whitespace-nowrap text-left text-xs tabular-nums"
            aria-label={`查看 ${event.title} 完整信息`}
            title="查看完整信息"
          >
            {timeLabel}
          </Popover.Trigger>
          {event.isCompleted ? <Check className="schedule-event-completed size-3 shrink-0" aria-label="已完成" /> : null}
        </div>
        {titleControl}
        {editor?.field === "notes" ? (
          <textarea
            autoFocus
            data-inline-editor
            className="schedule-notes-input relative z-30 text-xs"
            aria-label={`修改补充信息：${event.title}`}
            value={editor.value}
            onFocus={() => onEditingChange(event.id)}
            onChange={(changeEvent) => setEditor({ ...editor, value: changeEvent.target.value })}
            onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
            onClick={(mouseEvent) => mouseEvent.stopPropagation()}
            onBlur={(blurEvent) => saveEditor(blurEvent.currentTarget.value)}
            onKeyDown={handleEditorKeyDown}
          />
        ) : showNotes ? (
          <button type="button" className="schedule-event-notes relative z-20 min-h-0 overflow-hidden whitespace-pre-line break-words text-left text-xs" aria-label={`编辑 ${event.title} 补充信息`} onClick={() => beginEditing("notes")}>{event.notes}</button>
        ) : !event.notes.trim() && durationHour >= 1 ? (
          <button type="button" className="schedule-add-notes absolute bottom-1 left-1 z-20 text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => beginEditing("notes")} aria-label={`编辑 ${event.title} 补充信息`}>添加补充信息</button>
        ) : null}
        {showMetadata ? (
          <div className="schedule-event-metadata mt-auto flex min-w-0 items-center gap-1.5 text-xs">
            <span className="min-w-0 truncate">{categoryName}</span>
            {tagLabel ? <span className="schedule-event-tag min-w-0 truncate">{tagLabel}</span> : null}
          </div>
        ) : null}
      </div>
      <Popover.Portal>
        <Popover.Positioner side="right" align="start" sideOffset={8} className="z-[110]">
          <Popover.Popup className="schedule-event-preview text-xs" initialFocus={false} finalFocus={editor === null}>
            <Popover.Title className="break-words text-sm font-semibold">{event.title}</Popover.Title>
            <p className="schedule-preview-time mt-1 tabular-nums">{event.endDate && event.endDate !== event.date ? fullTimeLabel : `${event.date} ${fullTimeLabel}`}</p>
            <div className="schedule-preview-meta mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <span>分类：{categoryName}</span>
              {tagLabel ? <span>标记：{tagLabel}</span> : null}
              {event.isCompleted ? <span className="schedule-event-completed">已完成</span> : null}
            </div>
            <button type="button" className="schedule-preview-notes mt-3 block w-full whitespace-pre-wrap break-words text-left" aria-label={`在卡片上编辑 ${event.title} 补充信息`} onClick={() => beginEditing("notes")}>{event.notes.trim() ? event.notes : "添加补充信息"}</button>
            {event.requirements.length > 0 ? (
              <div className="mt-3">
                <p className="font-medium">准备事项</p>
                <ul className="mt-1 list-inside list-disc space-y-1">{event.requirements.map((requirement, index) => <li key={index} className="whitespace-pre-wrap break-words">{requirement}</li>)}</ul>
              </div>
            ) : null}
            <button type="button" className="schedule-preview-edit mt-3 text-xs font-medium" onClick={() => { setPreviewOpen(false); onOpenEdit(); }}>编辑日程</button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
