import { createHash } from "node:crypto";
import { ALLOWED_GUESSES, SOLUTION_WORDS } from "./words";
import type { Evaluation, LetterState, PuzzleWord } from "./types";

export const MAX_GUESSES = 6;
export const WORD_LENGTH = 5;
export const TIME_ZONE = process.env.PUZZLE_TIME_ZONE ?? "America/New_York";
const EPOCH = process.env.PUZZLE_EPOCH ?? "2026-01-01";
const SEED = process.env.PUZZLE_SEED ?? "local-development-seed";

export function dateKey(date = new Date(), timeZone = TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function daysBetween(start: string, end: string): number {
  const startMs = Date.parse(`${start}T12:00:00Z`);
  const endMs = Date.parse(`${end}T12:00:00Z`);
  return Math.floor((endMs - startMs) / 86_400_000);
}

function seededOrder(cycle: number): PuzzleWord[] {
  return [...SOLUTION_WORDS]
    .map((entry) => ({
      entry,
      rank: createHash("sha256")
        .update(`${SEED}:${cycle}:${entry.word}`)
        .digest("hex"),
    }))
    .sort((a, b) => a.rank.localeCompare(b.rank))
    .map(({ entry }) => entry);
}

export function puzzleForDate(puzzleKey: string): PuzzleWord {
  const override = process.env.PUZZLE_TODAY_OVERRIDE?.toLowerCase();
  const overrideDate = process.env.PUZZLE_TODAY_OVERRIDE_DATE;
  if (puzzleKey === dateKey() && overrideDate === puzzleKey && override) {
    const overridePuzzle = SOLUTION_WORDS.find(({ word }) => word === override);
    if (!overridePuzzle) throw new Error("PUZZLE_TODAY_OVERRIDE must be a configured solution word.");
    return overridePuzzle;
  }
  const offset = Math.max(0, daysBetween(EPOCH, puzzleKey));
  const cycle = Math.floor(offset / SOLUTION_WORDS.length);
  const index = offset % SOLUTION_WORDS.length;
  return seededOrder(cycle)[index];
}

export function randomPreviousPuzzle(today = dateKey()): string {
  const availableDays = Math.max(1, daysBetween(EPOCH, today));
  const randomOffset = Math.floor(Math.random() * availableDays);
  const base = Date.parse(`${today}T12:00:00Z`);
  return new Date(base - (randomOffset + 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function normalizeGuess(value: string): string {
  return value.trim().toLowerCase();
}

export function isAllowedGuess(guess: string): boolean {
  return /^[a-z]{5}$/.test(guess) && ALLOWED_GUESSES.has(guess);
}

export function evaluateGuess(guess: string, solution: string): Evaluation {
  const states: LetterState[] = Array(WORD_LENGTH).fill("absent");
  const remaining = solution.split("");

  for (let index = 0; index < WORD_LENGTH; index += 1) {
    if (guess[index] === solution[index]) {
      states[index] = "correct";
      remaining[index] = "";
    }
  }

  for (let index = 0; index < WORD_LENGTH; index += 1) {
    if (states[index] === "correct") continue;
    const match = remaining.indexOf(guess[index]);
    if (match >= 0) {
      states[index] = "present";
      remaining[match] = "";
    }
  }

  return { guess, states };
}
