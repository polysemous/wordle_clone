import { NextResponse } from "next/server";
import { apiError, requestContext } from "@/lib/api";
import { dateKey } from "@/lib/puzzle";
import { calculateStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { store, player } = await requestContext(request);
    await store.abandonOpenPlays(player.id);
    const plays = await store.listPlays(player.id);
    const today = dateKey();
    const countedToday = plays.find(
      (play) => play.puzzleKey === today && play.counted,
    );
    const history = plays
      .filter((play) => play.status !== "in-progress")
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    return NextResponse.json({
      player,
      today,
      countedAvailable: !countedToday,
      countedToday: countedToday ?? null,
      stats: calculateStats(plays),
      history,
    });
  } catch (error) {
    return apiError(error);
  }
}
