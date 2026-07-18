import { describe, expect, it } from "vitest";
import { dailyShareText } from "./share";

describe("dailyShareText", () => {
  it("creates a spoiler-free challenge message", () => {
    expect(dailyShareText("KC", 3)).toBe(
      "KC solved today’s Daily Word in 3/6 moves! See if you can do better!",
    );
  });

  it("uses singular wording for a one-move solve", () => {
    expect(dailyShareText("KC", 1)).toContain("1/6 move!");
  });
});
