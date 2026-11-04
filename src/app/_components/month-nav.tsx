import { buttonVariants } from "@/components/ui/button";
import { addMonths } from "@/lib/finance/spending";
import Link from "next/link";

export function MonthNav({ path, month, current }: { path: string; month: string; current: string }) {
  const href = (target: string) => (target === current ? path : `${path}?maand=${target}`);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={href(addMonths(month, -1))} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label="Vorige maand">
        ‹
      </Link>
      <Link href={href(addMonths(month, 1))} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label="Volgende maand">
        ›
      </Link>
      {month !== current && (
        <Link href={path} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Deze maand
        </Link>
      )}
    </div>
  );
}
