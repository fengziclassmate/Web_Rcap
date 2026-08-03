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
});
