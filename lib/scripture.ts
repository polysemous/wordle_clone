interface BibleApiResponse {
  text?: unknown;
  translation_name?: unknown;
}

export async function webVerseForReference(reference: string): Promise<string> {
  const url = new URL(`https://bible-api.com/${encodeURIComponent(reference)}`);
  url.searchParams.set("translation", "web");
  const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } });
  if (!response.ok) throw new Error("Unable to load the WEB verse.");

  const payload = (await response.json()) as BibleApiResponse;
  if (payload.translation_name !== "World English Bible" || typeof payload.text !== "string") {
    throw new Error("The scripture source did not return WEB text.");
  }
  return payload.text.replace(/\s+/g, " ").trim();
}
