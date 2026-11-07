import {
  balanceCreate,
  balanceDto,
  categoryCreate,
  categoryDto,
  configSchema,
  counterpartyCreate,
  counterpartyDto,
  counterpartyPatch,
  expenseCreate,
  importResult,
  expenseDto,
  expensePatch,
  incomeCreate,
  incomeDto,
  incomePatch,
  outingCreate,
  outingDto,
  outingPatch,
  settingsSchema,
  spendingCreate,
  spendingDto,
  spendingPatch,
  statementImport,
  statementLineDto,
  statementLinePatch,
  statementLineSpending,
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
      ...crud("Income", "incomes", "Income"),
      ...crud("Expense", "expenses", "Expense"),
      ...spendingPaths(),
      ...crud("Outing", "outings", "Outing"),
      ...crud("Counterparty", "counterparties", "Counterparty"),
      "/api/v1/categories": {
        get: { tags: ["Category"], summary: "List categories", responses: { "200": list("Category") } },
        post: { tags: ["Category"], summary: "Create a category", requestBody: body("CategoryCreate"), responses: { "201": ok("Category", "Created"), ...errors } },
      },
      "/api/v1/categories/{id}": {
        parameters: idParam,
        patch: { tags: ["Category"], summary: "Rename a category", requestBody: body("CategoryCreate"), responses: { "200": ok("Category"), ...errors } },
        delete: { tags: ["Category"], summary: "Delete a category; its spendings and counterparties lose it", responses: { "204": { description: "Deleted" }, ...errors } },
      },
      "/api/v1/statements": {
        post: {
          tags: ["Statement"],
          summary: "Import an ABN AMRO TXT/TAB export",
          description:
            "JSON { account, text }, or the raw export as text/plain with ?account=fixed|current. Lines already imported are skipped, so overlapping exports are fine. Records the last end balance and processes every open line: a matching counterparty (its `match` in the name, else its IBAN) with mode spending makes a spending, skip skips it, review and unmatched lines stay open. Any bad line rejects the whole file.",
          requestBody: body("StatementImport"),
          responses: { "201": ok("ImportResult", "Imported"), ...errors },
        },
      },
      "/api/v1/statement-lines": {
        get: {
          tags: ["Statement"],
          summary: "Imported statement lines, newest first",
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["open", "spending", "skipped"] } },
            { name: "account", in: "query", schema: { type: "string", enum: ["fixed", "current"] } },
            { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "Inclusive" },
            { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "Inclusive" },
          ],
          responses: { "200": list("StatementLine"), ...errors },
        },
      },
      "/api/v1/statement-lines/process": {
        post: {
          tags: ["Statement"],
          summary: "Process open lines again, e.g. after adding counterparties",
          responses: { "200": { description: "Counts of new spendings, skipped and still open lines" } },
        },
      },
      "/api/v1/statement-lines/{id}": {
        parameters: idParam,
        get: { tags: ["Statement"], summary: "Get a statement line", responses: { "200": ok("StatementLine"), ...errors } },
        patch: {
          tags: ["Statement"],
          summary: "Skip a line (deletes its spending) or reopen it",
          requestBody: body("StatementLinePatch"),
          responses: { "200": ok("StatementLine"), ...errors },
        },
      },
      "/api/v1/statement-lines/{id}/spending": {
        parameters: idParam,
        post: {
          tags: ["Statement"],
          summary: "Make a spending from a line",
          description: "Every field is optional: date (payment day), amount, description and counterparty come from the line, the category from the counterparty.",
          requestBody: { required: false, content: { "application/json": { schema: ref("StatementLineSpending") } } },
          responses: { "201": ok("Spending", "Created"), ...errors, "409": ok("Error", "Line already has a spending") },
        },
      },
      "/api/v1/balances": {
        get: {
          tags: ["Balance"],
          summary: "Balance history, newest first",
          parameters: [
            { name: "account", in: "query", schema: { type: "string", enum: ["fixed", "current"] } },
            { name: "limit", in: "query", schema: { type: "integer", default: 100 } },
          ],
          responses: { "200": list("Balance"), ...errors },
        },
        post: { tags: ["Balance"], summary: "Record a balance", requestBody: body("BalanceCreate"), responses: { "201": ok("Balance", "Created"), ...errors } },
      },
      "/api/v1/balances/{id}": {
        parameters: idParam,
        delete: { tags: ["Balance"], summary: "Delete a balance", responses: { "204": { description: "Deleted" }, ...errors } },
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
        Spending: schema(spendingDto),
        SpendingCreate: schema(spendingCreate),
        SpendingPatch: schema(spendingPatch),
        Outing: schema(outingDto),
        OutingCreate: schema(outingCreate),
        OutingPatch: schema(outingPatch),
        Counterparty: schema(counterpartyDto),
        CounterpartyCreate: schema(counterpartyCreate),
        CounterpartyPatch: schema(counterpartyPatch),
        Category: schema(categoryDto),
        CategoryCreate: schema(categoryCreate),
        Balance: schema(balanceDto),
        BalanceCreate: schema(balanceCreate),
        Config: schema(configSchema),
        StatementImport: schema(statementImport),
        ImportResult: schema(importResult),
        StatementLine: schema(statementLineDto),
        StatementLinePatch: schema(statementLinePatch),
        StatementLineSpending: schema(statementLineSpending),
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
