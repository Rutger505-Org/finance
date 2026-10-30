import { money } from "@/lib/format";

export interface PieSlice {
  key: string;
  label: string;
  value: number;
}

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
  "#0d9488",
  "#a16207",
];

const RADIUS = 80;
const CENTER = 100;

function point(fraction: number): [number, number] {
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return [CENTER + RADIUS * Math.cos(angle), CENTER + RADIUS * Math.sin(angle)];
}

/** Pie chart of positive values (cents), largest slice first. */
export function PieChart({
  slices,
  title,
}: {
  slices: PieSlice[];
  title: string;
}) {
  const visible = slices
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = visible.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return null;

  const starts = visible.map(
    (_, index) =>
      visible.slice(0, index).reduce((sum, slice) => sum + slice.value, 0) /
      total,
  );
  const arcs = visible.map((slice, index) => {
    const fraction = slice.value / total;
    const start = starts[index];
    const color = COLORS[index % COLORS.length];
    const [x1, y1] = point(start);
    const [x2, y2] = point(start + fraction);
    const largeArc = fraction > 0.5 ? 1 : 0;
    const path =
      fraction >= 0.9999
        ? null
        : `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { ...slice, fraction, color, path };
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <svg
        viewBox="0 0 200 200"
        className="size-48 shrink-0"
        role="img"
        aria-label={title}
      >
        {arcs.map((arc) =>
          arc.path ? (
            <path
              key={arc.key}
              d={arc.path}
              fill={arc.color}
              stroke="white"
              strokeWidth={1}
            >
              <title>{`${arc.label}: ${money(arc.value)}`}</title>
            </path>
          ) : (
            <circle
              key={arc.key}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill={arc.color}
            >
              <title>{`${arc.label}: ${money(arc.value)}`}</title>
            </circle>
          ),
        )}
      </svg>
      <ul className="grid w-full gap-1 text-sm tabular-nums">
        {arcs.map((arc) => (
          <li key={arc.key} className="flex items-center gap-2">
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: arc.color }}
            />
            <span className="flex-1 truncate">{arc.label}</span>
            <span className="text-muted-foreground">
              {(arc.fraction * 100).toFixed(1).replace(".", ",")}%
            </span>
            <span className="w-24 text-right font-medium">
              {money(arc.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
