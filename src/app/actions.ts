"use server";

import {
  balanceCreate,
  categoryCreate,
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

export async function saveCounterparty(id: number | null, input: unknown) {
  return run(() =>
    id === null
      ? repository.createCounterparty(counterpartyCreate.parse(input))
      : repository.updateCounterparty(id, counterpartyPatch.parse(input)),
  );
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
