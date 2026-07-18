"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Evaluation,
  GameSnapshot,
  LeaderboardEntry,
  LeaderboardPeriod,
  LetterState,
  Play,
  Player,
  PlayerProfile,
  PlayerStats,
  PlayMode,
} from "@/lib/types";
import { dailyShareText } from "@/lib/share";

type Tab = "game" | "leaderboard" | "stats";
type BoardKind = "mostSolved" | "bestAverage";

interface Bootstrap {
  player: Player;
  today: string;
  countedAvailable: boolean;
  countedToday: Play | null;
  stats: PlayerStats;
  history: Play[];
}

interface LeaderboardPayload {
  mostSolved: LeaderboardEntry[];
  bestAverage: LeaderboardEntry[];
}

interface SessionChoice {
  mode: PlayMode;
  puzzleKey: string;
}

const KEYS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["enter", "z", "x", "c", "v", "b", "n", "m", "backspace"],
];

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
  all: "All time",
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

export function WordleApp() {
  const [tab, setTab] = useState<Tab>("game");
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [session, setSession] = useState<SessionChoice | null>(null);
  const [game, setGame] = useState<GameSnapshot | null>(null);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [fatalError, setFatalError] = useState("");

  const loadBootstrap = useCallback(async (preserveGame = false) => {
    try {
      const data = await jsonFetch<Bootstrap>("/api/bootstrap", { cache: "no-store" });
      setBootstrap(data);
      if (!preserveGame) {
        setSession(data.countedAvailable ? { mode: "daily", puzzleKey: data.today } : null);
      }
      setFatalError("");
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "Unable to load the game.");
    }
  }, []);

  useEffect(() => {
    // Loading is intentionally triggered once when the client takes over.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (!game || game.status !== "in-progress") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      navigator.sendBeacon(
        "/api/abandon",
        new Blob([JSON.stringify({ playId: game.playId })], { type: "application/json" }),
      );
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [game]);

  const submitGuess = useCallback(async () => {
    if (!session || busy || input.length !== 5 || game?.status === "won" || game?.status === "lost") {
      if (input.length !== 5) setMessage("Your guess needs five letters.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await jsonFetch<GameSnapshot>("/api/guess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playId: game?.playId,
          guess: input,
          mode: session.mode,
          puzzleKey: session.puzzleKey,
        }),
      });
      setGame(result);
      setInput("");
      if (result.status !== "in-progress") void loadBootstrap(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Try that guess again.");
    } finally {
      setBusy(false);
    }
  }, [busy, game, input, loadBootstrap, session]);

  const handleKey = useCallback(
    (key: string) => {
      if (!session || busy || (game && game.status !== "in-progress")) return;
      if (key === "enter") {
        void submitGuess();
      } else if (key === "backspace") {
        setInput((value) => value.slice(0, -1));
      } else if (/^[a-z]$/.test(key)) {
        setInput((value) => (value.length < 5 ? value + key : value));
        setMessage("");
      }
    },
    [busy, game, session, submitGuess],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (/^[a-z]$/.test(key) || key === "enter" || key === "backspace") {
        event.preventDefault();
        handleKey(key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey]);

  const handleInput = useCallback((value: string) => {
    if (!session || busy || (game && game.status !== "in-progress")) return;
    setInput(value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 5));
    setMessage("");
  }, [busy, game, session]);

  const choosePractice = async (mode: "daily-replay" | "archive") => {
    setBusy(true);
    try {
      const puzzleKey =
        mode === "archive"
          ? (await jsonFetch<{ puzzleKey: string }>("/api/archive/random")).puzzleKey
          : bootstrap!.today;
      setSession({ mode, puzzleKey });
      setGame(null);
      setInput("");
      setMessage("");
      setTab("game");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start practice.");
    } finally {
      setBusy(false);
    }
  };

  if (fatalError) {
    return (
      <main className="centered-state">
        <div className="brand-mark">DW</div>
        <h1>We couldn’t open today’s puzzle.</h1>
        <p>{fatalError}</p>
        <button className="primary-button" onClick={() => void loadBootstrap()}>Try again</button>
      </main>
    );
  }

  if (!bootstrap) {
    return (
      <main className="centered-state loading-state" aria-live="polite">
        <div className="brand-mark">DW</div>
        <p>Preparing today’s word…</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={() => setTab("game")} aria-label="Daily Word home">
          <span className="brand-mark">DW</span>
          <span><strong>Daily Word</strong><small>A Bible word puzzle</small></span>
        </button>
        <div className="user-chip" title="Signed in with Google">
          <span className="avatar">{bootstrap.player.displayName.charAt(0).toUpperCase()}</span>
          <span>{bootstrap.player.displayName}</span>
        </div>
      </header>

      <nav className="main-nav" aria-label="Primary navigation">
        {(["game", "leaderboard", "stats"] as Tab[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item === "game" ? "Today’s puzzle" : item === "stats" ? "My stats" : "Leaderboard"}
          </button>
        ))}
      </nav>

      <main className="main-content">
        {tab === "game" && (
          <GameView
            bootstrap={bootstrap}
            session={session}
            game={game}
            input={input}
            message={message}
            busy={busy}
            onKey={handleKey}
            onInput={handleInput}
            onSubmit={() => void submitGuess()}
            onPractice={choosePractice}
          />
        )}
        {tab === "leaderboard" && <LeaderboardView currentPlayerId={bootstrap.player.id} />}
        {tab === "stats" && (
          <StatsView bootstrap={bootstrap} onUpdated={(player) => setBootstrap({ ...bootstrap, player })} />
        )}
      </main>

      <footer><span>One word. One day. A little friendly competition.</span><span>Resets at midnight Eastern</span></footer>
    </div>
  );
}

