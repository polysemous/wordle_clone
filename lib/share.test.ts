import { describe, expect, it } from "vitest";
import { dailyShareText, iPhoneMessageUrl } from "./share";

describe("dailyShareText", () => {
  it("creates a spoiler-free challenge message", () => {
    expect(dailyShareText("KC", 3)).toBe(
      "KC solved today’s Daily Word in 3/6 moves! See if you can do better!",
    );
  });

  it("uses singular wording for a one-move solve", () => {
    expect(dailyShareText("KC", 1)).toContain("1/6 move!");
  });

  it("prefills an iPhone Messages composer with the result and game link", () => {
    expect(iPhoneMessageUrl("KC", 3, "https://wordle.madsen7.com")).toBe(
      "sms:&body=KC%20solved%20today%E2%80%99s%20Daily%20Word%20in%203%2F6%20moves!%20See%20if%20you%20can%20do%20better!%0Ahttps%3A%2F%2Fwordle.madsen7.com",
    );
  });
});
