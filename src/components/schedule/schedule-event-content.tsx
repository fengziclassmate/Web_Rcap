"use client";

import { useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check, MoreHorizontal } from "lucide-react";
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
  onToggleSelection: () => void;
};

export function ScheduleEventContent({ event, timeLabel, fullTimeLabel, categoryName, durationHour, dense, moving = false, onOpenEdit, onRename, onToggleSelection }: ScheduleEventContentProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const initialTitle = useRef(event.title);
  const cancelled = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const micro = durationHour < 0.75;
  const showNotes = Boolean(event.notes.trim()) && durationHour >= 1 && !dense;
  const showMetadata = durationHour >= 1.5 && !dense;
  const tagLabel = event.tag ? getEventTagInfo(event.tag).label : null;

  function saveTitle(value: string) {
    if (cancelled.current) return;
    const title = value.trim();
    if (!title) { toast.error("标题不能为空"); return; }
    if (event.title !== initialTitle.current && title !== event.title) {
      toast.error("标题已在其他页面更新，请复制当前内容后取消并重新编辑。");
      return;
    }
    if (title !== event.title) onRename(title);
    setDraft(null);
  }

  const titleControl = draft !== null ? (
    <input
      autoFocus
      data-inline-title-editor
      className="schedule-title-input text-xs"
      aria-label={`修改标题：${event.title}`}
      value={draft}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => saveTitle(event.currentTarget.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          cancelled.current = true;
          setDraft(null);
        }
        if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
      }}
    />
  ) : (
    <button
      type="button"
      className={`schedule-event-title relative z-20 min-w-0 text-left text-xs font-semibold ${micro ? "truncate" : "break-words"}`}
      aria-label={`修改 ${event.title} 标题`}
      title={event.title}
      onClick={(mouseEvent) => {
        mouseEvent.stopPropagation();
        initialTitle.current = event.title;
        cancelled.current = false;
        setPreviewOpen(false);
        setDraft(event.title);
      }}
    >
      {event.title}
    </button>
  );

  return (
    <Popover.Root open={previewOpen && !moving} onOpenChange={(open) => setPreviewOpen(draft === null && !moving && open)}>
      <div
        className="schedule-event-content relative flex min-h-0 min-w-0 flex-1 flex-col text-xs"
        data-micro={micro || undefined}
        data-compact={durationHour < 1 || undefined}
        data-dense={dense || undefined}
        data-notes={showNotes || undefined}
        data-tall={durationHour >= 2 || undefined}
        onClickCapture={(mouseEvent) => {
          if (!(mouseEvent.ctrlKey || mouseEvent.metaKey) || (mouseEvent.target as HTMLElement).closest("[data-inline-title-editor]")) return;
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
            className="schedule-event-time relative z-20 min-w-0 truncate text-left text-xs tabular-nums"
            aria-label={`查看 ${event.title} 完整信息`}
            title="查看完整信息"
          >
            {micro ? <MoreHorizontal className="size-3" aria-hidden /> : dense ? timeLabel.split("-")[0] : timeLabel}
          </Popover.Trigger>
          {event.isCompleted ? <Check className="schedule-event-completed size-3 shrink-0" aria-label="已完成" /> : null}
        </div>
        {titleControl}
        {showNotes ? <p className="schedule-event-notes min-h-0 overflow-hidden whitespace-pre-line break-words text-xs">{event.notes}</p> : null}
        {showMetadata ? (
          <div className="schedule-event-metadata mt-auto flex min-w-0 items-center gap-1.5 text-xs">
            <span className="min-w-0 truncate">{categoryName}</span>
            {tagLabel ? <span className="schedule-event-tag min-w-0 truncate">{tagLabel}</span> : null}
          </div>
        ) : null}
      </div>
      <Popover.Portal>
        <Popover.Positioner side="right" align="start" sideOffset={8} className="z-[110]">
          <Popover.Popup className="schedule-event-preview text-xs" initialFocus={false}>
            <Popover.Title className="break-words text-sm font-semibold">{event.title}</Popover.Title>
            <p className="schedule-preview-time mt-1 tabular-nums">{event.endDate && event.endDate !== event.date ? fullTimeLabel : `${event.date} ${fullTimeLabel}`}</p>
            <div className="schedule-preview-meta mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <span>分类：{categoryName}</span>
              {tagLabel ? <span>标记：{tagLabel}</span> : null}
              {event.isCompleted ? <span className="schedule-event-completed">已完成</span> : null}
            </div>
            {event.notes.trim() ? <p className="mt-3 whitespace-pre-wrap break-words">{event.notes}</p> : null}
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
