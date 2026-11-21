import { MonthNav } from "@/app/_components/month-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toYMD, type Day } from "@/lib/finance/dates";
import { weekdayNames } from "@/lib/finance/insights";
import { outingCalendar, outingHref, type CalendarOuting } from "@/lib/finance/outing-calendar";
import { dateLong, money, moneyRounded, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import Link from "next/link";

/** Background per heat level (0 = none), warm and translucent so it reads in light and dark mode. */
const heatClass = ["", "bg-orange-500/10", "bg-orange-500/20", "bg-orange-500/35", "bg-orange-500/50"];

const columns = "grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,0.9fr)] gap-1";

/** A month of outings as a Mon–Sun grid with day and week totals, tinted by amount. */
export function OutingCalendar({
  month,
  current,
  today,
  outings,
}: {
  month: string;
  current: string;
  today: Day;
  outings: CalendarOuting[];
}) {
  const calendar = outingCalendar(month, outings);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="first-letter:uppercase">{monthLabel(month)}</CardTitle>
          <CardDescription className="tabular-nums">
            {calendar.count === 0
              ? "Geen uitjes deze maand"
              : `${calendar.count} ${calendar.count === 1 ? "uitje" : "uitjes"} · ${money(calendar.total)}`}
          </CardDescription>
        </div>
        <MonthNav path="/uitgaven/uitjes" month={month} current={current} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className={cn(columns, "text-muted-foreground text-center text-xs")}>
            {weekdayNames.map((name) => (
              <div key={name} title={name}>
                {name.slice(0, 2)}
              </div>
            ))}
            <div>Week</div>
          </div>
          {calendar.weeks.map((week) => (
            <div key={week.start} className={columns}>
              {week.days.map((cell) => (
                <div
                  key={cell.day}
                  className={cn(
                    "min-h-16 min-w-0 space-y-1 rounded-md border p-1 sm:min-h-24",
                    !cell.inMonth && "bg-muted/40",
                    heatClass[cell.heat],
                  )}
                  title={cell.total !== 0 ? `${dateLong(cell.day)}: ${money(cell.total)}` : undefined}
                >
                  <div
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                      !cell.inMonth && "text-muted-foreground",
                      cell.day === today && "bg-primary text-primary-foreground font-semibold",
                    )}
                    aria-current={cell.day === today ? "date" : undefined}
                  >
                    {toYMD(cell.day).day}
                  </div>
                  {cell.outings.map((outing) => (
                    <Link
                      key={outing.id}
                      href={outingHref(outing.id)}
                      title={`${outing.name}: ${money(outing.total)}`}
                      aria-label={`${outing.name}, ${money(outing.total)}`}
                      className={cn(
                        "bg-background/80 hover:bg-muted flex min-w-0 items-baseline justify-between gap-1 rounded border px-1 py-0.5 text-[11px] leading-tight",
                        !cell.inMonth && "opacity-70",
                      )}
                    >
                      <span className="hidden truncate sm:inline">{outing.name}</span>
                      <span className="shrink-0 font-medium tabular-nums sm:hidden">{moneyRounded(outing.total)}</span>
                      <span className="hidden shrink-0 font-medium tabular-nums sm:inline">{money(outing.total)}</span>
                    </Link>
                  ))}
                </div>
              ))}
              <div
                className={cn(
                  "flex min-w-0 items-center justify-center rounded-md border p-1 text-xs font-medium tabular-nums",
                  heatClass[week.heat],
                )}
                title={`Week van ${dateLong(week.start)}`}
              >
                {week.total === 0 ? (
                  <span className="text-muted-foreground">–</span>
                ) : (
                  <>
                    <span className="sm:hidden">{moneyRounded(week.total)}</span>
                    <span className="hidden sm:inline">{money(week.total)}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {calendar.undated.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Zonder datum</h3>
            <ul className="flex flex-wrap gap-2 text-sm">
              {calendar.undated.map((outing) => (
                <li key={outing.id}>
                  <Link href={outingHref(outing.id)} className="bg-muted hover:bg-muted/70 block rounded px-2 py-1">
                    {outing.name} <span className="font-medium tabular-nums">{money(outing.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

