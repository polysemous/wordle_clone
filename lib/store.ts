import { createHash, randomUUID } from "node:crypto";
import { Firestore } from "@google-cloud/firestore";
import { evaluateGuess, MAX_GUESSES, puzzleForDate } from "./puzzle";
import type { Play, Player, PlayMode } from "./types";

export interface Identity {
  id: string;
  email: string;
  suggestedName: string;
}

export interface GameStore {
  getOrCreatePlayer(identity: Identity): Promise<Player>;
  updatePlayer(userId: string, displayName: string): Promise<Player>;
  listPlayers(): Promise<Player[]>;
  listPlays(userId?: string): Promise<Play[]>;
  getPlay(playId: string): Promise<Play | null>;
  startPlay(player: Player, puzzleKey: string, mode: PlayMode): Promise<Play>;
  savePlay(play: Play): Promise<void>;
  abandonOpenPlays(userId: string): Promise<void>;
}

class MemoryStore implements GameStore {
  private players = new Map<string, Player>();
  private plays = new Map<string, Play>();

  constructor() {
    this.seedDemoData();
  }

  private seedDemoData() {
    const demoPlayers = [
      ["demo-grace", "Grace M."],
      ["demo-jordan", "Jordan"],
      ["demo-micah", "Micah R."],
      ["demo-evelyn", "Evelyn"],
    ];
    const today = new Date();
    demoPlayers.forEach(([id, displayName], playerIndex) => {
      this.players.set(id, {
        id,
        displayName,
        joinedAt: new Date(today.getTime() - 90 * 86_400_000).toISOString(),
      });
      for (let offset = 1; offset <= 34 - playerIndex * 3; offset += 1) {
        if ((offset + playerIndex) % 5 === 0) continue;
        const puzzleKey = new Date(today.getTime() - offset * 86_400_000)
          .toISOString()
          .slice(0, 10);
        const lost = (offset * (playerIndex + 2)) % 11 === 0;
        const score = lost ? MAX_GUESSES : 2 + ((offset + playerIndex) % 5);
        const answer = puzzleForDate(puzzleKey).word;
        const guesses = lost
          ? ["about", "heart", "stone", "grace", "light", "faith"]
          : Array.from({ length: score }, (_, guessIndex) =>
              guessIndex === score - 1 ? answer : ["about", "heart", "stone", "grace", "light"][guessIndex % 5],
            );
        const startedAt = `${puzzleKey}T14:00:00.000Z`;
        const play: Play = {
          id: `seed-${id}-${puzzleKey}`,
          userId: id,
          userName: displayName,
          puzzleKey,
          mode: "daily",
          counted: true,
          status: lost ? "lost" : "won",
          guesses,
          evaluations: guesses.map((guess) => evaluateGuess(guess, answer)),
          score,
          startedAt,
          completedAt: `${puzzleKey}T14:04:00.000Z`,
        };
        this.plays.set(play.id, play);
      }
    });
  }

  async getOrCreatePlayer(identity: Identity) {
    const existing = this.players.get(identity.id);
    if (existing) return existing;
    const player = {
      id: identity.id,
      displayName: identity.suggestedName,
      joinedAt: new Date().toISOString(),
    };
    this.players.set(player.id, player);
    return player;
  }

  async updatePlayer(userId: string, displayName: string) {
    const player = this.players.get(userId);
    if (!player) throw new Error("Player not found");
    const updated = { ...player, displayName };
    this.players.set(userId, updated);
    for (const [id, play] of this.plays) {
      if (play.userId === userId) this.plays.set(id, { ...play, userName: displayName });
    }
    return updated;
  }

  async listPlayers() {
    return [...this.players.values()];
  }

  async listPlays(userId?: string) {
    const plays = [...this.plays.values()];
    return userId ? plays.filter((play) => play.userId === userId) : plays;
  }

  async getPlay(playId: string) {
    return this.plays.get(playId) ?? null;
  }

