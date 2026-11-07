"use server";

import {
  balanceCreate,
  categoryCreate,
  configSchema,
  counterpartyCreate,
  counterpartyPatch,
  expenseCreate,
  expensePatch,
  formatIssues,
  incomeCreate,
  incomePatch,
  outingCreate,
  outingPatch,
  settingsSchema,
  spendingCreate,
  spendingPatch,
  statementImport,
  statementLinePatch,
  statementLineSpending,
  type Issue,
} from "@/lib/finance/schemas";
import { repository, today } from "@/server/finance";
import { HttpError } from "@/server/http-error";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; issues?: Issue[] };

function run(fn: () => unknown, message?: string): ActionResult {
  try {
    fn();
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, error: "Ongeldige invoer", issues: formatIssues(error) };
    }
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Er ging iets mis" };
  }
  revalidatePath("/", "layout");
  return { ok: true, message };
}

export async function saveIncome(id: number | null, input: unknown) {
  return run(() =>
    id === null
      ? repository.createIncome(incomeCreate.parse(input))
      : repository.updateIncome(id, incomePatch.parse(input)),
  );
}

export async function deleteIncome(id: number) {
  return run(() => repository.deleteIncome(id));
}

export async function saveExpense(id: number | null, input: unknown) {
  return run(() =>
    id === null
      ? repository.createExpense(expenseCreate.parse(input))
      : repository.updateExpense(id, expensePatch.parse(input)),
  );
}

export async function deleteExpense(id: number) {
  return run(() => repository.deleteExpense(id));
}

export async function saveSettings(input: unknown) {
  return run(() => repository.putSettings(settingsSchema.parse(input)), "Opgeslagen");
}

export async function addBalance(input: unknown) {
  return run(() => repository.createBalance(balanceCreate.parse(input), today()), "Saldo opgeslagen");
}

export async function deleteBalance(id: number) {
  return run(() => repository.deleteBalance(id));
}

export async function saveSpending(id: number | null, input: unknown) {
  return run(() =>
    id === null
      ? repository.createSpending(spendingCreate.parse(input), today())
      : repository.updateSpending(id, spendingPatch.parse(input)),
  );
}

export async function deleteSpending(id: number) {
  return run(() => repository.deleteSpending(id));
}

/** Returns the outing's id, so a form can select an outing it just created. */
export async function saveOuting(id: number | null, input: unknown): Promise<ActionResult & { id?: number }> {
  let saved: number | undefined;
  const result = run(() => {
    saved = (
      id === null ? repository.createOuting(outingCreate.parse(input)) : repository.updateOuting(id, outingPatch.parse(input))
    ).id;
  });
  return result.ok ? { ...result, id: saved } : result;
}

export async function deleteOuting(id: number) {
  return run(() => repository.deleteOuting(id));
}

/** Open statement lines are matched again, so a new counterparty processes them right away. */
export async function saveCounterparty(id: number | null, input: unknown) {
  let message: string | undefined;
  const result = run(() => {
    if (id === null) repository.createCounterparty(counterpartyCreate.parse(input));
    else repository.updateCounterparty(id, counterpartyPatch.parse(input));
    const processed = repository.processStatementLines();
    if (processed.spendings + processed.skipped > 0) {
      message = `${processed.spendings} afschriftregels werden uitgaven, ${processed.skipped} overgeslagen`;
    }
  });
  return result.ok ? { ...result, message } : result;
}

export async function deleteCounterparty(id: number) {
  return run(() => repository.deleteCounterparty(id));
}

export async function saveCategory(id: number | null, input: unknown) {
  return run(() =>
    id === null
      ? repository.createCategory(categoryCreate.parse(input))
      : repository.renameCategory(id, categoryCreate.parse(input)),
  );
}

export async function deleteCategory(id: number) {
  return run(() => repository.deleteCategory(id));
}

export async function importStatement(input: unknown) {
  let message = "";
  const result = run(() => {
    const r = repository.importStatement(statementImport.parse(input));
    message = [
      `${r.lines} regels, ${r.added} nieuw (${r.duplicates} al bekend).`,
      `${r.spendings} nieuwe uitgaven, ${r.skipped} overgeslagen, ${r.open} te verwerken.`,
      r.balance && `Saldo ${r.balance.amount.toFixed(2).replace(".", ",")} op ${r.balance.date}.`,
      ...r.warnings,
    ]
      .filter(Boolean)
      .join(" ");
  });
  return result.ok ? { ...result, message } : result;
}

export async function patchStatementLine(id: number, input: unknown) {
  return run(() => repository.patchStatementLine(id, statementLinePatch.parse(input)));
}

export async function statementLineToSpending(id: number, input: unknown) {
  return run(() => repository.statementLineToSpending(id, statementLineSpending.parse(input), today()));
}

/** Raw JSON from the editor. Returns the stored config (with new ids) on success. */
export async function saveConfig(text: string): Promise<ActionResult & { config?: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `Geen geldige JSON: ${(error as Error).message}` };
  }
  const result = run(() => repository.replaceConfig(configSchema.parse(parsed)), "Opgeslagen");
  if (!result.ok) return result;
  return { ...result, config: JSON.stringify(repository.getConfig(), null, 2) };
}
