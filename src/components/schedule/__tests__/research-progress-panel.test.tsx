import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResearchProgressPanel } from "../research-progress-panel";

describe("ResearchProgressPanel", () => {
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
