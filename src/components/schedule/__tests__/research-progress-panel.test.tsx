import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResearchProgressPanel } from "../research-progress-panel";
import type { LogPostRecord } from "@/lib/logs";

describe("ResearchProgressPanel", () => {
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
