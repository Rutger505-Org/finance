# finance

Overview of fixed costs, the transfers to the fixed-costs account and what's free to spend on the current account, plus one-off spendings. Next.js + SQLite (Drizzle), no authentication: there is one user and the app is only reachable on the LAN and tailnet, at https://finance.homelab.rutgerpronk.com.

## What it calculates

- **Fixed-costs account, required balance:** every expense is an envelope that gets its share of each transfer. "Reserved" is the least it must hold today so it never runs short in the next two years; the target is the sum. A 28-day gym can need more than one charge, because it sometimes falls twice between two transfers.
- **Expense account:** `fixed` is a direct debit from the fixed-costs account. `current` is paid from the current account; the day before the due date the reserved money moves back to the current account.
- **Transfers:** a list, each with its own cycle (e.g. the day after each income). Amount: euros (fixed), `{ "income": <id> }` (that whole income; it can't be deleted while linked, inactive gives 0) or `auto`. Fixed and income amounts count first; the auto transfers split the rest of the average need, rounded up to the cent per transfer. Anything above the need builds a buffer. Each transfer carries every expense in proportion to its share of all transferred money.
- **Free to spend:** latest current-account balance + incomes until the next payment of the main income − transfers in that period. Refunds don't count, that money is already spent on its expense.
- **Balances:** the overview uses the latest balance per account up to that day. The fixed-costs balance is projected to today with the planned movements since then.

- **One-off spendings:** date, amount (negative = money back, e.g. a Tikkie), description. Category = what it was on (Drinken, Eten, ...; editable, seeded by the migration). Outing = what it was for (a party); spendings on other days, like a ticket bought months earlier, belong to it too. Counterparties (name, IBAN, default category) identify statement lines; a new spending to a counterparty without a category gets its default.

Cycles: `monthly` (`day`, moved to the last day of shorter months), `yearly` (`month`, `day`), `interval` (`days` + an `anchor` date of any known occurrence).

## Using it

- **UI:** Overzicht (any day via `?datum=YYYY-MM-DD`), Posten (incomes, expenses, transfers), Uitgaven (one-off spendings per month, `?maand=YYYY-MM`), Uitjes (outings with totals per category), Tegenrekeningen (counterparties and categories), JSON (the whole config as one document: copy, paste, save).
- **API:** `/api/v1`, spec at `/api/v1/openapi.json`. Amounts are euros (max 2 decimals), dates `YYYY-MM-DD`.
  - `GET /overview?date=&days=`
  - `GET|PUT /config`: settings + incomes + expenses. Items with an `id` are updated, without one created, missing ones deleted. Balances are not touched.
  - `GET|POST /incomes`, `GET|PATCH|DELETE /incomes/{id}`, same for `/expenses`
  - `GET|PUT /settings`
  - `GET|POST /spendings` (`?from=&to=&categoryId=&outingId=&counterpartyId=`), `GET|PATCH|DELETE /spendings/{id}`, same for `/outings` and `/counterparties`
  - `GET|POST /categories`, `PATCH|DELETE /categories/{id}`. Deleting a category, outing or counterparty keeps its spendings, unlinked.
  - `GET|POST /balances` (`?account=fixed|current&limit=`), `DELETE /balances/{id}`

```sh
curl -s https://finance.homelab.rutgerpronk.com/api/v1/overview | jq
curl -s -X POST -H 'content-type: application/json' \
  -d '{"account":"current","amount":450}' https://finance.homelab.rutgerpronk.com/api/v1/balances
```

## Development

```sh
bun install
bun db:migrate      # creates ./data/db.sqlite
bun dev
bun test && bun run typecheck && bun run lint
bun db:generate     # after changing src/server/db/schema.ts
```

Pure calculation code is in `src/lib/finance`, database access in `src/server/finance/repository.ts`. Validation (zod, `src/lib/finance/schemas.ts`) is shared by the API, the forms and the JSON editor.

## Deploy

Work happens on `main`; every push deploys production through the shared workflow in `kubernetes-infrastructure`. There are no PR previews.

- The service is a MetalLB LoadBalancer on `192.168.178.234`, no ingress. The homelab Caddy (`caddy_routes` in `homelab-infrastructure`) proxies `finance.homelab.rutgerpronk.com` to it.
- The SQLite database lives on a `local-path` PVC. There are no backups.
- Repo variables: `APPLICATION_NAME=finance`, `BASE_DOMAIN=finance.homelab.rutgerpronk.com`. `TIME_ZONE` (default `Europe/Amsterdam`) can be set as `DEPLOYMENT_TIME_ZONE`.

## Checking automatic surplus transfers

The user periodically exports bank-statement transactions for both the current and fixed-costs accounts. Compare those transactions with the configured incomes, expenses and automatic transfer amount in the JSON config (/json) to validate that surplus transfers are set up correctly. The balance-entry page is not part of this workflow; do not ask the user to manually enter balances. Treat statement exports as sensitive financial data and only use them for the requested check.
