import { afterEach, describe, expect, it, vi } from "vitest";
import { webVerseForReference } from "./scripture";

afterEach(() => vi.unstubAllGlobals());

describe("webVerseForReference", () => {
  it("returns a cleaned WEB verse from the scripture source", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        translation_name: "World English Bible",
        text: "A complete verse.\n",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(webVerseForReference("John 3:16")).resolves.toBe("A complete verse.");
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain("translation=web");
  });
});
