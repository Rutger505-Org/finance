"use server";

import {
  balanceCreate,
  configSchema,
  expenseCreate,
  expensePatch,
  formatIssues,
  incomeCreate,
  incomePatch,
  settingsSchema,
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
