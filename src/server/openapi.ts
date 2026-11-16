import {
  balanceCreate,
  balanceDto,
  bookedLineDto,
  bookings,
  categoryCreate,
  categoryDto,
  configSchema,
  convertToSavings,
  counterpartyCreate,
  counterpartyDto,
  counterpartyPatch,
  expenseCreate,
  expenseDto,
  expensePatch,
  incomeCreate,
  incomeDto,
  incomePatch,
  oneOffIncomeCreate,
  oneOffIncomeDto,
  oneOffIncomePatch,
  outingCreate,
  outingDto,
  outingPatch,
  savingsAccountCreate,
  savingsAccountDto,
  savingsAccountPatch,
  savingsTransferCreate,
  savingsTransferDto,
  scenarioCreate,
  scenarioDto,
  scenarioPatch,
  settingsSchema,
  spendingCreate,
  spendingDto,
  spendingPatch,
} from "@/lib/finance/schemas";
import { z } from "zod";

const schema = (value: z.ZodType) => z.toJSONSchema(value, { io: "input", unrepresentable: "any" });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const body = (name: string) => ({
  required: true,
  content: { "application/json": { schema: ref(name) } },
});
const ok = (name: string, description = "OK") => ({
  description,
  content: { "application/json": { schema: ref(name) } },
});
const list = (name: string) => ({
  description: "OK",
  content: { "application/json": { schema: { type: "array", items: ref(name) } } },
});
const errors = {
  "400": ok("Error", "Invalid input"),
  "404": ok("Error", "Not found"),
};
const idParam = [{ name: "id", in: "path", required: true, schema: { type: "integer" } }];

function crud(tag: string, plural: string, item: string) {
  return {
    [`/api/v1/${plural}`]: {
      get: { tags: [tag], summary: `List ${plural}`, responses: { "200": list(item) } },
      post: {
        tags: [tag],
        summary: `Create a ${tag.toLowerCase()}`,
        requestBody: body(`${item}Create`),
        responses: { "201": ok(item, "Created"), ...errors },
      },
    },
    [`/api/v1/${plural}/{id}`]: {
      parameters: idParam,
      get: { tags: [tag], summary: `Get a ${tag.toLowerCase()}`, responses: { "200": ok(item), ...errors } },
      patch: {
        tags: [tag],
        summary: `Change some fields of a ${tag.toLowerCase()}`,
        requestBody: body(`${item}Patch`),
        responses: { "200": ok(item), ...errors },
      },
      delete: {
        tags: [tag],
        summary: `Delete a ${tag.toLowerCase()}`,
        responses: { "204": { description: "Deleted" }, ...errors },
      },
    },
  };
}

function spendingPaths() {
  const paths = crud("Spending", "spendings", "Spending");
  const date = (name: string, description: string) => ({ name, in: "query", schema: { type: "string", format: "date" }, description });
  const id = (name: string) => ({ name, in: "query", schema: { type: "integer" } });
  Object.assign(paths["/api/v1/spendings"].get, {
    summary: "List one-off spendings, newest first",
    parameters: [
      date("from", "Inclusive"),
      date("to", "Inclusive"),
      id("categoryId"),
      id("outingId"),
      id("counterpartyId"),
    ],
  });
  return paths;
}

function oneOffIncomePaths() {
  const paths = crud("One-off income", "one-off-incomes", "OneOffIncome");
  Object.assign(paths["/api/v1/one-off-incomes"].get, {
    summary:
      "List one-off incomes (money in that isn't a regular income or a refund: something sold, a contribution), newest first",
    parameters: [
      { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "Inclusive" },
      { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "Inclusive" },
      { name: "counterpartyId", in: "query", schema: { type: "integer" } },
    ],
  });
  const item = paths["/api/v1/one-off-incomes/{id}"] as unknown as Record<"delete", { summary: string }>;
  Object.assign(item.delete, {
    summary: "Delete a one-off income; its booked statement lines are freed",
  });
  return paths;
}

function savingsPaths() {
  const paths = crud("Savings account", "savings-accounts", "SavingsAccount");
  type Ops = Record<"get" | "post" | "delete", { summary: string }>;
  const list = paths["/api/v1/savings-accounts"] as unknown as Ops;
  const item = paths["/api/v1/savings-accounts/{id}"] as unknown as Ops;
  Object.assign(list.get, {
    summary:
      "List savings accounts with their latest checkpoint (`balance`), their transfers and summary: what's free after the planned withdrawals after today, per month from next month through `until` (null when not spread or without balance). The balance the summary uses is the checkpoint plus the transfers after it. `scenarioIds`: the scenarios whose monthly budget the spread counts in. `iban`: its own IBAN, unique.",
  });
  Object.assign(list.post, {
    summary: "Create a savings account; `balance` saves its first checkpoint",
  });
  Object.assign(item.delete, { summary: "Delete a savings account, its checkpoints and transfers; their statement lines are freed" });
  return paths;
}

