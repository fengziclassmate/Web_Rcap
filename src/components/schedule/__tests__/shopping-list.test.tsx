import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShoppingList } from "../shopping-list";

describe("ShoppingList", () => {
  it("shows when an item was added and lets the user mark it complete", () => {
    const onToggleItem = vi.fn();

    render(
      <ShoppingList
        items={[
          {
            id: "shopping-1",
            name: "实验室插线板",
            addedAt: "2026-08-03T09:30:00+08:00",
            done: false,
          },
        ]}
        open
        onOpenChange={vi.fn()}
        onAddItem={vi.fn()}
        onToggleItem={onToggleItem}
        onDeleteItem={vi.fn()}
        onReorderItem={vi.fn()}
      />,
    );

    expect(screen.getByText("实验室插线板")).toBeTruthy();
    expect(screen.getByText("加入于 2026-08-03 09:30")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "实验室插线板 完成状态" }));
    expect(onToggleItem).toHaveBeenCalledWith("shopping-1");
  });

  it("adds a trimmed item from the title-row action", () => {
    const onAddItem = vi.fn();

    render(
      <ShoppingList
        items={[]}
        open
        onOpenChange={vi.fn()}
        onAddItem={onAddItem}
        onToggleItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onReorderItem={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加购物项" }));
    fireEvent.change(screen.getByRole("textbox", { name: "购物项名称" }), {
      target: { value: "  差旅转换插头  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "加入购物清单" }));

    expect(onAddItem).toHaveBeenCalledWith("差旅转换插头");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps pending items above completed items and lets pending items be reordered", () => {
    const onReorderItem = vi.fn();

    render(
      <ShoppingList
        items={[
          {
            id: "done",
            name: "已买咖啡豆",
            addedAt: "2026-09-08T09:00:00+08:00",
            done: true,
          },
          {
            id: "first",
            name: "实验记录本",
            addedAt: "2026-09-08T10:00:00+08:00",
            done: false,
          },
          {
            id: "second",
            name: "打印纸",
            addedAt: "2026-09-08T11:00:00+08:00",
            done: false,
          },
        ]}
        open
        onOpenChange={vi.fn()}
        onAddItem={vi.fn()}
        onToggleItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onReorderItem={onReorderItem}
      />,
    );

    expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      expect.stringContaining("实验记录本"),
      expect.stringContaining("打印纸"),
      expect.stringContaining("已买咖啡豆"),
    ]);

    fireEvent.dragStart(screen.getByRole("button", { name: /移动购物项 打印纸/ }), {
      dataTransfer: {
        effectAllowed: "none",
        setData: vi.fn(),
      },
    });
    fireEvent.dragOver(screen.getByText("实验记录本").closest("li")!);
    fireEvent.drop(screen.getByText("实验记录本").closest("li")!);

    expect(onReorderItem).toHaveBeenCalledWith("second", "first");

    fireEvent.keyDown(screen.getByRole("button", { name: /移动购物项 实验记录本/ }), {
      key: "ArrowDown",
    });
    expect(onReorderItem).toHaveBeenNthCalledWith(2, "first", "second");
    expect(screen.getByRole("status").textContent).toContain("实验记录本已移至当前分组第 2 项");
  });
});
