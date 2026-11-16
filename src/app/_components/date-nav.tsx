import { buttonVariants } from "@/components/ui/button";
import { isoDay, type Day } from "@/lib/finance/dates";
import Link from "next/link";

/** Previous/next day and a date picker; links to `path` with `?datum=` (none for today), `anchor` keeps the section in view. */
export function DateNav({ day, today, path = "/", anchor }: { day: Day; today: Day; path?: string; anchor?: string }) {
  const hash = anchor ? `#${anchor}` : "";
  const href = (target: Day) => (target === today ? path : `${path}?datum=${isoDay(target)}`) + hash;
  return (
    <form action={path + hash} className="flex flex-wrap items-center gap-2">
      <Link href={href(day - 1)} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label="Vorige dag">
        ‹
      </Link>
      <input
        type="date"
        name="datum"
        defaultValue={isoDay(day)}
        key={day}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
      />
      <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Toon
      </button>
      <Link href={href(day + 1)} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label="Volgende dag">
        ›
      </Link>
      {day !== today && (
        <Link href={path + hash} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Vandaag
        </Link>
      )}
    </form>
  );
}
