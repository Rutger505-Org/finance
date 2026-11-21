import { totalsBy, type SpendingLine } from "@/lib/finance/spending";
import { money } from "@/lib/format";

/** Chips with an outing's total per category; `lines` in cents. */
export function CategoryTotals({ lines, categories }: { lines: SpendingLine[]; categories: { id: number; name: string }[] }) {
  if (lines.length === 0) return null;
  const name = (id: number | null) =>
    id === null ? "Geen categorie" : (categories.find((c) => c.id === id)?.name ?? `#${id}`);
  return (
    <ul className="flex flex-wrap gap-2 text-sm tabular-nums">
      {totalsBy(lines, "categoryId").map((t) => (
        <li key={String(t.id)} className="bg-muted rounded px-2 py-1">
          {name(t.id)} <span className="font-medium">{money(t.amount)}</span>
        </li>
      ))}
    </ul>
  );
}
