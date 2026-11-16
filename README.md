# finance

Overview of fixed costs, the transfers to the fixed-costs account and what's free to spend on the current account, plus one-off spendings. Next.js + SQLite (Drizzle), no authentication: there is one user and the app is only reachable on the LAN and tailnet, at https://finance.homelab.rutgerpronk.com.

## What it calculates

- **Fixed-costs account, required balance:** every expense is an envelope that gets its share of each transfer. "Reserved" is the least it must hold today so it never runs short in the next two years; the target is the sum. A 28-day gym can need more than one charge, because it sometimes falls twice between two transfers.
- **Expense account:** `fixed` is a direct debit from the fixed-costs account. `current` is paid from the current account; the day before the due date the reserved money moves back to the current account.
- **Transfers:** a list, each with its own cycle (e.g. the day after each income). Amount: euros (fixed), `{ "income": <id> }` (that whole income; it can't be deleted while linked, inactive gives 0) or `auto`. Fixed and income amounts count first; the auto transfers split the rest of the average need, rounded up to the cent per transfer. Anything above the need builds a buffer. Each transfer carries every expense in proportion to its share of all transferred money.
- **Free to spend:** latest current-account balance + incomes until the next payment of the main income − transfers in that period. Refunds don't count, that money is already spent on its expense. Spendings and one-off incomes don't count either: they show up in the next balance.
- **Balances (checkpoints):** the real balance of an account (current, fixed-costs or a savings account) at the end of a day, or at a time that day (spendings and one-off incomes later that day come after it). The expected balance is the checkpoint before plus what happened since: the real scenario's incomes, transfers, money moved back and expenses, the spendings and one-off incomes (current account), savings transfers (both sides) and planned withdrawals after today (savings). Each checkpoint shows how far it is off; something missing or wrong in the app shows up there. The overview uses the latest balance per account up to that day.
- **Savings accounts:** several, each with an optional IBAN (unique), a balance (latest checkpoint plus the transfers after it), planned withdrawals and optionally a last month: what's free after the withdrawals is spread over the months until then and counts in the monthly budget of the account's scenarios. Only planned withdrawals after today count; earlier ones are history, what really happened is a transfer.
- **Savings transfers:** a savings account can only move money to or from the current account, so every real movement is a line on the current account's statement. A transfer has a date, optional time, amount (positive = savings → current, negative = current → savings) and description; it changes both accounts' expected balance. Booked from the statement like a spending, or added by hand on Spaargeld.

- **One-off spendings:** date, time (`HH:MM`, optional: payment time from the statement line), amount (negative = money back, e.g. a Tikkie), description. Category = what it was on (Drinken, Eten, ...; editable, seeded by the migration). Outing = what it was for (a party); spendings on other days, like a ticket bought months earlier, belong to it too.
- **One-off incomes:** money in on the current account that isn't a regular income: something sold second-hand, a contribution from family. Same fields as a spending without category and outing, amount always positive. Kept apart from spendings; money back for a spending (Tikkie) stays a negative spending.
- **Counterparties:** what is known about who is behind a bank statement line: real name, IBANs and parts of the name on the line (aliases, each belongs to one counterparty), default category, handling (`spending`; `income` for one-off incomes; `skip` for fixed costs, own accounts, regular income; `ask` when it depends on the line) and a note. A new spending to a counterparty without a category gets its default.
- **Bookings:** the app doesn't import statements. An agent reads the export and books it through the API: each booking turns one or more statement lines into one spending, one-off income or savings transfer, or skips them with a reason. Only the line key (account|date|balance before|balance after|description), date and amount are kept, so an overlapping export never books a line twice. Deleting a spending, one-off income or savings transfer frees its lines.

Cycles: `monthly` (`day`, moved to the last day of shorter months), `yearly` (`month`, `day`), `interval` (`days` + an `anchor` date of any known occurrence).

## Using it

- **UI:** Overzicht (dashboard: free to spend, this month vs last month, per week, top categories and counterparties, outings, balances, fun facts), Posten (incomes, fixed costs and the transfers to the fixed-costs account, per scenario; for the real one also the required balance of the fixed-costs account per expense, any day via `?datum=YYYY-MM-DD`), Saldo (checkpoints, expected balance per account, chart of the last two months), Spaargeld (savings accounts), Uitgaven with subpages: per maand (`?maand=YYYY-MM`, with the month's one-off incomes and net), Losse inkomsten (`?maand=YYYY-MM`), Uitjes (outings with totals per category), Tegenrekeningen, Categorieën.
- **API:** `/api/v1`, spec at `/api/v1/openapi.json`. Amounts are euros (max 2 decimals), dates `YYYY-MM-DD`, times `HH:MM`.
  - `GET /overview?date=&days=`
  - `GET|PUT /config`: settings + incomes + expenses. Items with an `id` are updated, without one created, missing ones deleted. Balances are not touched.
  - `GET|POST /incomes`, `GET|PATCH|DELETE /incomes/{id}`, same for `/expenses`
  - `GET|PUT /settings`
  - `GET|POST /spendings` (`?from=&to=&categoryId=&outingId=&counterpartyId=`), `GET|PATCH|DELETE /spendings/{id}`, same for `/outings` and `/counterparties` (`ibans`, `names` replace the saved aliases)
  - `GET|POST /one-off-incomes` (`?from=&to=&counterpartyId=`), `GET|PATCH|DELETE /one-off-incomes/{id}`
  - `POST /bookings` (`[{ lines: [{ key, date, amount }], spending: {...} }`, or `income: {...}` (as `POST /one-off-incomes`), `savings: { account, description, note?, date?, time?, amount? }` (`account`: id, name or IBAN; amount defaults to the lines' sum, bank sign, date to the first line's) or `skip: "reason"` instead of `spending`), all or nothing, 409 if a line is already booked; `GET /booked-lines?from=&to=`; `DELETE /booked-lines?key=` (un-skip)
  - `POST /booked-lines/convert-to-savings` (`{ key, account, description?, note? }`): a skipped line (own account) becomes a savings transfer with its date and amount, without un-booking; the skip reason is cleared and is the default description. 409 unless the line is only skipped
  - `GET|POST /savings-transfers` (`?savingsAccountId=&from=&to=`; POST `{ savingsAccountId, amount, description, date?, time?, note? }`, not in the future), `DELETE /savings-transfers/{id}` (frees its lines)
  - `GET|POST /categories`, `PATCH|DELETE /categories/{id}`. Deleting a category, outing or counterparty keeps its spendings (and one-off incomes), unlinked.
  - `GET|POST /balances` (`?account=current|fixed|savings&savingsAccountId=&limit=`; POST `{ account, savingsAccountId?, amount, date?, time? }`, not in the future), `DELETE /balances/{id}`
  - `GET /reconciliation?account=&savingsAccountId=&from=&to=`: expected balance, checkpoints with expected + difference, changes since the last one, balance per day
  - `GET|POST /savings-accounts`, `GET|PATCH|DELETE /savings-accounts/{id}` (POST may include the first checkpoint as `balance: { amount, date }`)

```sh
curl -s https://finance.homelab.rutgerpronk.com/api/v1/overview | jq
curl -s -X POST -H 'content-type: application/json' \
  -d '{"account":"current","amount":450}' https://finance.homelab.rutgerpronk.com/api/v1/balances
```

## Running with Docker

```sh
docker compose up -d --build   # http://localhost:3000, migrates on every start
git pull && docker compose up -d --build   # update
```

Data lives in the `finance-data` volume (`docker compose down -v` deletes it). The app restarts with Docker; enable "Start Docker Desktop when you sign in" to have it running after boot. `PORT` and `TIME_ZONE` can be overridden in a `.env` next to `compose.yaml`. There is no auth: keep it local.

Update banner: compose passes `.git` to the build (`git-dir` context), the image keeps the commit in `commit.txt`, and `/api/update` compares it hourly with `main` on GitHub (`src/server/update.ts`). Behind → a banner above the header with the update command. Images built without it (CI, plain `docker build`) have no commit and never show it. Needs BuildKit (buildx, part of Docker Desktop).

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

The user periodically exports bank-statement transactions for both the current and fixed-costs accounts. Compare those transactions with the configured incomes, expenses and automatic transfer amount in the config (`GET /api/v1/config`) to validate that surplus transfers are set up correctly. The final balance of an export can be saved as a checkpoint (`POST /balances`) to see whether everything is booked. Treat statement exports as sensitive financial data and only use them for the requested check.
