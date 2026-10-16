"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dashboardSections, defaultDashboardSectionOrder, moveDashboardSection, normalizeDashboardSectionOrder, type DashboardSectionId } from "@/lib/dashboard-sections";

export function SortableDashboardSections({ sections, order, onOrderChange }: {
  sections: { id: DashboardSectionId; content: ReactNode }[];
  order?: DashboardSectionId[];
  onOrderChange: (order: DashboardSectionId[]) => void;
}) {
  const [arranging, setArranging] = useState(false);
  const dragging = useRef<DashboardSectionId | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: DashboardSectionId; after: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const normalized = normalizeDashboardSectionOrder(order);
  const available = normalized.filter((id) => sections.some((section) => section.id === id && section.content != null));

  function move(source: DashboardSectionId, target: DashboardSectionId, after = false) {
    const next = moveDashboardSection(normalized, source, target, after);
    if (next.every((id, index) => id === normalized[index])) return;
    onOrderChange(next);
    const position = next.filter((id) => available.includes(id)).indexOf(source) + 1;
    setAnnouncement(`${dashboardSections.find((section) => section.id === source)?.title}已移到第 ${position} 位`);
  }

  return <>
    <div className="dashboard-layout-toolbar" data-arranging={arranging}>
      {arranging && <span className="text-xs text-stone-500">模块顺序</span>}
      <div className="flex shrink-0 gap-1">
        {arranging && <Button size="icon-sm" variant="ghost" title="恢复默认顺序" aria-label="恢复默认模块顺序" onClick={() => { onOrderChange([...defaultDashboardSectionOrder]); setAnnouncement("已恢复默认模块顺序"); }}><RotateCcw className="size-3.5" /></Button>}
        <Button size="sm" variant={arranging ? "secondary" : "ghost"} aria-pressed={arranging} onClick={() => { setArranging(!arranging); dragging.current = null; setDropTarget(null); }}>{arranging ? <Check className="size-3.5" /> : <Settings2 className="size-3.5" />}{arranging ? "完成排序" : "调整顺序"}</Button>
      </div>
    </div>
    <div className={arranging ? "space-y-2 p-3" : ""} data-testid="dashboard-section-list">
      {available.map((id, index) => {
        const title = dashboardSections.find((section) => section.id === id)!.title;
        const target = dropTarget?.id === id ? dropTarget : null;
        return <div key={id} data-dashboard-section={id} className={arranging ? `relative rounded-lg border bg-white ${target ? "border-emerald-700" : "border-stone-200"}` : ""}
          onDragOver={(event) => {
            if (!arranging || !dragging.current) return;
            event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move";
            const bounds = event.currentTarget.getBoundingClientRect();
            const after = event.clientY >= bounds.top + bounds.height / 2;
            setDropTarget((previous) => previous?.id === id && previous.after === after ? previous : { id, after });
          }}
          onDrop={(event) => {
            if (!arranging || !dragging.current) return;
            event.preventDefault(); event.stopPropagation();
            const bounds = event.currentTarget.getBoundingClientRect();
            move(dragging.current, id, event.clientY >= bounds.top + bounds.height / 2);
            dragging.current = null; setDropTarget(null);
          }}>
          {arranging && <div className={`flex items-center gap-2 px-2 py-3 ${target ? target.after ? "border-b-2 border-b-emerald-700" : "border-t-2 border-t-emerald-700" : ""}`}>
            <button type="button" draggable aria-label={`拖动排序：${title}`} title="拖动排序，或用方向键上下移动" className="cursor-grab rounded p-1.5 text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
              onDragStart={(event) => { event.stopPropagation(); dragging.current = id; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-rcap-dashboard-section", id); }}
              onDragEnd={() => { dragging.current = null; setDropTarget(null); }}
              onKeyDown={(event) => { if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return; event.preventDefault(); const down = event.key === "ArrowDown"; const neighbor = available[index + (down ? 1 : -1)]; if (neighbor) move(id, neighbor, down); }}><GripVertical className="size-4" /></button>
            <span className="flex-1 text-sm font-medium text-stone-700">{title}</span>
            <Button size="icon-sm" variant="ghost" aria-label={`上移${title}`} disabled={index === 0} onClick={() => move(id, available[index - 1])}><ArrowUp className="size-3.5" /></Button>
            <Button size="icon-sm" variant="ghost" aria-label={`下移${title}`} disabled={index === available.length - 1} onClick={() => move(id, available[index + 1], true)}><ArrowDown className="size-3.5" /></Button>
          </div>}
          <div hidden={arranging}>{sections.find((section) => section.id === id)?.content}</div>
        </div>;
      })}
    </div>
    <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
  </>;
}
