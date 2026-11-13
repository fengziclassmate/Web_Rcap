"use client";

import { Popover } from "@base-ui/react/popover";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function WeekColumnPicker({ dates, visibleWeekdays, today, onChange }: {
  dates: Date[];
  visibleWeekdays: number[];
  today: string;
  onChange: (weekdays: number[]) => void;
}) {
  const includesToday = dates.some((date) => format(date, "yyyy-MM-dd") === today);
  return <Popover.Root>
    <Popover.Trigger render={<Button type="button" variant="outline" size="sm" className="h-8 border-[0.5px] px-2.5 text-xs" aria-label="选择显示日期列" />}>
      显示列 {visibleWeekdays.length}/7
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-[100]">
        <Popover.Popup className="max-h-[var(--available-height)] w-64 overflow-y-auto rounded-md border-[0.5px] border-border bg-popover p-3 text-popover-foreground">
          <Popover.Title className="mb-2 text-sm font-semibold">显示日期列</Popover.Title>
          <div className="space-y-1">
            {dates.map((date) => {
              const day = date.getDay();
              const checked = visibleWeekdays.includes(day);
              const label = format(date, "EEE", { locale: zhCN });
              return <label key={day} className="flex min-h-9 cursor-pointer items-center gap-3 rounded px-2 text-xs hover:bg-accent">
                <Checkbox checked={checked} disabled={checked && visibleWeekdays.length === 1} aria-label={`显示${label}`}
                  onCheckedChange={(next) => onChange(dates.map((item) => item.getDay()).filter((item) => item === day ? next === true : visibleWeekdays.includes(item)))} />
                <span>{label}</span><span className="ml-auto tabular-nums text-muted-foreground">{format(date, "M/d")}</span>
              </label>;
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2">
            <Button type="button" variant="outline" size="xs" onClick={() => onChange(dates.map((date) => date.getDay()))}>显示全部</Button>
            {includesToday && <Button type="button" variant="outline" size="xs" onClick={() => onChange(dates.filter((date) => format(date, "yyyy-MM-dd") >= today).map((date) => date.getDay()))}>只看今天及之后</Button>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">按星期记忆，至少保留一天</p>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}
