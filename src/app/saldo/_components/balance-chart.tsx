"use client";

import { matches } from "@/lib/finance/balances";
import { parseDay } from "@/lib/finance/dates";
import { date, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useEffect, useId, useRef, useState } from "react";

export interface ChartPoint {
  /** YYYY-MM-DD */
  date: string;
  /** Cents, null before the first checkpoint. */
  balance: number | null;
}

export interface ChartCheckpoint {
  date: string;
  time: string | null;
  amount: number;
  difference: number | null;
}

const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 64 };
const INNER_H = HEIGHT - PAD.top - PAD.bottom;

/** Round tick step (1, 2, 2.5, 5 × 10^n) for about `count` ticks. */
function niceStep(range: number, count: number): number {
  const raw = range / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((factor) => factor * power >= raw) ?? 10;
  return step * power;
}

const euros = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Expected balance per day with the checkpoints as dots; hover shows the day. */
export function BalanceChart({
  points,
  checkpoints,
}: {
  points: ChartPoint[];
  checkpoints: ChartCheckpoint[];
}) {
  const gradient = useId();
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at the real width, so text stays readable on a phone.
  const wrapper = useRef<HTMLDivElement>(null);
  const [WIDTH, setWidth] = useState(720);
  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    const observer = new ResizeObserver(
      ([entry]) =>
        entry && setWidth(Math.max(280, Math.round(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const INNER_W = WIDTH - PAD.left - PAD.right;
  const known = points.flatMap((point) =>
    point.balance === null ? [] : [point.balance],
  );
  const inRange = checkpoints.filter((c) =>
    points.some((p) => p.date === c.date),
  );

  const scale = (() => {
    const values = [...known, ...inRange.map((c) => c.amount)];
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 5000;
      max += 5000;
    }
    const step = niceStep(max - min, 4);
    const low = Math.floor(min / step) * step;
    const high = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let value = low; value <= high + step / 2; value += step)
      ticks.push(value);
    return { low, high, ticks };
  })();

  if (known.length === 0) {
    return (
      <p ref={wrapper} className="text-muted-foreground text-sm">
        Nog geen checkpoint in deze periode.
      </p>
    );
  }

  const x = (index: number) =>
    PAD.left +
    (points.length === 1
      ? INNER_W / 2
      : (index / (points.length - 1)) * INNER_W);
  const y = (value: number) =>
    PAD.top + (1 - (value - scale.low) / (scale.high - scale.low)) * INNER_H;
  const indexOf = new Map(points.map((point, index) => [point.date, index]));

  // Null only before the first checkpoint, so the known days are one stretch.
  const first = points.findIndex((point) => point.balance !== null);
  const last = points.length - 1;
  const line = points
    .slice(first)
    .map(
      (point, offset) =>
        `${offset === 0 ? "M" : "L"}${x(first + offset).toFixed(1)},${y(point.balance!).toFixed(1)}`,
    )
    .join("");
  const baseline = y(scale.low).toFixed(1);
  const area = `${line}L${x(last).toFixed(1)},${baseline}L${x(first).toFixed(1)},${baseline}Z`;

  // A date label about every 90 pixels.
  const labelEvery = Math.max(
    1,
    Math.ceil(points.length / Math.max(2, Math.floor(INNER_W / 90))),
  );
  const hovered = hover === null ? null : points[hover];
  const hoveredCheckpoints = hovered
    ? inRange.filter((c) => c.date === hovered.date)
    : [];

  function move(event: React.PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - box.left) / box.width;
    setHover(
      Math.max(
        0,
        Math.min(points.length - 1, Math.round(fraction * (points.length - 1))),
      ),
    );
  }

  return (
    <div ref={wrapper} className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        className="block w-full max-w-full touch-none select-none"
        role="img"
        aria-label="Saldo per dag"
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        {scale.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className={tick === 0 ? "stroke-red-300" : "stroke-border"}
              strokeDasharray={tick === 0 ? undefined : "3 3"}
            />
            <text
              x={PAD.left - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {euros.format(tick / 100)}
            </text>
          </g>
        ))}
        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text
              key={point.date}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {date(parseDay(point.date)).replace(/^\w+\.? /, "")}
            </text>
          ) : null,
        )}
        <path d={area} fill={`url(#${gradient})`} />
        <path
          d={line}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={PAD.top + INNER_H}
            className="stroke-muted-foreground"
            strokeDasharray="2 3"
          />
        )}
        {inRange.map((checkpoint, index) => (
          <circle
            key={index}
            cx={x(indexOf.get(checkpoint.date)!)}
            cy={y(checkpoint.amount)}
            r={5}
            strokeWidth={2}
            className={cn(
              "stroke-white",
              checkpoint.difference === null
                ? "fill-slate-500"
                : matches(checkpoint.difference)
                  ? "fill-emerald-600"
                  : "fill-amber-500",
            )}
          />
        ))}
        {hovered?.balance != null && (
          <circle cx={x(hover!)} cy={y(hovered.balance)} r={4} fill="#2563eb" />
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={INNER_W}
          height={INNER_H}
          fill="transparent"
          onPointerMove={move}
          onPointerDown={move}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hovered && (
        <div
          className="bg-background pointer-events-none absolute top-2 rounded-md border px-3 py-2 text-xs tabular-nums shadow-sm"
          style={
            hover! > points.length / 2
              ? { right: `${((WIDTH - x(hover!) + 12) / WIDTH) * 100}%` }
              : { left: `${((x(hover!) + 12) / WIDTH) * 100}%` }
          }
        >
          <p className="font-medium">{date(parseDay(hovered.date))}</p>
          <p>
            Verwacht: {hovered.balance === null ? "–" : money(hovered.balance)}
          </p>
          {hoveredCheckpoints.map((checkpoint, index) => (
            <p key={index} className="text-muted-foreground">
              Checkpoint{checkpoint.time && ` ${checkpoint.time}`}:{" "}
              {money(checkpoint.amount)}
              {checkpoint.difference !== null &&
                !matches(checkpoint.difference) && (
                  <span className="text-amber-700">
                    {" "}
                    ({checkpoint.difference > 0 ? "+" : "−"}
                    {money(Math.abs(checkpoint.difference))})
                  </span>
                )}
            </p>
          ))}
        </div>
      )}
      <div className="text-muted-foreground mt-2 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-blue-600" /> Verwacht saldo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-600" /> Checkpoint
          klopt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500" /> Checkpoint
          wijkt af
        </span>
      </div>
    </div>
  );
}