function GameView({
  bootstrap,
  session,
  game,
  input,
  message,
  busy,
  onKey,
  onInput,
  onSubmit,
  onPractice,
}: {
  bootstrap: Bootstrap;
  session: SessionChoice | null;
  game: GameSnapshot | null;
  input: string;
  message: string;
  busy: boolean;
  onKey: (key: string) => void;
  onInput: (value: string) => void;
  onSubmit: () => void;
  onPractice: (mode: "daily-replay" | "archive") => void;
}) {
  const completed = game && game.status !== "in-progress";
  const rows = useMemo(() => game?.evaluations ?? [], [game?.evaluations]);
  const keyStates = useMemo(() => {
    const priority: Record<LetterState, number> = { absent: 1, present: 2, correct: 3 };
    const states: Record<string, LetterState> = {};
    rows.forEach((evaluation) => evaluation.guess.split("").forEach((letter, index) => {
      const state = evaluation.states[index];
      if (!states[letter] || priority[state] > priority[states[letter]]) states[letter] = state;
    }));
    return states;
  }, [rows]);

  return (
    <section className="game-layout">
      <div className="game-column">
        <div className="eyebrow-row">
          <span className="eyebrow">Puzzle · {formatDate(session?.puzzleKey ?? bootstrap.today)}</span>
          {session?.mode !== "daily" && <span className="practice-badge">Practice</span>}
        </div>
        <h1>{session?.mode === "archive" ? "A word from the archive" : "Today’s five-letter word"}</h1>
        <p className="intro">Every answer appears in the Bible. Proper names are fair game.</p>

        {!session ? (
          <PracticeChoice countedToday={bootstrap.countedToday} playerName={bootstrap.player.displayName} onPractice={onPractice} busy={busy} />
        ) : (
          <>
            {!game && session.mode === "daily" && (
              <div className="warning-note"><span>!</span><p><strong>Your first guess starts the clock.</strong> Leaving before you finish records the maximum score of 6 for today.</p></div>
            )}
            {!game && session.mode !== "daily" && (
              <div className="practice-note"><span>Practice round</span>This game is just for fun and will not change the leaderboard.</div>
            )}
            <GameBoard evaluations={rows} input={input} disabled={Boolean(completed) || busy} onInput={onInput} onSubmit={onSubmit} />
            <div className="message-line" aria-live="polite">{message || (game?.counted === false ? "Practice scores never affect your ranking." : !completed ? "Tap a tile to type a guess." : "\u00A0")}</div>
            {!completed && <Keyboard keyStates={keyStates} onKey={onKey} onSubmit={onSubmit} busy={busy} />}
            {completed && <ResultCard game={game} playerName={bootstrap.player.displayName} onPractice={onPractice} busy={busy} />}
          </>
        )}
      </div>
    </section>
  );
}

