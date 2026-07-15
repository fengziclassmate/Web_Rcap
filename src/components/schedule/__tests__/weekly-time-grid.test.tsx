import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CenteredTimePartSelect,
  WeeklyTimeGrid,
} from "@/components/schedule/weekly-time-grid";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe("CenteredTimePartSelect", () => {
  it("shows the first minute option without blank content above it", async () => {
    render(
      <CenteredTimePartSelect
        value={0}
        options={[0, 1, 2]}
        label="分钟"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "分钟" }));

    const listbox = await screen.findByRole("listbox");
    expect(listbox.firstElementChild).toBe(screen.getByRole("option", { name: "00" }));
  });

  it("applies the rest template to every 50+10 tail slot in the work week", async () => {
    const onCreateEvents = vi.fn();
    render(
      <WeeklyTimeGrid
        currentWeekStart={new Date(2026, 6, 13)}
        weekRange="2026/07/13 - 2026/07/19"
        events={[]}
        onCreateEvent={vi.fn()}
        onCreateEvents={onCreateEvents}
        onCreateDailyTask={vi.fn(() => null)}
        onUpdateEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
        onPrevWeek={vi.fn()}
        onNextWeek={vi.fn()}
        viewMode="week"
        timeGranularity="50-10"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "模板" }));

    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByLabelText("标题") as HTMLInputElement).value).toBe("休息");
    expect(within(dialog).getByText("45 个")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "铺入本周" }));

    expect(onCreateEvents).toHaveBeenCalledTimes(1);
    expect(onCreateEvents.mock.calls[0][0]).toHaveLength(45);
    expect(onCreateEvents.mock.calls[0][0][0]).toEqual(
      expect.objectContaining({
        date: "2026-07-13",
        startHour: 9 + 50 / 60,
        endHour: 10,
        title: "休息",
      }),
    );
  });
});
