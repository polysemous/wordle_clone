export type LetterState = "correct" | "present" | "absent";
export type PlayMode = "daily" | "daily-replay" | "archive";
export type PlayStatus = "in-progress" | "won" | "lost" | "abandoned";
export type LeaderboardPeriod = "today" | "week" | "month" | "year" | "all";

export interface Player {
  id: string;
  displayName: string;
  joinedAt: string;
}

export interface Evaluation {
  guess: string;
  states: LetterState[];
}

export interface Play {
  id: string;
  userId: string;
  userName: string;
  puzzleKey: string;
  mode: PlayMode;
  counted: boolean;
  status: PlayStatus;
  guesses: string[];
  evaluations: Evaluation[];
  score: number | null;
  startedAt: string;
  completedAt: string | null;
}

export interface PuzzleWord {
  word: string;
  reference: string;
}

export interface PlayerStats {
  totalPlays: number;
  countedGames: number;
  practiceGames: number;
  wins: number;
  losses: number;
  winRate: number;
  averageScore: number | null;
  currentStreak: number;
  bestStreak: number;
  guessDistribution: number[];
}

export interface PlayerProfile extends Player {
  stats: PlayerStats;
  history: Play[];
}

export interface LeaderboardEntry extends PlayerStats {
  playerId: string;
  displayName: string;
}

export interface GameSnapshot {
  playId: string;
  puzzleKey: string;
  mode: PlayMode;
  counted: boolean;
  status: PlayStatus;
  evaluations: Evaluation[];
  score: number | null;
  solution?: string;
  reference?: string;
}
