import { NextResponse } from "next/server";
import { apiError, requestContext } from "@/lib/api";

export async function PATCH(request: Request) {
  try {
    const { store, player } = await requestContext(request);
    const { displayName } = (await request.json()) as { displayName?: string };
    const name = displayName?.trim();
    if (!name || name.length < 2 || name.length > 30) {
      return NextResponse.json(
        { error: "Display names must be 2–30 characters." },
        { status: 400 },
      );
    }
    const updated = await store.updatePlayer(player.id, name);
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
