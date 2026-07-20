function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "HH:MM" for a time input, defaulting to now. */
export function currentTimeValue(now = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Turn a "HH:MM" time on today's local date into an absolute ISO instant. */
export function timeToIso(time: string, now = new Date()): string {
  const [h, m] = time.split(":").map((v) => Number.parseInt(v, 10));
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0);
  return d.toISOString();
}
