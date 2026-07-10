import { NextResponse } from "next/server";
import { apiError, requestContext } from "@/lib/api";
import { calculateStats } from "@/lib/stats";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { store } = await requestContext(request);
    const { id } = await context.params;
    const [players, plays] = await Promise.all([
      store.listPlayers(),
      store.listPlays(id),
    ]);
    const player = players.find((candidate) => candidate.id === id);
    if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    return NextResponse.json({
      ...player,
      stats: calculateStats(plays),
      history: plays
        .filter((play) => play.status !== "in-progress")
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    });
  } catch (error) {
    return apiError(error);
  }
}
