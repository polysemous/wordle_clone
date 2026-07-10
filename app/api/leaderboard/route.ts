import { NextResponse } from "next/server";
import { apiError, requestContext } from "@/lib/api";
import { periodStart } from "@/lib/periods";
import { buildLeaderboard } from "@/lib/stats";
import type { LeaderboardPeriod } from "@/lib/types";

const PERIODS = new Set(["today", "week", "month", "year", "all"]);

export async function GET(request: Request) {
  try {
    const { store } = await requestContext(request);
    const requested = new URL(request.url).searchParams.get("period") ?? "all";
    const period = (PERIODS.has(requested) ? requested : "all") as LeaderboardPeriod;
    const start = periodStart(period);
    const [players, allPlays] = await Promise.all([
      store.listPlayers(),
      store.listPlays(),
    ]);
    const plays = allPlays.filter(
      (play) => play.counted && (!start || play.puzzleKey >= start),
    );
    return NextResponse.json({ period, ...buildLeaderboard(players, plays) });
  } catch (error) {
    return apiError(error);
  }
}
