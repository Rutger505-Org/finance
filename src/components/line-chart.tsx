import type { Day } from "@/lib/finance/dates";
import { labelIndices, niceTicks, scaleLinear } from "@/lib/finance/outing-trend";
import { dateCompact, dateLong, money } from "@/lib/format";

export interface LinePoint {
  key: string;
  day: Day;
  /** Cents. */
  value: number;
}

export interface SeriesPoint {
  key: string;
  /** Any number on the x axis: a Day, a day of the month, ... */
  x: number;
  /** Cents. */
  value: number;
}

export interface LineSeries {
  key: string;
  label: string;
  points: SeriesPoint[];
  color?: string;
  /** Dashed and without dots, e.g. a comparison. */
  muted?: boolean;
}

const WIDTH = 600;
const HEIGHT = 260;
const PAD = { top: 12, right: 36, bottom: 32, left: 80 };
const LABEL_GAP = 64;
const COLORS = ["#2563eb", "#94a3b8", "#16a34a", "#f59e0b"];

/** Line chart of values (cents) over days, x scaled by date, y from 0. */
export function LineChart({ points, title }: { points: LinePoint[]; title: string }) {
  return (
    <MultiLineChart
      title={title}
      series={[{ key: "line", label: title, points: points.map((p) => ({ key: p.key, x: p.day, value: p.value })) }]}
      xLabel={dateCompact}
      pointLabel={dateLong}
    />
  );
}

/** One or more lines over a shared numeric x axis, y from 0; a legend when there is more than one series. */
export function MultiLineChart({
  series,
  title,
  xLabel,
  pointLabel = xLabel,
  xDomain,
}: {
  series: LineSeries[];
  title: string;
  /** Axis label for an x value. */
  xLabel: (x: number) => string;
  /** Tooltip label for an x value; defaults to `xLabel`. */
  pointLabel?: (x: number) => string;
  /** Fixed x range, e.g. a whole month; defaults to the data. */
  xDomain?: [number, number];
}) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <p className="text-muted-foreground text-sm">Nog niets.</p>;

  const xs = all.map((p) => p.x);
  const [x0, x1] = xDomain ?? [Math.min(...xs), Math.max(...xs)];
  const ticks = niceTicks(all.map((p) => p.value));
  const x = scaleLinear([x0, x1], [PAD.left, WIDTH - PAD.right]);
  const y = scaleLinear([ticks[0], ticks.at(-1)!], [HEIGHT - PAD.bottom, PAD.top]);
  const lines = series.map((s, i) => {
    const color = s.color ?? COLORS[i % COLORS.length];
    const coords = [...s.points].sort((a, b) => a.x - b.x).map((p) => ({ ...p, cx: x(p.x), cy: y(p.value) }));
    const path = coords.map((c, j) => `${j === 0 ? "M" : "L"} ${c.cx} ${c.cy}`).join(" ");
    return { ...s, color, coords, path };
  });
  const axisXs = [...new Set(xs)].sort((a, b) => a - b);
  const labels = labelIndices(axisXs.map(x), LABEL_GAP).map((i) => axisXs[i]);

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={title}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className={tick === 0 ? "stroke-foreground/40" : "stroke-border"}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {money(tick)}
            </text>
          </g>
        ))}
        {labels.map((value) => (
          <text
            key={value}
            x={x(value)}
            y={HEIGHT - PAD.bottom + 18}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            {xLabel(value)}
          </text>
        ))}
        {lines.map((line) => (
          <g key={line.key}>
            <path
              d={line.path}
              fill="none"
              stroke={line.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeDasharray={line.muted ? "6 4" : undefined}
            />
            {line.coords.map((c) => (
              <circle
                key={c.key}
                cx={c.cx}
                cy={c.cy}
                r={line.muted ? 6 : 4}
                fill={line.muted ? "transparent" : line.color}
                className={line.muted ? undefined : "stroke-background"}
                strokeWidth={line.muted ? 0 : 1.5}
              >
                <title>{`${series.length > 1 ? `${line.label}, ` : ""}${pointLabel(c.x)}: ${money(c.value)}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      {series.length > 1 && (
        <figcaption className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {lines.map((line) => (
            <span key={line.key} className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden>
                <line
                  x1="0"
                  x2="18"
                  y1="3"
                  y2="3"
                  stroke={line.color}
                  strokeWidth={2}
                  strokeDasharray={line.muted ? "4 3" : undefined}
                />
              </svg>
              {line.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
