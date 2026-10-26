import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LogPage } from "../log-page";
import type { LogPostRecord } from "@/lib/logs";
import { buildLogStats, defaultLogFilters, filterLogPosts, groupLogsByDate, sortLogPosts } from "@/lib/logs";
const post: LogPostRecord = {
  id: "dated-log", userId: "owner", content: "日期修改测试", category: "life", mood: null, location: "北楼", visibility: "private", isPinned: false, isArchived: false,
  sourceType: "daily_reflection", sourceId: "source", createdAt: new Date("2026-10-20T14:35:12.345").toISOString(), updatedAt: new Date("2026-10-20T14:35:12.345").toISOString(), images: [], tags: [], links: [],
};
const props = { posts: [], tags: [], onUpdatePost: async () => true, onDeletePost: async () => {}, onTogglePinned: async () => {}, onToggleArchived: async () => {} };
describe("log submission state", () => {
  it("updates an existing log's date while preserving the original time", async () => {
    const update = vi.fn().mockResolvedValue(true);
    render(<LogPage {...props} posts={[post]} uploading={false} onCreatePost={vi.fn()} onUpdatePost={update} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    const date = screen.getByLabelText("记录日期") as HTMLInputElement;
    expect(date.value).toBe("2026-10-20");
    fireEvent.change(date, { target: { value: "2026-09-30" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith(post.id, expect.objectContaining({ recordedAt: new Date("2026-09-30T14:35:12.345").toISOString(), content: post.content }));
  });

  it("retains the chosen date after a failed save and prevents an empty date submission", async () => {
    const update = vi.fn().mockResolvedValue(false);
    render(<LogPage {...props} posts={[post]} uploading={false} onCreatePost={vi.fn()} onUpdatePost={update} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    const date = screen.getByLabelText("记录日期") as HTMLInputElement;
    fireEvent.change(date, { target: { value: "" } });
    expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(date, { target: { value: "2026-09-30" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(date.value).toBe("2026-09-30");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("does not submit a date change when the editor is cancelled or the date is unchanged", async () => {
    const update = vi.fn().mockResolvedValue(true);
    render(<LogPage {...props} posts={[post]} uploading={false} onCreatePost={vi.fn()} onUpdatePost={update} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByLabelText("记录日期"), { target: { value: "2026-09-30" } });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][1]).not.toHaveProperty("recordedAt");
  });

  it("groups and filters a moved log on its new local calendar date", () => {
    const moved = { ...post, createdAt: new Date("2026-09-30T14:35:12.345").toISOString() };
    expect(groupLogsByDate([moved])[0].label).toBe("2026年9月30日");
    expect(filterLogPosts([moved], { ...defaultLogFilters, startDate: "2026-09-30", endDate: "2026-09-30" })).toEqual([moved]);
    expect(filterLogPosts([moved], { ...defaultLogFilters, startDate: "2026-10-20", endDate: "2026-10-20" })).toEqual([]);
    expect(sortLogPosts([post, moved]).map((item) => item.createdAt)).toEqual([post.createdAt, moved.createdAt]);
  });

  it("uses the local recorded day for month counts and streaks near midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00"));
    try {
      const moved = { ...post, createdAt: new Date("2026-10-01T00:30:00").toISOString() };
      expect(buildLogStats([moved], [])).toMatchObject({ monthCount: 1, streakDays: 1 });
    } finally { vi.useRealTimers(); }
  });

  it("keeps the same post ID and draft when a partial save fails", async () => {
    const submit = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<LogPage {...props} uploading={false} onCreatePost={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "记录一下今天的生活、科研或心情……" }));
    const field = screen.getByPlaceholderText("写点什么……") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "保留草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1)); expect(field.value).toBe("保留草稿");
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(submit.mock.calls[0][0].requestId).toBe(submit.mock.calls[1][0].requestId);
    await waitFor(() => expect(screen.queryByPlaceholderText("写点什么……")).toBeNull());
  });
  it("freezes editable fields and cancellation until the submitted version is acknowledged", async () => {
    let finish!: (value: boolean) => void;
    const pending = new Promise<boolean>(resolve => { finish = resolve; });
    function Workspace() {
      const [uploading, setUploading] = useState(false);
      return <LogPage {...props} uploading={uploading} onCreatePost={async () => { setUploading(true); const result = await pending; setUploading(false); return result; }} />;
    }
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "记录一下今天的生活、科研或心情……" }));
    const field = screen.getByPlaceholderText("写点什么……") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "正在提交" } });
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));
    expect(field.matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "取消" }).matches(":disabled")).toBe(true);
    await act(async () => finish(false)); expect(field.matches(":disabled")).toBe(false); expect(field.value).toBe("正在提交");
  });
});
