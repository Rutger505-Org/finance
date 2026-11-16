import type { Day } from "@/lib/finance/dates";
import { labelIndices, niceTicks, scaleLinear } from "@/lib/finance/outing-trend";
import { dateCompact, dateLong, money } from "@/lib/format";

export interface LinePoint {
  key: string;
  day: Day;
  /** Cents. */
  value: number;
}

const WIDTH = 600;
const HEIGHT = 260;
const PAD = { top: 12, right: 36, bottom: 32, left: 80 };
const LABEL_GAP = 64;
const COLOR = "#2563eb";

/** Line chart of values (cents) over days, x scaled by date, y from 0. */
export function LineChart({ points, title }: { points: LinePoint[]; title: string }) {
  if (points.length === 0) return <p className="text-muted-foreground text-sm">Nog niets.</p>;

  const sorted = [...points].sort((a, b) => a.day - b.day);
  const ticks = niceTicks(sorted.map((p) => p.value));
  const x = scaleLinear([sorted[0].day, sorted.at(-1)!.day], [PAD.left, WIDTH - PAD.right]);
  const y = scaleLinear([ticks[0], ticks.at(-1)!], [HEIGHT - PAD.bottom, PAD.top]);
  const coords = sorted.map((p) => ({ ...p, cx: x(p.day), cy: y(p.value) }));
  const labels = labelIndices(
    coords.map((c) => c.cx),
    LABEL_GAP,
  ).map((i) => coords[i]);
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.cx} ${c.cy}`).join(" ");

  return (
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
      {labels.map((c) => (
        <text
          key={c.key}
          x={c.cx}
          y={HEIGHT - PAD.bottom + 18}
          textAnchor="middle"
          className="fill-muted-foreground text-[11px]"
        >
          {dateCompact(c.day)}
        </text>
      ))}
      <path d={line} fill="none" stroke={COLOR} strokeWidth={2} strokeLinejoin="round" />
      {coords.map((c) => (
        <circle key={c.key} cx={c.cx} cy={c.cy} r={4} fill={COLOR} className="stroke-background" strokeWidth={1.5}>
          <title>{`${dateLong(c.day)}: ${money(c.value)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
