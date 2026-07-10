import { NextResponse } from "next/server";
import { authenticate, AuthenticationError } from "./auth";
import { getStore } from "./store";

export async function requestContext(request: Request) {
  const identity = await authenticate(request.headers);
  const store = getStore();
  const player = await store.getOrCreatePlayer(identity);
  return { identity, store, player };
}

export function apiError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
