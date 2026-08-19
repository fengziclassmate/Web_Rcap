import { describe, expect, it } from "vitest";
import { toLocalISODate } from "../date-utils";

describe("date utilities", () => {
  it("uses the local calendar date instead of converting through UTC", () => {
    expect(toLocalISODate(new Date(2026, 7, 20, 0, 30))).toBe("2026-08-20");
  });
});
