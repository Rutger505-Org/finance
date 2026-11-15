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
  savingsAccountCreate,
  savingsAccountPatch,
  scenarioCreate,
  scenarioPatch,
  settingsSchema,
  spendingCreate,
  spendingPatch,
  type Issue,
} from "@/lib/finance/schemas";
import { parseDay } from "@/lib/finance/dates";
import { money } from "@/lib/format";
import { repository, today } from "@/server/finance";
import { HttpError } from "@/server/http-error";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SCENARIO_COOKIE } from "@/server/scenario";
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

/** Saves a checkpoint; the message says how far off the expected balance was. */
export async function addBalance(input: unknown) {
  let message = "Checkpoint opgeslagen";
  const result = run(() => {
    const saved = repository.createBalance(balanceCreate.parse(input), today());
    const day = parseDay(saved.date);
    const checked = repository
      .reconcile(saved.account, saved.savingsAccountId, day, day)
      .checkpoints.find((checkpoint) => checkpoint.id === saved.id);
    if (checked?.difference != null) {
      message =
        checked.difference === 0
          ? "Checkpoint opgeslagen: precies wat verwacht werd"
          : `Checkpoint opgeslagen: ${money(Math.abs(checked.difference))} ${checked.difference > 0 ? "meer" : "minder"} dan verwacht (${money(checked.expected!)})`;
    }
  });
  return result.ok ? { ...result, message } : result;
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

/** The scenario shown on Inkomsten and Vaste lasten; remembered in a cookie. */
export async function selectScenario(id: number) {
  (await cookies()).set(SCENARIO_COOKIE, String(id), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

/** Returns the scenario's id, so the switch can select one it just created. */
export async function saveScenario(id: number | null, input: unknown): Promise<ActionResult & { id?: number }> {
  let saved: number | undefined;
  const result = run(() => {
    saved = (
      id === null
        ? repository.createScenario(scenarioCreate.parse(input))
        : repository.updateScenario(id, scenarioPatch.parse(input))
    ).id;
  });
  return result.ok ? { ...result, id: saved } : result;
}

export async function deleteScenario(id: number) {
  return run(() => repository.deleteScenario(id));
}

/** On an existing account, a changed `balance` is saved as a new checkpoint. */
export async function saveSavingsAccount(
  id: number | null,
  input: unknown,
  balance?: { amount: number; date: string },
) {
  return run(() => {
    if (id === null) return repository.createSavingsAccount(savingsAccountCreate.parse(input), today());
    const patch = savingsAccountPatch.parse(input);
    const current = repository.getSavingsAccount(id).balance;
    if (balance && (current?.amount !== balance.amount || current.date !== balance.date)) {
      repository.createBalance(
        balanceCreate.parse({ account: "savings", savingsAccountId: id, amount: balance.amount, date: balance.date }),
        today(),
      );
    }
    return repository.updateSavingsAccount(id, patch);
  }, "Opgeslagen");
}

export async function deleteSavingsAccount(id: number) {
  return run(() => repository.deleteSavingsAccount(id));
}
