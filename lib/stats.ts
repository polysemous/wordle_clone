import type {
  LeaderboardEntry,
  Play,
  Player,
  PlayerStats,
} from "./types";

const completed = (play: Play) => play.status !== "in-progress";
const won = (play: Play) => play.status === "won";

export function calculateStats(plays: Play[]): PlayerStats {
  const finished = plays.filter(completed);
  const rated = finished.filter((play) => play.counted);
  const wins = finished.filter(won).length;
  const losses = finished.length - wins;
  const scores = rated.map((play) => play.score ?? 6);
  const chronological = [...rated].sort((a, b) =>
    a.puzzleKey.localeCompare(b.puzzleKey),
  );
  let currentStreak = 0;
  let bestStreak = 0;
  let run = 0;
  for (const play of chronological) {
    run = won(play) ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
  }
  currentStreak = run;

  const guessDistribution = Array(6).fill(0);
  for (const play of finished.filter(won)) {
    const score = play.score ?? 6;
    if (score >= 1 && score <= 6) guessDistribution[score - 1] += 1;
  }

  return {
    totalPlays: finished.length,
    countedGames: rated.length,
    practiceGames: finished.filter((play) => !play.counted).length,
    wins,
    losses,
    winRate: finished.length ? Math.round((wins / finished.length) * 100) : 0,
    averageScore: scores.length
      ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100) /
        100
      : null,
    currentStreak,
    bestStreak,
    guessDistribution,
  };
}

export function buildLeaderboard(
  players: Player[],
  plays: Play[],
): { mostSolved: LeaderboardEntry[]; bestAverage: LeaderboardEntry[] } {
  const entries = players.map((player) => {
    const stats = calculateStats(
      plays.filter((play) => play.userId === player.id && play.counted),
    );
    return { playerId: player.id, displayName: player.displayName, ...stats };
  });

  const eligible = entries.filter((entry) => entry.countedGames > 0);
  return {
    mostSolved: [...eligible].sort(
      (a, b) => b.wins - a.wins || (a.averageScore ?? 6) - (b.averageScore ?? 6),
    ),
    bestAverage: [...eligible].sort(
      (a, b) =>
        (a.averageScore ?? 6) - (b.averageScore ?? 6) || b.wins - a.wins,
    ),
  };
}
