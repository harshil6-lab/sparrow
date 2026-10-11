/** Compact relative time used on the reels overlay ("now", "5m", "3h", "2d"). */
export function relativeTime(value: string, now: number = Date.now()): string {
  const ms = now - Date.parse(value);
  if (!Number.isFinite(ms) || ms < 0) return "now";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h";
  return Math.floor(hours / 24) + "d";
}