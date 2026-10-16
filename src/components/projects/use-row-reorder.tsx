"use client";

import { useRef, useState, type DragEvent } from "react";
import { GripVertical } from "lucide-react";

type SortableItem = { id: string; group: string; label: string };

export function useRowReorder(items: SortableItem[], onMove: (sourceId: string, targetId: string) => void) {
  const dragging = useRef<string | null>(null);
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const [over, setOver] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const byId = new Map(items.map((item) => [item.id, item]));
  function clear() { dragging.current = null; setOver(null); }
  function canDrop(id: string) {
    const source = byId.get(dragging.current ?? "");
    const target = byId.get(id);
    return source && target && source.id !== target.id && source.group === target.group;
  }
  function move(id: string, targetId: string) {
    const source = byId.get(id);
    if (!source) return;
    onMove(id, targetId);
    const position = items.filter((item) => item.group === source.group).findIndex((item) => item.id === targetId) + 1;
    setAnnouncement(`${source.label}已移到第 ${position} 项`);
  }
  function rowProps(id: string) {
    return {
      "data-sort-over": over === id ? true : undefined,
      onDragOver(event: DragEvent<HTMLElement>) {
        if (!canDrop(id)) return;
        event.preventDefault(); event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setOver(id);
      },
      onDrop(event: DragEvent<HTMLElement>) {
        if (!canDrop(id)) return;
        event.preventDefault(); event.stopPropagation();
        const sourceId = dragging.current!;
        clear(); move(sourceId, id);
      },
    };
  }
  function handle(id: string) {
    const item = byId.get(id);
    if (!item) return null;
    const siblings = items.filter((candidate) => candidate.group === item.group);
    const enabled = siblings.length > 1;
    return <button type="button" ref={(node) => { if (node) handles.current.set(id, node); else handles.current.delete(id); }} className="project-drag-handle project-row-drag-handle" disabled={!enabled} draggable={enabled} aria-label={`移动${item.label}`} title="拖动调整组内顺序，或使用上下方向键" aria-keyshortcuts="ArrowUp ArrowDown"
      onDragStart={(event) => { if (!enabled) { event.preventDefault(); return; } event.stopPropagation(); dragging.current = id; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/project-row", id); }}
      onDragEnd={clear}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault(); event.stopPropagation();
        const index = siblings.findIndex((candidate) => candidate.id === id);
        const target = siblings[index + (event.key === "ArrowUp" ? -1 : 1)];
        if (target) { move(id, target.id); requestAnimationFrame(() => handles.current.get(id)?.focus()); }
      }}><GripVertical className="size-3.5" /></button>;
  }
  return { rowProps, handle, announcement };
}
