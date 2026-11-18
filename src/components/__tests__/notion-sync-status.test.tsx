import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NotionSyncStatus } from "../notion-sync-status";

const { from, byOwner, read } = vi.hoisted(() => ({
  from: vi.fn(),
  byOwner: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { from } }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("only reads sync status on open and links a conflict to its Notion record", async () => {
  const pageId = "4d363b81-e824-4028-80c0-c4f40f7aa1fc";
  from.mockReturnValue({ select: () => ({ eq: byOwner }) });
  byOwner.mockReturnValue({ abortSignal: () => ({ maybeSingle: read }) });
  read.mockResolvedValue({
    error: null,
    data: {
      last_finished_at: "2026-11-18T10:00:00Z",
      last_error: null,
      last_result: {
        conflicts: [{ kind: "task", localId: "task-1", pageId, fields: ["date"] }],
        issues: [],
      },
    },
  });
  render(<NotionSyncStatus userId="account-1" tasks={[{ id: "task-1", name: "测试任务" }]} projects={[]} />);
  expect(from).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Notion 同步" }));
  await screen.findByText("测试任务（计划执行日）");
  expect(byOwner).toHaveBeenCalledWith("user_id", "account-1");
  expect(screen.getByRole("link", { name: "在 Notion 中查看" }).getAttribute("href"))
    .toBe("https://app.notion.com/p/4d363b81e824402880c0c4f40f7aa1fc");
});
