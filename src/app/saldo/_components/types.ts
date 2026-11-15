import type { ChangeKind } from "@/lib/finance/balances";
import type { BalanceAccount } from "@/lib/finance/schemas";
import type { ChartCheckpoint, ChartPoint } from "./balance-chart";

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
  /** All checkpoints, newest first. */
  checkpoints: (ChartCheckpoint & { id: number; expected: number | null })[];
  /** Changes since the last checkpoint, per kind. */
  since: {
    kind: ChangeKind;
    label: string;
    total: number;
    items: {
      date: string;
      time: string | null;
      name: string;
      amount: number;
    }[];
  }[];
}
