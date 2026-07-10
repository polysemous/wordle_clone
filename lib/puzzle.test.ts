import { describe, expect, it } from "vitest";
import { evaluateGuess, puzzleForDate } from "./puzzle";

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
});
