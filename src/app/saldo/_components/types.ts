import type { ChangeKind } from "@/lib/finance/balances";
import type { BalanceAccount } from "@/lib/finance/schemas";
import type { ChartCheckpoint, ChartPoint } from "./balance-chart";

/** One change of an account's balance; amounts in cents. */
export interface ChangeItem {
  date: string;
  time: string | null;
  name: string;
  amount: number;
  /** What kind of change, in words. */
  label: string;
  /** A planned occurrence without a linked bank line. */
  planned: boolean;
  /** A bank line linked to a planned occurrence: planned date and amount, and all its lines together. */
  plan: { date: string; amount: number | null; real: number } | null;
}

/** Everything the Saldo page shows of one account; amounts in cents. */
export interface AccountView {
  /** "current", "fixed" or "savings:<id>" */
  key: string;
  label: string;
  account: BalanceAccount;
  savingsAccountId: number | null;
  /** Expected balance at the end of today. */
  expected: number | null;
  /** Expected balance at the end of each day in the chart window, by date. */
  points: ChartPoint[];
  /** All checkpoints, newest first, with what changed since the one before. */
  checkpoints: (ChartCheckpoint & {
    id: number;
    expected: number | null;
    changes: ChangeItem[];
  })[];
  /** Changes since the last checkpoint, per kind. */
  since: {
    kind: ChangeKind;
    label: string;
    total: number;
    items: ChangeItem[];
  }[];
}
