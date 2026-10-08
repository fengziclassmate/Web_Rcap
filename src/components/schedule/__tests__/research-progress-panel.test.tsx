import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchProgressPanel } from "../research-progress-panel";
import type { LogPostRecord } from "@/lib/logs";
import { researchStorageKey } from "@/lib/research-progress-storage";

describe("ResearchProgressPanel", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("preserves another tab's drafts when switching dates and synchronizes external changes", () => {
    render(<ResearchProgressPanel userId="alice" date="2026-09-05" posts={[]} onCreatePost={vi.fn()} onOpenLogs={vi.fn()} />);
    const external = { drafts: { "2026-09-05": { completed: "另一页的草稿", insight: "", nextPlan: "" } }, restDays: ["2026-09-03"], selectedDate: "2026-09-05" };
    localStorage.setItem(researchStorageKey("alice"), JSON.stringify(external));
    fireEvent.click(screen.getByRole("button", { name: "昨天" }));
    const stored = JSON.parse(localStorage.getItem(researchStorageKey("alice"))!);
    expect(stored.drafts["2026-09-05"].completed).toBe("另一页的草稿");
    expect(stored.restDays).toEqual(["2026-09-03"]);
    fireEvent.click(screen.getByRole("button", { name: "今天" }));
    expect((screen.getByLabelText("今日完成") as HTMLTextAreaElement).value).toBe("另一页的草稿");
    external.drafts["2026-09-05"].completed = "外部更新";
    localStorage.setItem(researchStorageKey("alice"), JSON.stringify(external));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: researchStorageKey("alice"), newValue: JSON.stringify(external), storageArea: localStorage })));
    expect((screen.getByLabelText("今日完成") as HTMLTextAreaElement).value).toBe("外部更新");
  });

  it("does not clear a newer draft from another tab when an earlier submission finishes", async () => {
    let finish!: (saved: boolean) => void;
    const onCreatePost = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    render(<ResearchProgressPanel userId="alice" date="2026-09-05" posts={[]} onCreatePost={onCreatePost} onOpenLogs={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("今日完成"), { target: { value: "已提交版本" } });
    fireEvent.click(screen.getByRole("button", { name: "保存科研日志" }));
    const external = JSON.parse(localStorage.getItem(researchStorageKey("alice"))!);
    external.drafts["2026-09-05"].completed = "提交后在另一页继续写作";
    localStorage.setItem(researchStorageKey("alice"), JSON.stringify(external));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: researchStorageKey("alice"), newValue: JSON.stringify(external), storageArea: localStorage })));
    await act(async () => finish(true));
    expect((screen.getByLabelText("今日完成") as HTMLTextAreaElement).value).toBe("提交后在另一页继续写作");
    expect(JSON.parse(localStorage.getItem(researchStorageKey("alice"))!).drafts["2026-09-05"].completed).toBe("提交后在另一页继续写作");
  });

  it("restores per-date drafts after remount and only clears the submitted draft", async () => {
    const props = { userId: "alice", date: "2026-09-05", posts: [], onCreatePost: vi.fn(async () => true), onOpenLogs: vi.fn() };
    const first = render(<ResearchProgressPanel {...props} />);
    fireEvent.change(screen.getByLabelText("今日完成"), { target: { value: "今天未完成" } });
    fireEvent.click(screen.getByRole("button", { name: "昨天" }));
    fireEvent.change(screen.getByLabelText("次日计划"), { target: { value: "昨天未完成" } });
    expect(screen.getByText("草稿已自动保存到本机")).toBeTruthy();
    first.unmount();

    const second = render(<ResearchProgressPanel {...props} />);
    expect((screen.getByLabelText("科研日志日期") as HTMLInputElement).value).toBe("2026-09-04");
    expect((screen.getByLabelText("次日计划") as HTMLTextAreaElement).value).toBe("昨天未完成");
    fireEvent.click(screen.getByRole("button", { name: "保存科研日志" }));
    await waitFor(() => expect((screen.getByLabelText("次日计划") as HTMLTextAreaElement).value).toBe(""));
    second.unmount();

    render(<ResearchProgressPanel {...props} />);
    expect((screen.getByLabelText("次日计划") as HTMLTextAreaElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "今天" }));
    expect((screen.getByLabelText("今日完成") as HTMLTextAreaElement).value).toBe("今天未完成");
  });

  it("isolates drafts and rest days when switching accounts", () => {
    const props = { date: "2026-09-05", posts: [], onCreatePost: vi.fn(), onOpenLogs: vi.fn() };
    const { rerender } = render(<ResearchProgressPanel {...props} userId="alice" />);
    fireEvent.change(screen.getByLabelText("今日完成"), { target: { value: "Alice 的草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "昨天" }));
    fireEvent.click(screen.getByRole("button", { name: "标记休息日" }));
    rerender(<ResearchProgressPanel {...props} userId="bob" />);
    expect((screen.getByLabelText("今日完成") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByRole("button", { name: "2026-09-04 待补记" })).toBeTruthy();
    rerender(<ResearchProgressPanel {...props} userId="alice" />);
    expect(screen.getByRole("button", { name: "2026-09-04 休息日" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "今天" }));
    expect((screen.getByLabelText("今日完成") as HTMLTextAreaElement).value).toBe("Alice 的草稿");
  });

  it("excludes today and rest days from reminders and keeps rest markers after reopening", () => {
    const props = { userId: "alice", date: "2026-09-05", posts: [], onCreatePost: vi.fn(), onOpenLogs: vi.fn() };
    const { unmount } = render(<ResearchProgressPanel {...props} />);
    expect(screen.getByText("6 天待补记")).toBeTruthy();
    expect(screen.getByRole("button", { name: "2026-09-05 待记录" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "2026-08-30 待补记" }));
    expect((screen.getByLabelText("科研日志日期") as HTMLInputElement).value).toBe("2026-08-30");
    fireEvent.click(screen.getByRole("button", { name: "标记休息日" }));
    expect(screen.getByText("5 天待补记")).toBeTruthy();
    unmount();
    render(<ResearchProgressPanel {...props} />);
    expect(screen.getByRole("button", { name: "2026-08-30 休息日" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "取消休息日" }));
    expect(screen.getByText("6 天待补记")).toBeTruthy();
  });

  it("does not claim missing records before history is available", () => {
    render(<ResearchProgressPanel date="2026-09-05" posts={[]} logsReady={false} onCreatePost={vi.fn()} onOpenLogs={vi.fn()} />);
    expect(screen.getByText("记录状态暂不可用")).toBeTruthy();
    expect(screen.queryByText("6 天待补记")).toBeNull();
  });

  it("handles corrupt storage and reports write failures without losing current text", () => {
    localStorage.setItem(researchStorageKey("alice"), "{broken");
    render(<ResearchProgressPanel userId="alice" date="2026-09-05" posts={[]} onCreatePost={vi.fn()} onOpenLogs={vi.fn()} />);
    expect(screen.getByText("本地保存失败，离开前请保存日志")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("今日完成"), { target: { value: "恢复写作" } });
    expect(screen.getByText("草稿已自动保存到本机")).toBeTruthy();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    fireEvent.change(screen.getByLabelText("今日完成"), { target: { value: "仍可继续写作" } });
    expect((screen.getByLabelText("今日完成") as HTMLTextAreaElement).value).toBe("仍可继续写作");
    expect(screen.getByText("本地保存失败，离开前请保存日志")).toBeTruthy();
    expect(screen.queryByText("草稿已自动保存到本机")).toBeNull();
    vi.restoreAllMocks();
    const external = JSON.parse(localStorage.getItem(researchStorageKey("alice"))!);
    external.drafts["2026-09-05"].nextPlan = "另一页的计划";
    localStorage.setItem(researchStorageKey("alice"), JSON.stringify(external));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: researchStorageKey("alice"), newValue: JSON.stringify(external), storageArea: localStorage })));
    expect((screen.getByLabelText("今日完成") as HTMLTextAreaElement).value).toBe("仍可继续写作");
    fireEvent.change(screen.getByLabelText("关键进展或卡点"), { target: { value: "存储恢复后补充" } });
    expect((screen.getByLabelText("今日完成") as HTMLTextAreaElement).value).toBe("仍可继续写作");
    const restored = JSON.parse(localStorage.getItem(researchStorageKey("alice"))!);
    expect(restored.drafts["2026-09-05"]).toEqual({ completed: "仍可继续写作", insight: "存储恢复后补充", nextPlan: "另一页的计划" });
    expect(screen.getByText("草稿已自动保存到本机")).toBeTruthy();
  });

  it("backfills a chosen date and preserves drafts for other dates", async () => {
    const onCreatePost = vi.fn(async () => true);
    render(<ResearchProgressPanel date="2026-09-05" posts={[]} onCreatePost={onCreatePost} onOpenLogs={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("今日完成"), { target: { value: "今天的草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "昨天" }));
    expect((screen.getByLabelText("科研日志日期") as HTMLInputElement).value).toBe("2026-09-04");
    fireEvent.change(screen.getByLabelText("当日完成"), { target: { value: "昨天的草稿" } });
    fireEvent.change(screen.getByLabelText("科研日志日期"), { target: { value: "2026-08-31" } });
    expect((screen.getByLabelText("当日完成") as HTMLTextAreaElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("当日完成"), { target: { value: "补记上个月的实验" } });
    fireEvent.click(screen.getByRole("button", { name: "保存科研日志" }));

    await waitFor(() => expect(onCreatePost).toHaveBeenCalledWith(expect.objectContaining({
      recordDate: "2026-08-31", content: "今日完成：\n补记上个月的实验", category: "research",
    })));
    expect((screen.getByLabelText("科研日志日期") as HTMLInputElement).value).toBe("2026-08-31");
    expect((screen.getByLabelText("当日完成") as HTMLTextAreaElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "昨天" }));
    expect((screen.getByLabelText("当日完成") as HTMLTextAreaElement).value).toBe("昨天的草稿");
    fireEvent.click(screen.getByRole("button", { name: "今天" }));
    expect((screen.getByLabelText("今日完成") as HTMLTextAreaElement).value).toBe("今天的草稿");
  });

  it("counts research entries for the selected date and rejects future dates", () => {
    const post: LogPostRecord = {
      id: "research", userId: "user", content: "实验", category: "research", mood: null,
      location: "", visibility: "private", isPinned: false, isArchived: false,
      sourceType: "manual", sourceId: null, createdAt: "2026-09-04T12:00:00",
      updatedAt: "2026-09-04T12:00:00", images: [], tags: [], links: [],
    };
    render(<ResearchProgressPanel date="2026-09-05" posts={[post, { ...post, id: "life", category: "life" }]} onCreatePost={vi.fn()} onOpenLogs={vi.fn()} />);
    expect(screen.getByText("今日 0 条")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "昨天" }));
    expect(screen.getByText("当日 1 条")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("科研日志日期"), { target: { value: "2026-09-06" } });
    expect((screen.getByLabelText("科研日志日期") as HTMLInputElement).value).toBe("2026-09-04");
  });

  it("retains a historical draft after a rejected save and allows retry", async () => {
    const onCreatePost = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
    render(<ResearchProgressPanel date="2026-09-05" posts={[]} onCreatePost={onCreatePost} onOpenLogs={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "昨天" }));
    fireEvent.change(screen.getByLabelText("次日计划"), { target: { value: "补记计划" } });
    fireEvent.click(screen.getByRole("button", { name: "保存科研日志" }));
    expect((screen.getByLabelText("科研日志日期") as HTMLInputElement).disabled).toBe(true);
    await waitFor(() => expect(screen.getByRole("button", { name: "保存科研日志" })).toBeTruthy());
    expect((screen.getByLabelText("次日计划") as HTMLTextAreaElement).value).toBe("补记计划");
    fireEvent.click(screen.getByRole("button", { name: "保存科研日志" }));
    await waitFor(() => expect((screen.getByLabelText("次日计划") as HTMLTextAreaElement).value).toBe(""));
    expect(onCreatePost).toHaveBeenLastCalledWith(expect.objectContaining({ recordDate: "2026-09-04" }));
  });

  it("saves structured research progress into the weekly log source", async () => {
    const onCreatePost = vi.fn(async () => true);
    render(
      <ResearchProgressPanel
        date="2026-09-05"
        posts={[]}
        onCreatePost={onCreatePost}
        onOpenLogs={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("今日完成"), {
      target: { value: "完成第一轮实验并整理图表。" },
    });
    fireEvent.change(screen.getByLabelText("关键进展或卡点"), {
      target: { value: "基线波动仍需排查。" },
    });
    fireEvent.change(screen.getByLabelText("明日计划"), {
      target: { value: "固定随机种子后复跑。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存科研日志" }));

    await waitFor(() => {
      expect(onCreatePost).toHaveBeenCalledWith({
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        content:
          "今日完成：\n完成第一轮实验并整理图表。\n\n关键进展 / 卡点：\n基线波动仍需排查。\n\n明日计划：\n固定随机种子后复跑。",
        category: "research",
        mood: "",
        recordDate: "2026-09-05",
        location: "",
        tagNames: ["每日记录", "科研日志"],
        images: [],
        links: [],
      });
    });
    expect((screen.getByLabelText("今日完成") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByLabelText("关键进展或卡点") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByLabelText("明日计划") as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps an unfinished draft bound to the date when writing started", async () => {
    const onCreatePost = vi.fn(async () => true);
    const props = {
      posts: [],
      onCreatePost,
      onOpenLogs: vi.fn(),
    };
    const { rerender } = render(
      <ResearchProgressPanel date="2026-09-05" {...props} />,
    );

    fireEvent.change(screen.getByLabelText("今日完成"), {
      target: { value: "午夜前写下的进展" },
    });
    rerender(<ResearchProgressPanel date="2026-09-06" {...props} />);

    expect(screen.getByText("草稿 09/05")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "保存科研日志" }));

    await waitFor(() => {
      expect(onCreatePost).toHaveBeenCalledWith(
        expect.objectContaining({ recordDate: "2026-09-05" }),
      );
    });
  });

  it("keeps the draft when saving is unsuccessful", async () => {
    render(
      <ResearchProgressPanel
        date="2026-09-05"
        posts={[]}
        onCreatePost={vi.fn(async () => false)}
        onOpenLogs={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("明日计划"), {
      target: { value: "保留这份计划" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存科研日志" }));

    await waitFor(() => {
      expect((screen.getByLabelText("明日计划") as HTMLTextAreaElement).value).toBe("保留这份计划");
      expect(screen.getByRole("button", { name: "保存科研日志" })).toBeTruthy();
    });
  });
});
