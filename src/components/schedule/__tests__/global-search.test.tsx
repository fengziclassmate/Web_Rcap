import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { normalizeEvents, normalizeTasks } from "@/lib/normalizers";
import { buildSearchIndex, GlobalSearch } from "../global-search";

describe("global search", () => {
  it("opens with the keyboard, searches notes, and locates the selected task", () => {
    const task = normalizeTasks([{ id: "task", name: "实验记录", notes: "检查对照组参数" }])[0];
    const onLocate = vi.fn();
    render(<GlobalSearch tasks={[task]} events={[]} logs={[]} annualTasks={[]} projects={[]} shopping={[]} logsReady onLocate={onLocate} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByLabelText("搜索工作台内容"), { target: { value: "对照组" } });
    fireEvent.click(screen.getByRole("button", { name: /实验记录/ }));
    fireEvent.click(screen.getByRole("button", { name: "打开任务" }));
    expect(onLocate).toHaveBeenCalledWith(expect.objectContaining({ task }));
  });
  it("indexes schedule requirements and keeps same-id entities separate", () => {
    const index = buildSearchIndex(normalizeEvents([{ id: "same", title: "阅读", requirements: ["重点核对消融实验"] }]), normalizeTasks([{ id: "same", name: "阅读任务" }]), [], [], [], []);
    expect(index).toHaveLength(2);
    expect(index.find((entry) => entry.kind === "日程")?.detail).toContain("消融实验");
  });
});
