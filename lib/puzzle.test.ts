import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateGuess, isAllowedGuess, puzzleForDate } from "./puzzle";

const originalOverride = process.env.PUZZLE_TODAY_OVERRIDE;
const originalOverrideDate = process.env.PUZZLE_TODAY_OVERRIDE_DATE;

afterEach(() => {
  vi.useRealTimers();
  if (originalOverride === undefined) delete process.env.PUZZLE_TODAY_OVERRIDE;
  else process.env.PUZZLE_TODAY_OVERRIDE = originalOverride;
  if (originalOverrideDate === undefined) delete process.env.PUZZLE_TODAY_OVERRIDE_DATE;
  else process.env.PUZZLE_TODAY_OVERRIDE_DATE = originalOverrideDate;
});

describe("evaluateGuess", () => {
  it("handles duplicate letters without over-crediting", () => {
    expect(evaluateGuess("eagle", "grace").states).toEqual([
      "absent",
      "present",
      "present",
      "absent",
      "correct",
    ]);
  });

  it("marks a solved word", () => {
    expect(evaluateGuess("david", "david").states).toEqual(
      Array(5).fill("correct"),
    );
  });
});

describe("puzzleForDate", () => {
  it("is stable for a date", () => {
    expect(puzzleForDate("2026-07-09")).toEqual(puzzleForDate("2026-07-09"));
  });

  it("only applies a temporary override on its configured Eastern day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T16:00:00.000Z"));
    const tomorrow = puzzleForDate("2026-07-16");
    process.env.PUZZLE_TODAY_OVERRIDE = "field";
    process.env.PUZZLE_TODAY_OVERRIDE_DATE = "2026-07-15";

    expect(puzzleForDate("2026-07-15").word).toBe("field");
    expect(puzzleForDate("2026-07-16")).toEqual(tomorrow);
  });
});

describe("isAllowedGuess", () => {
  it("accepts five-letter words from the expanded English dictionary", () => {
    expect(isAllowedGuess("zebra")).toBe(true);
    expect(isAllowedGuess("xylem")).toBe(true);
    expect(isAllowedGuess("zzzzz")).toBe(false);
  });
});
