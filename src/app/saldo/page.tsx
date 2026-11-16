import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  accountLabel,
  matches,
  type Change,
  type ChangeKind,
} from "@/lib/finance/balances";
import {
  dayFromYMD,
  daysInMonth,
  isoDay,
  toYMD,
  type Day,
} from "@/lib/finance/dates";
import type { BalanceAccount } from "@/lib/finance/schemas";
import { today as getToday, repository } from "@/server/finance";
import type { Metadata } from "next";
import { CheckpointForm } from "./_components/checkpoint-form";
import { CheckpointList } from "./_components/checkpoint-list";
import { SaldoView } from "./_components/saldo-view";
import type { AccountView, ChangeItem } from "./_components/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Saldo" };

/** The same day two months back (or the last day of that month). */
function twoMonthsBefore(day: Day): Day {
  const { year, month, day: date } = toYMD(day);
  const target =
    month <= 2
      ? { year: year - 1, month: month + 10 }
      : { year, month: month - 2 };
  return dayFromYMD(
    target.year,
    target.month,
    Math.min(date, daysInMonth(target.year, target.month)),
  );
}

const kindLabels: Record<
  "current" | "fixed" | "savings",
  Partial<Record<ChangeKind, string>>
> = {
  current: {
    income: "Inkomsten",
    transfer: "Naar vaste lastenrekening",
    refund: "Terug van vaste lastenrekening",
    expense: "Vaste lasten",
    spending: "Uitgaven",
    oneOffIncome: "Losse inkomsten",
    fromSavings: "Van spaarrekening",
    toSavings: "Naar spaarrekening",
    unplannedTransfer: "Vaste lastenrekening, buiten het plan",
  },
  fixed: {
    transfer: "Van lopende rekening",
    charge: "Incasso's",
    refund: "Terug naar lopende rekening",
    unplannedTransfer: "Lopende rekening, buiten het plan",
  },
  savings: {
    toCurrent: "Naar lopende rekening",
    fromCurrent: "Van lopende rekening",
    withdrawal: "Geplande uitgaven",
  },
};

function changeItem(account: BalanceAccount, change: Change): ChangeItem {
  return {
    date: isoDay(change.day),
    time: change.time,
    name: change.name,
    amount: change.amount,
    label: kindLabels[account][change.kind] ?? change.kind,
    planned: change.planned ?? false,
    plan: change.plan
      ? {
          date: isoDay(change.plan.day),
          amount: change.plan.amount,
          real: change.plan.real,
        }
      : null,
  };
}

function groupSince(
  account: BalanceAccount,
  changes: Change[],
): AccountView["since"] {
  const groups = new Map<ChangeKind, AccountView["since"][number]>();
  for (const change of changes) {
    const item = changeItem(account, change);
    const group = groups.get(change.kind) ?? {
      kind: change.kind,
      label: item.label,
      total: 0,
      items: [],
    };
    group.total += change.amount;
    group.items.push(item);
    groups.set(change.kind, group);
  }
  return [...groups.values()];
}

export default function SaldoPage() {
  const today = getToday();
  const from = twoMonthsBefore(today);
  const accounts: {
    key: string;
    label: string;
    account: BalanceAccount;
    savingsAccountId: number | null;
  }[] = [
    {
      key: "current",
      label: accountLabel.current,
      account: "current",
      savingsAccountId: null,
    },
    {
      key: "fixed",
      label: accountLabel.fixed,
      account: "fixed",
      savingsAccountId: null,
    },
    ...repository.listSavingsAccounts().map((savings) => ({
      key: `savings:${savings.id}`,
      label: savings.name,
      account: "savings" as const,
      savingsAccountId: savings.id,
    })),
  ];
  const views: AccountView[] = accounts.map((account) => {
    const result = repository.reconcile(
      account.account,
      account.savingsAccountId,
      from,
      today,
      today,
    );
    return {
      ...account,
      expected: result.expected,
      points: result.days.map((day) => ({
        date: isoDay(day.day),
        balance: day.balance,
      })),
      checkpoints: result.checkpoints
        .map((checkpoint) => ({
          id: checkpoint.id,
          date: isoDay(checkpoint.day),
          time: checkpoint.time,
          amount: checkpoint.amount,
          expected: checkpoint.expected,
          difference: checkpoint.difference,
          // Only where it's off: that's where you look for what's missing.
          changes:
            checkpoint.difference === null || checkpoint.difference === 0
              ? []
              : checkpoint.changes.map((change) =>
                  changeItem(account.account, change),
                ),
        }))
        .reverse(),
      since: groupSince(account.account, result.since),
    };
  });
  const skipped = repository.countSkippedLines();
  const off = views.filter((view) => {
    const last = view.checkpoints[0];
    return last?.difference != null && !matches(last.difference);
  });

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Saldo</h1>
        <p className="text-muted-foreground text-sm">
          Wat er als het goed is op je rekeningen staat: het laatste checkpoint
          plus wat sindsdien gepland en geboekt is. Klopt een nieuw checkpoint
          niet met het verwachte saldo, dan mist er iets of staat iets verkeerd.
        </p>
      </div>
      {off.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Laatste checkpoint wijkt af bij{" "}
          {off.map((view) => view.label).join(", ")}.
        </div>
      )}
      {skipped > 0 && (
        <p className="text-muted-foreground text-sm">
          {skipped} overgeslagen {skipped === 1 ? "bankregel" : "bankregels"}{" "}
          uit oudere boekingen: {skipped === 1 ? "telt" : "tellen"} niet mee.
          Boek ze opnieuw als uitgave, inkomst, spaaroverboeking of vaste post.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Checkpoint</CardTitle>
          <CardDescription>
            Vul het echte saldo in zoals je bank het toont. Met een tijd tellen
            uitgaven later die dag erna; zonder tijd geldt het einde van de dag.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CheckpointForm
            accounts={views.map((view) => ({
              key: view.key,
              label: view.label,
              account: view.account,
              savingsAccountId: view.savingsAccountId,
              expected: Object.fromEntries(
                view.points.map((point) => [point.date, point.balance]),
              ),
            }))}
            today={isoDay(today)}
          />
        </CardContent>
      </Card>
      <SaldoView views={views} />
      <Card>
        <CardHeader>
          <CardTitle>Checkpoints</CardTitle>
          <CardDescription>
            Verwacht: het checkpoint ervoor plus alles wat er tussendoor gepland
            en geboekt is. Verschil = echt min verwacht.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CheckpointList
            rows={views
              .flatMap((view) =>
                view.checkpoints.map((checkpoint) => ({
                  ...checkpoint,
                  label: view.label,
                })),
              )
              .sort(
                (a, b) =>
                  b.date.localeCompare(a.date) ||
                  (b.time ?? "24").localeCompare(a.time ?? "24"),
              )}
          />
        </CardContent>
      </Card>
    </>
  );
}
