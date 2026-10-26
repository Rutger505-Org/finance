import { buttonVariants } from "@/components/ui/button";
import { isoDay, type Day } from "@/lib/finance/dates";
import Link from "next/link";

export function DateNav({ day, today }: { day: Day; today: Day }) {
  const href = (target: Day) => (target === today ? "/" : `/?datum=${isoDay(target)}`);
  return (
    <form action="/" className="flex flex-wrap items-center gap-2">
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
        <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Vandaag
        </Link>
      )}
    </form>
  );
}
