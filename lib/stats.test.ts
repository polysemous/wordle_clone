import { describe, expect, it } from "vitest";
import { calculateStats } from "./stats";
import type { Play } from "./types";

const play = (overrides: Partial<Play>): Play => ({
  id: crypto.randomUUID(),
  userId: "one",
  userName: "Player",
  puzzleKey: "2026-07-01",
  mode: "daily",
  counted: true,
  status: "won",
  guesses: ["faith"],
  evaluations: [],
  score: 1,
  startedAt: "2026-07-01T12:00:00.000Z",
  completedAt: "2026-07-01T12:01:00.000Z",
  ...overrides,
});

describe("calculateStats", () => {
  it("counts abandoned games as six in the rated average", () => {
    const stats = calculateStats([
      play({ score: 2 }),
      play({ puzzleKey: "2026-07-02", status: "abandoned", score: 6 }),
      play({ puzzleKey: "2026-07-03", counted: false, score: 1 }),
    ]);
    expect(stats.averageScore).toBe(4);
    expect(stats.countedGames).toBe(2);
    expect(stats.practiceGames).toBe(1);
  });
});
