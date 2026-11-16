import { parseDay, type Day } from "./dates";
import { sum } from "./spending";

/** One dated outing in a trend; `total` in cents. */
export interface TrendPoint {
  outingId: number;
  day: Day;
  total: number;
}

/** Outings sharing a (trimmed) name, at least two of them dated; points sorted by day. */
export interface TrendGroup {
  name: string;
  points: TrendPoint[];
}

const cents = (euros: number) => Math.round(euros * 100);

export const outingKey = (name: string): string => name.trim();

export const trendHref = (name: string): string =>
  `/uitgaven/uitjes/verloop?naam=${encodeURIComponent(outingKey(name))}`;

/** Total per outing in cents, from spendings with amounts in euros (same sum as the outings page). */
export function outingTotals(spendings: { outingId: number | null; amount: number }[]): Map<number, number> {
  const lines = new Map<number, { amount: number }[]>();
  for (const s of spendings) {
    if (s.outingId === null) continue;
    const list = lines.get(s.outingId) ?? [];
    list.push({ amount: cents(s.amount) });
    lines.set(s.outingId, list);
  }
  return new Map([...lines].map(([id, list]) => [id, sum(list)]));
}

/** Names shared by two or more dated outings, sorted by name. */
export function recurringOutings(
  outings: { id: number; name: string; date: string | null }[],
  totals: Map<number, number>,
): TrendGroup[] {
  const groups = new Map<string, TrendPoint[]>();
  for (const outing of outings) {
    if (outing.date === null) continue;
    const key = outingKey(outing.name);
    if (key === "") continue;
    const points = groups.get(key) ?? [];
    points.push({ outingId: outing.id, day: parseDay(outing.date), total: totals.get(outing.id) ?? 0 });
    groups.set(key, points);
  }
  return [...groups]
    .filter(([, points]) => points.length >= 2)
    .map(([name, points]) => ({ name, points: points.sort((a, b) => a.day - b.day || a.outingId - b.outingId) }))
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));
}

export function trendStats(points: { total: number }[]): { average: number; min: number; max: number } | null {
  if (points.length === 0) return null;
  const totals = points.map((p) => p.total);
  return {
    average: Math.round(sum(points.map((p) => ({ amount: p.total }))) / points.length),
    min: Math.min(...totals),
    max: Math.max(...totals),
  };
}

/** 1, 2, 2.5 or 5 times a power of ten, at least `raw`. */
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= raw - 1e-9) ?? 10;
  return step * power;
}

/** Round ticks covering 0 and all values, about `target` intervals; at least 0 to 100. */
export function niceTicks(values: number[], target = 5): number[] {
  const low = Math.min(0, ...values);
  const high = Math.max(low + 100, ...values);
  const step = Math.max(1, niceStep((high - low) / target));
  const ticks: number[] = [];
  for (let tick = Math.floor(low / step) * step; tick < high + step; tick += step) {
    ticks.push(tick);
    if (tick >= high && ticks.length >= 2) break;
  }
  return ticks;
}

/** Linear map from `domain` to `range`; an empty domain maps to the middle of the range. */
export function scaleLinear([d0, d1]: [number, number], [r0, r1]: [number, number]): (value: number) => number {
  if (d0 === d1) return () => (r0 + r1) / 2;
  return (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}

/** Indices of x positions (ascending) to label, at least `minGap` apart; keeps first and, if it fits, last. */
export function labelIndices(xs: number[], minGap: number): number[] {
  if (xs.length === 0) return [];
  const last = xs.length - 1;
  const kept = [0];
  for (let i = 1; i < last; i++) {
    if (xs[i] - xs[kept.at(-1)!] >= minGap && xs[last] - xs[i] >= minGap) kept.push(i);
  }
  if (last > 0 && xs[last] - xs[0] >= minGap) kept.push(last);
  return kept;
}
