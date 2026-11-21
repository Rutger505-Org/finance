import { MonthNav } from "@/app/_components/month-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isoWeek, toYMD, type Day } from "@/lib/finance/dates";
import { weekday, weekdayNames } from "@/lib/finance/insights";
import { outingCalendar, outingHref, type CalendarChip, type CalendarOuting } from "@/lib/finance/outing-calendar";
import { dateLong, dateRange, money, moneyRounded, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import Link from "next/link";

/** Background per heat level (0 = none), warm and translucent so it reads in light and dark mode. */
const heatClass = ["", "bg-orange-500/10", "bg-orange-500/20", "bg-orange-500/35", "bg-orange-500/50"];

/** Week summary on the left, set apart by extra spacing; then the seven days. */
const row = "grid grid-cols-[3rem_minmax(0,1fr)] gap-1.5 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-2";
const days = "grid grid-cols-7 gap-1 pl-1.5 sm:pl-2";

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
          <div className={cn(row, "text-muted-foreground text-center text-xs")}>
            <div className="font-medium">Week</div>
            <div className={days}>
              {weekdayNames.map((name) => (
                <div key={name} title={name}>
                  {name.slice(0, 2)}
                </div>
              ))}
            </div>
          </div>
          {calendar.weeks.map((week) => (
            <div key={week.start} className={row}>
              <div
                className={cn(
                  "bg-muted/60 flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md p-1 text-center tabular-nums",
                  heatClass[week.heat],
                )}
                title={`Week ${isoWeek(week.start)}, vanaf ${dateLong(week.start)}: ${money(week.total)}`}
              >
                <span className="text-muted-foreground text-[10px] leading-none sm:text-xs">wk {isoWeek(week.start)}</span>
                {week.total === 0 ? (
                  <span className="text-muted-foreground text-xs">–</span>
                ) : (
                  <>
                    <span className="text-xs font-semibold sm:hidden">{moneyRounded(week.total)}</span>
                    <span className="hidden text-sm font-semibold sm:inline">{money(week.total)}</span>
                  </>
                )}
              </div>
              <div className={days}>
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
                    {cell.outings.map((chip) => (
                      <OutingChip key={chip.id} chip={chip} day={cell.day} inMonth={cell.inMonth} />
                    ))}
                  </div>
                ))}
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


/**
 * Half the space between two day cells (padding, border, half the gap): a multi-day chip reaches that far into it on
 * each side that continues, so the neighbouring chips meet as one bar. Never across a week row.
 */
const reachLeft = "-ml-[calc(0.375rem+1px)]";
const reachRight = "-mr-[calc(0.375rem+1px)]";

/** One outing on one day; a multi-day one shows that day's amount, its name on the first day and each new week row. */
function OutingChip({ chip, day, inMonth }: { chip: CalendarChip; day: Day; inMonth: boolean }) {
  const multi = chip.end > chip.start;
  const startsHere = day === chip.start;
  const endsHere = day === chip.end;
  const continuesLeft = multi && !startsHere && weekday(day) !== 0;
  const continuesRight = multi && !endsHere && weekday(day) !== 6;
  const showName = !multi || startsHere || weekday(day) === 0;
  const label = multi
    ? `${chip.name} (${dateRange(chip.start, chip.end)}): ${money(chip.amount)} deze dag · totaal ${money(chip.total)}`
    : `${chip.name}: ${money(chip.amount)}`;
  const quiet = multi && chip.amount === 0;

  return (
    <Link
      href={outingHref(chip.id)}
      title={label}
      aria-label={label}
      className={cn(
        "flex min-w-0 items-baseline justify-between gap-1 border px-1 py-0.5 text-[11px] leading-tight",
        multi ? "relative border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25" : "bg-background/80 hover:bg-muted rounded",
        multi && (startsHere ? "rounded-l" : "rounded-l-none"),
        multi && (endsHere ? "rounded-r" : "rounded-r-none"),
        continuesLeft && cn(reachLeft, "border-l-0"),
        continuesRight && cn(reachRight, "border-r-0"),
        !inMonth && "opacity-70",
      )}
    >
      <span className="hidden truncate sm:inline">
        {showName ? chip.name : <span className="text-muted-foreground" aria-hidden>⋯</span>}
      </span>
      <span className={cn("shrink-0 font-medium tabular-nums sm:hidden", quiet && "text-muted-foreground font-normal")}>
        {quiet ? "–" : moneyRounded(chip.amount)}
      </span>
      <span
        className={cn("hidden shrink-0 font-medium tabular-nums sm:inline", quiet && "text-muted-foreground font-normal")}
      >
        {quiet ? "–" : money(chip.amount)}
      </span>
    </Link>
  );
}