function savingsTransferPaths() {
  const tags = ["Savings transfer"];
  return {
    "/api/v1/savings-transfers": {
      get: {
        tags,
        summary:
          "Real money moved between a savings account and the current account, newest first. amount > 0: savings → current, < 0: current → savings.",
        parameters: [
          { name: "savingsAccountId", in: "query", schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "Inclusive" },
          { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "Inclusive" },
        ],
        responses: { "200": list("SavingsTransfer"), ...errors },
      },
      post: {
        tags,
        summary: "Record a savings transfer by hand (statement lines are booked with POST /bookings). Not in the future.",
        requestBody: body("SavingsTransferCreate"),
        responses: { "201": ok("SavingsTransfer", "Created"), ...errors },
      },
    },
    "/api/v1/savings-transfers/{id}": {
      parameters: idParam,
      delete: {
        tags,
        summary: "Delete a savings transfer; its booked statement lines are freed",
        responses: { "204": { description: "Deleted" }, ...errors },
      },
    },
  };
}

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Finance",
      version: "1",
      description:
        "Fixed costs, savings transfers and spending overview. No authentication: the app is only reachable on the LAN and tailnet. Amounts are euros with at most 2 decimals, dates are YYYY-MM-DD.",
    },
    paths: {
      "/api/v1/overview": {
        get: {
          tags: ["Overview"],
          summary: "Calculated overview for a day",
          parameters: [
            { name: "date", in: "query", schema: { type: "string", format: "date" }, description: "Defaults to today (Europe/Amsterdam)" },
            { name: "days", in: "query", schema: { type: "integer", default: 31 }, description: "How many days of upcoming movements" },
          ],
          responses: { "200": { description: "OK" }, ...errors },
        },
      },
      "/api/v1/config": {
        get: { tags: ["Config"], summary: "Settings, incomes and expenses as one document", responses: { "200": ok("Config") } },
        put: {
          tags: ["Config"],
          summary: "Replace settings, incomes and expenses",
          description:
            "Items with an id update that record, items without one are created, records missing from the document are deleted. Balances are not touched.",
          requestBody: body("Config"),
          responses: { "200": ok("Config"), ...errors },
        },
      },
      "/api/v1/settings": {
        get: { tags: ["Settings"], summary: "Transfer settings", responses: { "200": ok("Settings") } },
        put: { tags: ["Settings"], summary: "Replace the transfer settings", requestBody: body("Settings"), responses: { "200": ok("Settings"), ...errors } },
      },
      "/api/v1/scenarios": {
        get: {
          tags: ["Scenario"],
          summary:
            "Situations to compare, real one first. Exactly one is real: the overview and transfers use it. Incomes and expenses list their scenarioIds (null = all).",
          responses: { "200": list("Scenario") },
        },
        post: { tags: ["Scenario"], summary: "Create a scenario", requestBody: body("ScenarioCreate"), responses: { "201": ok("Scenario", "Created"), ...errors } },
      },
      "/api/v1/scenarios/{id}": {
        parameters: idParam,
        patch: {
          tags: ["Scenario"],
          summary: "Rename, or make it the real scenario (real: true)",
          requestBody: body("ScenarioPatch"),
          responses: { "200": ok("Scenario"), ...errors },
        },
        delete: {
          tags: ["Scenario"],
          summary: "Delete a scenario (not the real one). Items only in it are deleted, others lose it.",
          responses: { "204": { description: "Deleted" }, "409": ok("Error", "Real scenario or linked income"), ...errors },
        },
      },
      ...savingsPaths(),
      ...savingsTransferPaths(),
      ...crud("Income", "incomes", "Income"),
      ...crud("Expense", "expenses", "Expense"),
      ...spendingPaths(),
      ...oneOffIncomePaths(),
      ...crud("Outing", "outings", "Outing"),
      ...crud("Counterparty", "counterparties", "Counterparty"),
      "/api/v1/bookings": {
        post: {
          tags: ["Booking"],
          summary:
            "Book statement lines, all or nothing: each item turns its lines into one spending (`spending`), one one-off income (`income`), one savings transfer (`savings`: current-account lines to or from a savings account, `account` = id, name or IBAN; amount defaults to the lines' sum, bank sign, date to the first line's) or skips them (`skip`). An already booked line is a 409. Returns the created spending, one-off income or savings transfer per item (null when skipped).",
          requestBody: body("Bookings"),
          responses: {
            "201": { description: "Booked", content: { "application/json": { schema: { type: "array", items: { anyOf: [ref("Spending"), ref("OneOffIncome"), ref("SavingsTransfer"), { type: "null" }] } } } } },
            "409": ok("Error", "A line is already booked"),
            ...errors,
          },
        },
      },
      "/api/v1/booked-lines": {
        get: {
          tags: ["Booking"],
          summary: "Booked statement lines by booking date, to leave them out of the next export",
          parameters: [
            { name: "from", in: "query", schema: { type: "string", format: "date" } },
            { name: "to", in: "query", schema: { type: "string", format: "date" } },
          ],
          responses: { "200": list("BookedLine"), ...errors },
        },
        delete: {
          tags: ["Booking"],
          summary: "Un-skip a line. Lines of a spending, one-off income or savings transfer are freed by deleting that.",
          parameters: [{ name: "key", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            "204": { description: "Deleted" },
            "409": ok("Error", "Line belongs to a spending, one-off income or savings transfer"),
            ...errors,
          },
        },
      },
      "/api/v1/booked-lines/convert-to-savings": {
        post: {
          tags: ["Booking"],
          summary:
            "Turn a skipped line (own-account transfer) into a savings transfer with the line's date and amount, without un-booking it. The skip reason is cleared (it becomes the default description) and the line links the transfer.",
          requestBody: body("ConvertToSavings"),
          responses: {
            "201": ok("SavingsTransfer", "Converted"),
            "409": ok("Error", "Line isn't (only) skipped"),
            ...errors,
          },
        },
      },
      "/api/v1/categories": {
        get: { tags: ["Category"], summary: "List categories", responses: { "200": list("Category") } },
        post: { tags: ["Category"], summary: "Create a category", requestBody: body("CategoryCreate"), responses: { "201": ok("Category", "Created"), ...errors } },
      },
      "/api/v1/categories/{id}": {
        parameters: idParam,
        patch: { tags: ["Category"], summary: "Rename a category", requestBody: body("CategoryCreate"), responses: { "200": ok("Category"), ...errors } },
        delete: { tags: ["Category"], summary: "Delete a category; its spendings and counterparties lose it", responses: { "204": { description: "Deleted" }, ...errors } },
      },
      "/api/v1/balances": {
        get: {
          tags: ["Balance"],
          summary: "Checkpoints (real balances), newest first",
          parameters: [
            { name: "account", in: "query", schema: { type: "string", enum: ["current", "fixed", "savings"] } },
            { name: "savingsAccountId", in: "query", schema: { type: "integer" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 100 } },
          ],
          responses: { "200": list("Balance"), ...errors },
        },
        post: {
          tags: ["Balance"],
          summary: "Record a checkpoint: the real balance at the end of `date` (default today), or at `time`. Not in the future.",
          requestBody: body("BalanceCreate"),
          responses: { "201": ok("Balance", "Created"), ...errors },
        },
      },
      "/api/v1/balances/{id}": {
        parameters: idParam,
        delete: { tags: ["Balance"], summary: "Delete a checkpoint", responses: { "204": { description: "Deleted" }, ...errors } },
      },
      "/api/v1/reconciliation": {
        get: {
          tags: ["Balance"],
          summary:
            "Expected balance of an account: each checkpoint compared with the one before plus the planned incomes, expenses, transfers (real scenario), spendings and one-off incomes (current account), savings transfers (both accounts) and planned withdrawals after today (savings) in between. Returns `expected` (end of `to`), `checkpoints` (with expected and difference = real − expected), `since` (changes after the last checkpoint) and `days` (expected balance per day from `from`).",
          parameters: [
            { name: "account", in: "query", required: true, schema: { type: "string", enum: ["current", "fixed", "savings"] } },
            { name: "savingsAccountId", in: "query", schema: { type: "integer" }, description: "Required for savings" },
            { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "Default: 30 days before `to`" },
            { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "Default: today" },
          ],
          responses: { "200": { description: "OK" }, ...errors },
        },
      },
    },
    components: {
      schemas: {
        Income: schema(incomeDto),
        IncomeCreate: schema(incomeCreate),
        IncomePatch: schema(incomePatch),
        Expense: schema(expenseDto),
        ExpenseCreate: schema(expenseCreate),
        ExpensePatch: schema(expensePatch),
        Settings: schema(settingsSchema),
        Scenario: schema(scenarioDto),
        ScenarioCreate: schema(scenarioCreate),
        ScenarioPatch: schema(scenarioPatch),
        SavingsAccount: schema(savingsAccountDto),
        SavingsAccountCreate: schema(savingsAccountCreate),
        SavingsAccountPatch: schema(savingsAccountPatch),
        SavingsTransfer: schema(savingsTransferDto),
        SavingsTransferCreate: schema(savingsTransferCreate),
        ConvertToSavings: schema(convertToSavings),
        Spending: schema(spendingDto),
        SpendingCreate: schema(spendingCreate),
        SpendingPatch: schema(spendingPatch),
        OneOffIncome: schema(oneOffIncomeDto),
        OneOffIncomeCreate: schema(oneOffIncomeCreate),
        OneOffIncomePatch: schema(oneOffIncomePatch),
        Outing: schema(outingDto),
        OutingCreate: schema(outingCreate),
        OutingPatch: schema(outingPatch),
        Counterparty: schema(counterpartyDto),
        CounterpartyCreate: schema(counterpartyCreate),
        CounterpartyPatch: schema(counterpartyPatch),
        Bookings: schema(bookings),
        BookedLine: schema(bookedLineDto),
        Category: schema(categoryDto),
        CategoryCreate: schema(categoryCreate),
        Balance: schema(balanceDto),
        BalanceCreate: schema(balanceCreate),
        Config: schema(configSchema),
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            issues: {
              type: "array",
              items: { type: "object", properties: { path: { type: "string" }, message: { type: "string" } } },
            },
          },
          required: ["error"],
        },
      },
    },
  };
}
