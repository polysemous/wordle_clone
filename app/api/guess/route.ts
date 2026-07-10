import { NextResponse } from "next/server";
import { apiError, requestContext } from "@/lib/api";
import {
  dateKey,
  evaluateGuess,
  isAllowedGuess,
  MAX_GUESSES,
  normalizeGuess,
  puzzleForDate,
} from "@/lib/puzzle";
import type { GameSnapshot, PlayMode } from "@/lib/types";

interface GuessBody {
  playId?: string;
  guess?: string;
  mode?: PlayMode;
  puzzleKey?: string;
}

export async function POST(request: Request) {
  try {
    const { store, player } = await requestContext(request);
    const body = (await request.json()) as GuessBody;
    const guess = normalizeGuess(body.guess ?? "");
    if (!isAllowedGuess(guess)) {
      return NextResponse.json(
        { error: "Enter a recognized five-letter word." },
        { status: 400 },
      );
    }

    let play = body.playId ? await store.getPlay(body.playId) : null;
    if (body.playId && (!play || play.userId !== player.id)) {
      return NextResponse.json({ error: "Game not found." }, { status: 404 });
    }
    if (play && play.status !== "in-progress") {
      return NextResponse.json({ error: "That game is already complete." }, { status: 409 });
    }

    if (!play) {
      const mode = body.mode ?? "daily";
      const puzzleKey = body.puzzleKey ?? dateKey();
      if ((mode === "daily" || mode === "daily-replay") && puzzleKey !== dateKey()) {
        return NextResponse.json({ error: "The daily puzzle date is invalid." }, { status: 400 });
      }
      if (mode === "archive" && puzzleKey >= dateKey()) {
        return NextResponse.json({ error: "Choose a previous puzzle." }, { status: 400 });
      }
      play = await store.startPlay(player, puzzleKey, mode);
    }

    const puzzle = puzzleForDate(play.puzzleKey);
    const evaluation = evaluateGuess(guess, puzzle.word);
    const evaluations = [...play.evaluations, evaluation];
    const solved = guess === puzzle.word;
    const exhausted = evaluations.length >= MAX_GUESSES;
    const status = solved ? "won" : exhausted ? "lost" : "in-progress";
    play = {
      ...play,
      guesses: [...play.guesses, guess],
      evaluations,
      status,
      score: status === "in-progress" ? null : solved ? evaluations.length : MAX_GUESSES,
      completedAt: status === "in-progress" ? null : new Date().toISOString(),
    };
    await store.savePlay(play);

    const snapshot: GameSnapshot = {
      playId: play.id,
      puzzleKey: play.puzzleKey,
      mode: play.mode,
      counted: play.counted,
      status: play.status,
      evaluations: play.evaluations,
      score: play.score,
      ...(status !== "in-progress"
        ? { solution: puzzle.word, reference: puzzle.reference }
        : {}),
    };
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