  async startPlay(player: Player, puzzleKey: string, requestedMode: PlayMode) {
    const existingCounted = [...this.plays.values()].some(
      (play) =>
        play.userId === player.id && play.puzzleKey === puzzleKey && play.counted,
    );
    const counted = requestedMode === "daily" && !existingCounted;
    const mode = requestedMode === "daily" && !counted ? "daily-replay" : requestedMode;
    const play: Play = {
      id: randomUUID(),
      userId: player.id,
      userName: player.displayName,
      puzzleKey,
      mode,
      counted,
      status: "in-progress",
      guesses: [],
      evaluations: [],
      score: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
    this.plays.set(play.id, play);
    return play;
  }

  async savePlay(play: Play) {
    this.plays.set(play.id, play);
  }

  async abandonOpenPlays(userId: string) {
    for (const [id, play] of this.plays) {
      if (play.userId === userId && play.status === "in-progress") {
        this.plays.set(id, {
          ...play,
          status: "abandoned",
          score: MAX_GUESSES,
          completedAt: new Date().toISOString(),
        });
      }
    }
  }
}

class FirestoreStore implements GameStore {
  private db = new Firestore({ databaseId: process.env.FIRESTORE_DATABASE_ID });
  private players = this.db.collection("players");
  private plays = this.db.collection("plays");
  private dailyRecords = this.db.collection("dailyRecords");

  async getOrCreatePlayer(identity: Identity) {
    const ref = this.players.doc(identity.id);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) return snapshot.data() as Player;
      const player: Player = {
        id: identity.id,
        displayName: identity.suggestedName,
        joinedAt: new Date().toISOString(),
      };
      transaction.create(ref, player);
      return player;
    });
  }

  async updatePlayer(userId: string, displayName: string) {
    const ref = this.players.doc(userId);
    await ref.update({ displayName });
    const snapshot = await ref.get();
    return snapshot.data() as Player;
  }

  async listPlayers() {
    const snapshot = await this.players.get();
    return snapshot.docs.map((doc) => doc.data() as Player);
  }

  async listPlays(userId?: string) {
    const query = userId ? this.plays.where("userId", "==", userId) : this.plays;
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data() as Play);
  }

  async getPlay(playId: string) {
    const snapshot = await this.plays.doc(playId).get();
    return snapshot.exists ? (snapshot.data() as Play) : null;
  }

  async startPlay(player: Player, puzzleKey: string, requestedMode: PlayMode) {
    const playRef = this.plays.doc();
    const dailyId = createHash("sha256")
      .update(`${player.id}:${puzzleKey}`)
      .digest("hex");
    const dailyRef = this.dailyRecords.doc(dailyId);
    return this.db.runTransaction(async (transaction) => {
      const dailySnapshot = await transaction.get(dailyRef);
      const counted = requestedMode === "daily" && !dailySnapshot.exists;
      const mode = requestedMode === "daily" && !counted ? "daily-replay" : requestedMode;
      const play: Play = {
        id: playRef.id,
        userId: player.id,
        userName: player.displayName,
        puzzleKey,
        mode,
        counted,
        status: "in-progress",
        guesses: [],
        evaluations: [],
        score: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      };
      transaction.create(playRef, play);
      if (counted) {
        transaction.create(dailyRef, {
          userId: player.id,
          puzzleKey,
          playId: play.id,
          createdAt: play.startedAt,
        });
      }
      return play;
    });
  }

  async savePlay(play: Play) {
    await this.plays.doc(play.id).set(play);
  }

  async abandonOpenPlays(userId: string) {
    const snapshot = await this.plays
      .where("userId", "==", userId)
      .where("status", "==", "in-progress")
      .get();
    if (snapshot.empty) return;
    const batch = this.db.batch();
    for (const doc of snapshot.docs) {
      batch.update(doc.ref, {
        status: "abandoned",
        score: MAX_GUESSES,
        completedAt: new Date().toISOString(),
      });
    }
    await batch.commit();
  }
}

declare global {
  var __wordleMemoryStore: MemoryStore | undefined;
}

export function getStore(): GameStore {
  const backend = process.env.DATA_BACKEND ?? (process.env.NODE_ENV === "production" ? "firestore" : "memory");
  if (backend === "firestore") return new FirestoreStore();
  globalThis.__wordleMemoryStore ??= new MemoryStore();
  return globalThis.__wordleMemoryStore;
}
