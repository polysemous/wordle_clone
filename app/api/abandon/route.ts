import { NextResponse } from "next/server";
import { apiError, requestContext } from "@/lib/api";
import { MAX_GUESSES } from "@/lib/puzzle";

export async function POST(request: Request) {
  try {
    const { store, player } = await requestContext(request);
    const { playId } = (await request.json()) as { playId?: string };
    if (!playId) return NextResponse.json({ ok: true });
    const play = await store.getPlay(playId);
    if (play?.userId === player.id && play.status === "in-progress") {
      await store.savePlay({
        ...play,
        status: "abandoned",
        score: MAX_GUESSES,
        completedAt: new Date().toISOString(),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
