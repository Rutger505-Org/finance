import {
  balanceCreate,
  balanceDto,
  configSchema,
  expenseCreate,
  expenseDto,
  expensePatch,
  incomeCreate,
  incomeDto,
  incomePatch,
  settingsSchema,
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
