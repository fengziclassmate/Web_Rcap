import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { WeekColumnPicker } from "../week-column-picker";

const dates = Array.from({ length: 7 }, (_, day) => new Date(2026, 10, 9 + day));
function Picker({ initial = [1, 2, 3, 4, 5, 6, 0] }: { initial?: number[] }) {
  const [days, setDays] = useState(initial);
  return <><WeekColumnPicker dates={dates} visibleWeekdays={days} today="2026-11-13" onChange={setDays} /><output aria-label="选中星期">{days.join(",")}</output></>;
}

describe("week column picker", () => {
  it("selects arbitrary days, keeps at least one, and restores every day", async () => {
    render(<Picker initial={[5]} />);
    fireEvent.click(screen.getByRole("button", { name: "选择显示日期列" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /周五/ }));
    expect(screen.getByLabelText("选中星期").textContent).toBe("5");
    fireEvent.click(screen.getByRole("checkbox", { name: /周日/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /周五/ }));
    expect(screen.getByLabelText("选中星期").textContent).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "显示全部" }));
    expect(screen.getByLabelText("选中星期").textContent).toBe("1,2,3,4,5,6,0");
  });

  it("can hide the earlier weekdays together while keeping today and the weekend", async () => {
    render(<Picker />);
    fireEvent.click(screen.getByRole("button", { name: "选择显示日期列" }));
    fireEvent.click(await screen.findByRole("button", { name: "只看今天及之后" }));
    expect(screen.getByLabelText("选中星期").textContent).toBe("5,6,0");
  });
});
