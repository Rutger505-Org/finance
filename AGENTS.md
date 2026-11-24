# finance

Personal finance app (Next.js + SQLite/Drizzle, no auth). What it calculates, dev commands, Docker, deploy: README.md. API spec: `/api/v1/openapi.json`.

## Rules
- **Main only**: commit + push to `main`; every push deploys production (shared workflow in kubernetes-infrastructure, no PR previews, no path filters: docs pushes deploy too).
- **Public repo**: never put real personal data (names, amounts, pay days, IBANs, places, outings) in code, tests, fixtures, placeholders or commit messages. Mock data only (Salaris 500, Telefoon 20, IBAN NL91ABNA0417164300). Check the diff before pushing.
- **No import feature** in the app: an agent reads bank exports and books lines through the API (README "Bookings").
- **Compose must work from a fresh clone**: someone runs it on their own laptop (Docker Desktop, own empty DB, migrations on every start, update banner via `.git` build context). Test with the local `finance` image removed.
- **Before committing**: `bun test && bun run typecheck && bun run lint`; `bun db:generate` after changing `src/server/db/schema.ts`.

## Layout
- Pure calculations `src/lib/finance`, DB access `src/server/finance/repository.ts`, zod schemas `src/lib/finance/schemas.ts` (shared by API, forms, JSON editor).
- Prod: MetalLB `192.168.178.234`, behind homelab Caddy at https://finance.homelab.rutgerpronk.com (LAN + tailnet). SQLite on a `local-path` PVC, no backups.
