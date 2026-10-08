import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LogPage } from "../log-page";
const props = { posts: [], tags: [], onUpdatePost: async () => true, onDeletePost: async () => {}, onTogglePinned: async () => {}, onToggleArchived: async () => {} };
describe("log submission state", () => {
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
