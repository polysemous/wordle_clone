import { NextResponse } from "next/server";
import { apiError, requestContext } from "@/lib/api";
import { randomPreviousPuzzle } from "@/lib/puzzle";

export async function GET(request: Request) {
  try {
    await requestContext(request);
    return NextResponse.json({ puzzleKey: randomPreviousPuzzle() });
  } catch (error) {
    return apiError(error);
  }
}
