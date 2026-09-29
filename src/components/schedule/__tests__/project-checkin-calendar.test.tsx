import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProjectCheckinCalendar } from "../project-checkin-calendar";
import type { ProjectCheckin } from "@/lib/types";

const project: ProjectCheckin = { id: "p", name: "健身", description: "", startDate: "2026-09-01", checkins: [{ date: "2026-09-28", note: "09:00 · 跑步\n18:00 · 深蹲" }], dailyCheckins: [], dailyCompletions: [], archives: [{ id: "a", startDate: "2026-08-01", endDate: "2026-08-31", archivedAt: "2026-09-01", checkins: [{ date: "2026-08-25", note: "旧阶段锻炼" }] }] };

describe("ProjectCheckinCalendar", () => {
  it("distinguishes checked, unchecked and future days and shows all daily notes", () => {
    render(<ProjectCheckinCalendar project={project} today="2026-09-29" />);
    expect(screen.getByRole("button", { name: "2026-09-29 未打卡" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "2026-09-30 未来日期" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "2026-09-28 已打卡" }));
    expect(screen.getByText(/09:00 · 跑步/).textContent).toContain("18:00 · 深蹲");
  });
  it("switches months and includes archived check-ins", () => {
    render(<ProjectCheckinCalendar project={project} today="2026-09-29" />);
    fireEvent.click(screen.getByRole("button", { name: "月" }));
    fireEvent.click(screen.getByRole("button", { name: "上一期打卡记录" }));
    expect(screen.getByText("2026年8月")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "2026-08-25 已打卡" }));
    expect(screen.getByText("旧阶段锻炼")).toBeTruthy();
  });
});
