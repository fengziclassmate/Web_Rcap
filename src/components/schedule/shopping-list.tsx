"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Clock3, Plus, ShoppingBasket, Trash2 } from "lucide-react";
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
}: ShoppingListProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [itemName, setItemName] = useState("");

  function handleAddItem() {
    const name = itemName.trim();
    if (!name) return;
    onAddItem(name);
    setItemName("");
    setShowAddDialog(false);
  }

  return (
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
          <div className="space-y-3 rounded-2xl subtle-card p-3">
            {items.length > 0 ? (
              <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {items.map((item) => (
                  <li key={item.id} className="shopping-item-row">
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
          </div>
        </CollapsibleContent>
      </Collapsible>

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
    </div>
  );
}
