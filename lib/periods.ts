import type { LeaderboardPeriod } from "./types";
import { dateKey, TIME_ZONE } from "./puzzle";

function parts(date: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  return Object.fromEntries(values.map(({ type, value }) => [type, value]));
}

export function periodStart(
  period: LeaderboardPeriod,
  now = new Date(),
  timeZone = TIME_ZONE,
): string | null {
  if (period === "all") return null;
  const current = dateKey(now, timeZone);
  if (period === "today") return current;
  const { year, month, weekday } = parts(now, timeZone);
  if (period === "year") return `${year}-01-01`;
  if (period === "month") return `${year}-${month.padStart(2, "0")}-01`;

  const dayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
    weekday,
  );
  const noonUtc = Date.parse(`${current}T12:00:00Z`);
  return new Date(noonUtc - Math.max(dayIndex, 0) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
