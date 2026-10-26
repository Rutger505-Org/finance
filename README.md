# finance

Overview of fixed costs, the transfers to the fixed-costs account and what's free to spend on the current account. Next.js + SQLite (Drizzle), no authentication: there is one user and the app is only reachable on the LAN and tailnet, at https://finance.homelab.rutgerpronk.com.

## What it calculates

- **Fixed-costs account, required balance:** every expense is an envelope that gets its share of each transfer. "Reserved" is the least it must hold today so it never runs short in the next two years; the target is the sum. A 28-day gym can need more than one charge, because it sometimes falls twice between two transfers.
- **Expense account:** `fixed` is a direct debit from the fixed-costs account. `current` is paid from the current account; on the due date the reserved money moves back to the current account.
- **Transfer:** `auto` is the average need per transfer, rounded up to whole euros; the rest builds a buffer.
- **Free to spend:** latest current-account balance + incomes until the next payment of the main income − transfers in that period. Refunds don't count, that money is already spent on its expense.
- **Balances:** the overview uses the latest balance per account up to that day. The fixed-costs balance is projected to today with the planned movements since then.

Cycles: `monthly` (`day`, moved to the last day of shorter months), `yearly` (`month`, `day`), `interval` (`days` + an `anchor` date of any known occurrence).

## Using it

- **UI:** Overzicht (any day via `?datum=YYYY-MM-DD`), Posten (incomes, expenses, transfer), Saldo (balance history), JSON (the whole config as one document: copy, paste, save).
- **API:** `/api/v1`, spec at `/api/v1/openapi.json`. Amounts are euros (max 2 decimals), dates `YYYY-MM-DD`.
  - `GET /overview?date=&days=`
  - `GET|PUT /config`: settings + incomes + expenses. Items with an `id` are updated, without one created, missing ones deleted. Balances are not touched.
  - `GET|POST /incomes`, `GET|PATCH|DELETE /incomes/{id}`, same for `/expenses`
  - `GET|PUT /settings`
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
