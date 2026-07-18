export function dailyShareText(playerName: string, score: number): string {
  const name = playerName.trim() || "A player";
  const moves = `${score}/6 ${score === 1 ? "move" : "moves"}`;
  return `${name} solved today’s Daily Word in ${moves}! See if you can do better!`;
}