function GameBoard({
  evaluations,
  input,
  disabled,
  onInput,
  onSubmit,
}: {
  evaluations: Evaluation[];
  input: string;
  disabled: boolean;
  onInput: (value: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const focusInput = () => {
    if (!disabled) inputRef.current?.focus();
  };

  return (
    <div className="game-board-shell">
      <input
        ref={inputRef}
        className="guess-input"
        aria-label="Type a five-letter guess"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="done"
        inputMode="text"
        maxLength={5}
        spellCheck={false}
        value={input}
        onFocus={() => setIsTyping(true)}
        onBlur={() => setIsTyping(false)}
        onChange={(event) => onInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            onSubmit();
          }
        }}
      />
      <div className={`game-board ${isTyping ? "is-typing" : ""}`} aria-label="Word puzzle grid" onClick={focusInput}>
        {Array.from({ length: 6 }, (_, rowIndex) => {
          const evaluation = evaluations[rowIndex];
          const value = evaluation?.guess ?? (rowIndex === evaluations.length && !disabled ? input : "");
          const isActiveRow = rowIndex === evaluations.length && !disabled;
          return (
            <div className="tile-row" key={rowIndex}>
              {Array.from({ length: 5 }, (_, colIndex) => (
                <div
                  key={colIndex}
                  className={`tile ${evaluation?.states[colIndex] ?? ""} ${value[colIndex] ? "filled" : ""} ${isActiveRow && colIndex === Math.min(input.length, 4) ? "cursor" : ""}`}
                  aria-label={evaluation ? `${value[colIndex]}, ${evaluation.states[colIndex]}` : value[colIndex] || "empty"}
                >
                  {value[colIndex]?.toUpperCase() ?? ""}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Keyboard({ keyStates, onKey, onSubmit, busy }: { keyStates: Record<string, LetterState>; onKey: (key: string) => void; onSubmit: () => void; busy: boolean }) {
  return (
    <div className="keyboard" aria-label="On-screen keyboard">
      {KEYS.map((row, rowIndex) => (
        <div className="key-row" key={rowIndex}>
          {row.map((key) => (
            <button
              key={key}
              className={`key ${keyStates[key] ?? ""} ${key.length > 1 ? "wide" : ""}`}
              onClick={() => key === "enter" ? onSubmit() : onKey(key)}
              disabled={busy}
              aria-label={key}
            >
              {key === "backspace" ? "⌫" : key.toUpperCase()}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function PracticeChoice({ countedToday, playerName, onPractice, busy }: { countedToday: Play | null; playerName: string; onPractice: (mode: "daily-replay" | "archive") => void; busy: boolean }) {
  const shareScore = countedToday?.status === "won" && typeof countedToday.score === "number"
    ? countedToday.score
    : null;
  return (
    <div className="choice-card">
      <span className="choice-icon">✓</span>
      <p className="overline">Today’s result is recorded</p>
      <h2>{countedToday?.status === "won" ? `Solved in ${countedToday.score}` : "Today counts as 6"}</h2>
      <p>You’re welcome to keep playing. Additional games are practice only and will not affect the leaderboard.</p>
      <div className="choice-actions">
        {shareScore !== null && <ShareResultButton playerName={playerName} score={shareScore} />}
        <button className="primary-button" disabled={busy} onClick={() => onPractice("daily-replay")}>Play today’s word again</button>
        <button className="secondary-button" disabled={busy} onClick={() => onPractice("archive")}>Surprise me with a past word</button>
      </div>
    </div>
  );
}

function ResultCard({ game, playerName, onPractice, busy }: { game: GameSnapshot; playerName: string; onPractice: (mode: "daily-replay" | "archive") => void; busy: boolean }) {
  const won = game.status === "won";
  const shareScore = won && game.counted && game.mode === "daily" && typeof game.score === "number"
    ? game.score
    : null;

  return (
    <div className="result-card" aria-live="polite">
      <span className="result-icon">{won ? "✦" : "·"}</span>
      <div><p className="overline">{won ? "Beautifully done" : "The word was"}</p><h2>{game.solution?.toUpperCase()}</h2>{!game.verse && <p className="reference">{game.reference} · WEB</p>}</div>
      <div className="result-score"><strong>{won ? game.score : 6}</strong><span>{won ? "guesses" : "recorded"}</span></div>
      {game.verse && <blockquote className="verse-text">“{game.verse}”<cite>{game.reference} · WEB</cite></blockquote>}
      <p className="result-note">{game.counted ? "This result counts toward your leaderboard standing." : "A practice result—your leaderboard score stays unchanged."}</p>
      <div className="choice-actions">
        {shareScore !== null && <ShareResultButton playerName={playerName} score={shareScore} />}
        <button className="primary-button" disabled={busy} onClick={() => onPractice("daily-replay")}>Play today again</button>
        <button className="secondary-button" disabled={busy} onClick={() => onPractice("archive")}>Random past puzzle</button>
      </div>
    </div>
  );
}

function ShareResultButton({ playerName, score }: { playerName: string; score: number }) {
  const [shareMessage, setShareMessage] = useState("");

  const shareResult = async () => {
    if (typeof window === "undefined") return;
    const text = dailyShareText(playerName, score);
    const url = window.location.origin;
    setShareMessage("");

    if (navigator.share) {
      try {
        await navigator.share({ title: "Daily Word", text, url });
        setShareMessage("Ready to send.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareMessage("Result copied — paste it anywhere you’d like to share.");
    } catch {
      setShareMessage("Sharing is unavailable in this browser.");
    }
  };

  return (
    <div className="share-control">
      <button className="secondary-button" onClick={() => void shareResult()}>Share result</button>
      {shareMessage && <p className="share-message" role="status">{shareMessage}</p>}
    </div>
  );
}

function LeaderboardView({ currentPlayerId }: { currentPlayerId: string }) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const [kind, setKind] = useState<BoardKind>("mostSolved");
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [selected, setSelected] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    jsonFetch<LeaderboardPayload>(`/api/leaderboard?period=${period}`, { cache: "no-store" })
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load rankings."));
  }, [period]);

  const openProfile = async (id: string) => {
    try {
      setSelected(await jsonFetch<PlayerProfile>(`/api/players/${encodeURIComponent(id)}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open that player.");
    }
  };

  const rows = data?.[kind] ?? [];
  return (
    <section className="leaderboard-page">
      <div className="page-heading"><p className="overline">Friendly competition</p><h1>Leaderboard</h1><p>Only each player’s first daily game is included.</p></div>
      <div className="leaderboard-controls">
        <div className="segmented-control" aria-label="Leaderboard category">
          <button className={kind === "mostSolved" ? "active" : ""} onClick={() => setKind("mostSolved")}>Most solved</button>
          <button className={kind === "bestAverage" ? "active" : ""} onClick={() => setKind("bestAverage")}>Best average</button>
        </div>
        <label>Period<select value={period} onChange={(event) => setPeriod(event.target.value as LeaderboardPeriod)}>{Object.entries(PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <div className="leaderboard-card">
        <div className="leaderboard-title"><div><p className="overline">{PERIOD_LABELS[period]}</p><h2>{kind === "mostSolved" ? "Most puzzles solved" : "Lowest average score"}</h2></div><span>{kind === "mostSolved" ? "Higher is better" : "Lower is better · losses count as 6"}</span></div>
        {error && <p className="error-banner">{error}</p>}
        {!data ? <div className="table-loading">Gathering scores…</div> : rows.length === 0 ? <div className="table-loading">No counted games in this period yet.</div> : (
          <div className="ranking-list">
            {rows.map((entry, index) => (
              <button key={entry.playerId} onClick={() => void openProfile(entry.playerId)} className={`ranking-row ${entry.playerId === currentPlayerId ? "is-you" : ""}`}>
                <span className={`rank ${index < 3 ? `top-${index + 1}` : ""}`}>{index + 1}</span>
                <span className="player-avatar">{entry.displayName.charAt(0)}</span>
                <span className="player-name"><strong>{entry.displayName}</strong><small>{entry.countedGames} rated {entry.countedGames === 1 ? "game" : "games"} · {entry.winRate}% wins</small></span>
                <span className="metric"><strong>{kind === "mostSolved" ? entry.wins : entry.averageScore?.toFixed(2)}</strong><small>{kind === "mostSolved" ? "solved" : "avg guesses"}</small></span>
                <span className="row-arrow">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="leaderboard-footnote">Select any player to see their play history, win/loss ratio, streaks, and guess distribution.</p>
      {selected && <ProfileDrawer profile={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function StatsView({ bootstrap, onUpdated }: { bootstrap: Bootstrap; onUpdated: (player: Player) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bootstrap.player.displayName);
  const [error, setError] = useState("");
  const saveName = async () => {
    try {
      const player = await jsonFetch<Player>("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name }) });
      onUpdated(player);
      setEditing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save your name."); }
  };
  return (
    <section className="stats-page">
      <div className="page-heading profile-heading"><div><p className="overline">Your progress</p><h1>{bootstrap.player.displayName}</h1><p>Member since {formatDate(bootstrap.player.joinedAt.slice(0, 10))}</p></div><button className="text-button" onClick={() => setEditing(!editing)}>Edit display name</button></div>
      {editing && <div className="name-editor"><label>Public display name<input value={name} maxLength={30} onChange={(event) => setName(event.target.value)} /></label><button className="primary-button" onClick={() => void saveName()}>Save</button><button className="secondary-button" onClick={() => setEditing(false)}>Cancel</button>{error && <span>{error}</span>}</div>}
      <StatsPanel stats={bootstrap.stats} />
      <HistoryList history={bootstrap.history} />
    </section>
  );
}

function StatsPanel({ stats }: { stats: PlayerStats }) {
  const maxDistribution = Math.max(1, ...stats.guessDistribution);
  return (
    <div className="stats-grid">
      <div className="stat-card hero-stat"><p className="overline">All games</p><strong>{stats.totalPlays}</strong><span>times played</span><div className="win-bar"><i style={{ width: `${stats.winRate}%` }} /></div><small>{stats.wins} wins · {stats.losses} losses · {stats.winRate}% win rate</small></div>
      <div className="stat-card"><span>Rated average</span><strong>{stats.averageScore?.toFixed(2) ?? "—"}</strong><small>Failures count as 6</small></div>
      <div className="stat-card"><span>Current streak</span><strong>{stats.currentStreak}</strong><small>rated wins in a row</small></div>
      <div className="stat-card"><span>Best streak</span><strong>{stats.bestStreak}</strong><small>personal record</small></div>
      <div className="stat-card"><span>Practice rounds</span><strong>{stats.practiceGames}</strong><small>just for fun</small></div>
      <div className="stat-card distribution"><span>Guess distribution</span>{stats.guessDistribution.map((count, index) => <div className="distribution-row" key={index}><b>{index + 1}</b><i><em style={{ width: `${Math.max(count ? 12 : 2, (count / maxDistribution) * 100)}%` }}>{count || ""}</em></i></div>)}</div>
    </div>
  );
}

function HistoryList({ history }: { history: Play[] }) {
  return (
    <div className="history-card"><div className="history-heading"><div><p className="overline">Game history</p><h2>Every win and loss</h2></div><span>{history.length} completed</span></div>
      <div className="history-list">{history.length === 0 ? <p className="empty-history">Your completed games will appear here.</p> : history.slice(0, 30).map((play) => <div className="history-row" key={play.id}><span className={`history-status ${play.status}`}>{play.status === "won" ? "W" : "L"}</span><span><strong>{formatDate(play.puzzleKey)}</strong><small>{play.mode === "archive" ? "Archive practice" : play.counted ? "Counted daily puzzle" : "Daily practice"}</small></span><span className="history-score"><strong>{play.score ?? 6}/6</strong><small>{play.status === "won" ? "guesses" : play.status === "abandoned" ? "left early" : "not solved"}</small></span></div>)}</div>
    </div>
  );
}

function ProfileDrawer({ profile, onClose }: { profile: PlayerProfile; onClose: () => void }) {
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="profile-drawer" role="dialog" aria-modal="true" aria-label={`${profile.displayName}'s statistics`}>
        <button className="close-button" onClick={onClose} aria-label="Close">×</button>
        <div className="drawer-identity"><span className="large-avatar">{profile.displayName.charAt(0)}</span><div><p className="overline">Player profile</p><h2>{profile.displayName}</h2><span>Playing since {formatDate(profile.joinedAt.slice(0, 10))}</span></div></div>
        <StatsPanel stats={profile.stats} />
        <HistoryList history={profile.history} />
      </aside>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}
