"use client";

import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Clock3, GripVertical, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ShoppingItem } from "@/lib/types";

type ShoppingListProps = {
  items: ShoppingItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (name: string) => void;
  onToggleItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onReorderItem: (sourceItemId: string, targetItemId: string) => void;
  variant?: "section" | "panel";
  addDialogOpen?: boolean;
  onAddDialogOpenChange?: (open: boolean) => void;
};

function formatAddedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "加入时间未知" : `加入于 ${format(date, "yyyy-MM-dd HH:mm")}`;
}

export function ShoppingList({
  items,
  open,
  onOpenChange,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onReorderItem,
  variant = "section",
  addDialogOpen,
  onAddDialogOpenChange,
}: ShoppingListProps) {
  const [internalAddDialogOpen, setInternalAddDialogOpen] = useState(false);
  const [itemName, setItemName] = useState("");
  const [sortAnnouncement, setSortAnnouncement] = useState("");
  const draggingItemIdRef = useRef<string | null>(null);
  const orderedItems = useMemo(() => {
    const pending: ShoppingItem[] = [];
    const completed: ShoppingItem[] = [];
    for (const item of items) {
      (item.done ? completed : pending).push(item);
    }
    return [...pending, ...completed];
  }, [items]);

  const showAddDialog = addDialogOpen ?? internalAddDialogOpen;

  function setShowAddDialog(open: boolean) {
    if (addDialogOpen === undefined) setInternalAddDialogOpen(open);
    onAddDialogOpenChange?.(open);
  }

  function handleAddItem() {
    const name = itemName.trim();
    if (!name) return;
    onAddItem(name);
    setItemName("");
    setShowAddDialog(false);
  }

  function handleDropItem(targetItem: ShoppingItem) {
    const sourceItemId = draggingItemIdRef.current;
    if (!sourceItemId || sourceItemId === targetItem.id) return;
    const sourceItem = items.find((item) => item.id === sourceItemId);
    if (!sourceItem || sourceItem.done !== targetItem.done) return;
    onReorderItem(sourceItemId, targetItem.id);
    const group = orderedItems.filter((candidate) => candidate.done === sourceItem.done);
    const targetPosition = group.findIndex((candidate) => candidate.id === targetItem.id) + 1;
    setSortAnnouncement(`${sourceItem.name}已移至当前分组第 ${targetPosition} 项`);
    draggingItemIdRef.current = null;
  }

  function moveItemWithKeyboard(item: ShoppingItem, direction: -1 | 1) {
    const group = orderedItems.filter((candidate) => candidate.done === item.done);
    const index = group.findIndex((candidate) => candidate.id === item.id);
    const target = group[index + direction];
    if (!target) {
      setSortAnnouncement(`${item.name}已在当前分组${direction < 0 ? "最上方" : "最下方"}`);
      return;
    }
    onReorderItem(item.id, target.id);
    setSortAnnouncement(`${item.name}已移至当前分组第 ${index + direction + 1} 项`);
  }

  const listContent = (
    <div className={variant === "panel" ? "space-y-3" : "space-y-3 rounded-2xl subtle-card p-3"}>
      {items.length > 0 ? (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {orderedItems.map((item) => (
            <li
              key={item.id}
              className={`shopping-item-row transition-[opacity,transform,background-color] ${item.done ? "bg-stone-50/70 opacity-70" : ""}`}
              onDragOver={(event) => {
                const source = items.find((candidate) => candidate.id === draggingItemIdRef.current);
                if (source && source.done === item.done && source.id !== item.id) {
                  event.preventDefault();
                }
              }}
              onDrop={() => handleDropItem(item)}
            >
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  draggingItemIdRef.current = item.id;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/shopping-item-id", item.id);
                }}
                onDragEnd={() => {
                  draggingItemIdRef.current = null;
                }}
                className="mt-0.5 rounded-md p-0.5 text-stone-300 transition-colors hover:bg-amber-50 hover:text-amber-700"
                onKeyDown={(event) => {
                  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                  event.preventDefault();
                  moveItemWithKeyboard(item, event.key === "ArrowUp" ? -1 : 1);
                }}
                aria-label={`移动购物项 ${item.name}，可使用上下方向键排序`}
                aria-keyshortcuts="ArrowUp ArrowDown"
                title={item.done ? "拖动或使用方向键调整已购买顺序" : "拖动或使用方向键调整待购买顺序"}
              >
                <GripVertical className="h-4 w-4" aria-hidden />
              </button>
              <Checkbox
                checked={item.done}
                onCheckedChange={() => onToggleItem(item.id)}
                className="mt-0.5"
                aria-label={`${item.name} 完成状态`}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`break-words text-sm leading-snug ${
                    item.done ? "text-stone-400 line-through" : "text-stone-900"
                  }`}
                >
                  {item.name}
                </p>
                <time
                  dateTime={item.addedAt}
                  className="mt-1 flex items-center gap-1 text-[11px] tabular-nums text-stone-400"
                >
                  <Clock3 className="h-3 w-3" aria-hidden />
                  {formatAddedAt(item.addedAt)}
                </time>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 rounded-md hover:bg-red-50 hover:text-red-500"
                onClick={() => onDeleteItem(item.id)}
                aria-label={`删除购物项 ${item.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-center text-sm text-gray-500">清单还是空的，添加下一件要买的东西吧。</p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {sortAnnouncement}
      </p>
    </div>
  );

  return (
    <>
      {variant === "panel" ? (
        <section className="utility-panel utility-panel-shopping" data-testid="shopping-list">
          <Collapsible className="utility-panel-root" open={open} onOpenChange={onOpenChange}>
            <CollapsibleContent className="utility-panel-content mt-3">
              {listContent}
            </CollapsibleContent>
          </Collapsible>
        </section>
      ) : (
        <div className="task-dashboard-section" data-testid="shopping-list">
          <Collapsible open={open} onOpenChange={onOpenChange}>
        <div className="relative mb-3">
          <CollapsibleTrigger
            className="section-trigger relative flex w-full items-center rounded-xl py-2.5 pl-3 pr-20 text-left"
            aria-label={open ? "折叠购物清单" : "展开购物清单"}
          >
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-700">
              <ShoppingBasket className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              购物清单
              <span className="text-xs font-normal tabular-nums text-stone-400">{items.length} 件</span>
            </span>
            <ChevronDown
              className={`absolute right-3 h-4 w-4 text-gray-500 transition-transform ${open ? "" : "-rotate-90"}`}
              aria-hidden
            />
          </CollapsibleTrigger>
          <Button
            type="button"
            size="icon-sm"
            className="absolute right-9 top-1/2 z-10 -translate-y-1/2"
            onClick={() => setShowAddDialog(true)}
            aria-label="添加购物项"
            title="添加购物项"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <CollapsibleContent>
          {listContent}
        </CollapsibleContent>
      </Collapsible>
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="rounded-sm border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-sm">添加购物项</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddItem();
                }
              }}
              placeholder="输入要购买的物品"
              aria-label="购物项名称"
            />
            <Button type="button" className="w-full" onClick={handleAddItem}>
              加入购物清单
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
