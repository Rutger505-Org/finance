FROM oven/bun:1-alpine AS base

WORKDIR /app


FROM base AS development

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["bun", "run", "dev"]


FROM base AS deps

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile


# Empty unless compose.yaml passes the repo's .git as the "git-dir" build context.
FROM scratch AS git-dir


FROM base AS builder

# Client side environment variables must be set here.
# They won't be read from .env file during runtime

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN SKIP_ENV_VALIDATION=1 bun run build

# Commit this build is from, for the update banner (src/server/update.ts). Empty without git-dir.
RUN --mount=from=git-dir,target=/git \
    head=$(cat /git/HEAD 2>/dev/null); \
    case "$head" in \
      "ref: "*) ref=${head#ref: }; \
        commit=$(cat "/git/$ref" 2>/dev/null || grep " $ref\$" /git/packed-refs 2>/dev/null | cut -d" " -f1) ;; \
      *) commit=$head ;; \
    esac; \
    echo "$commit" > commit.txt


FROM base AS production

ENV NODE_ENV=production

RUN bun install drizzle-kit@0.31.1 drizzle-orm@0.43.1 @libsql/client@0.14.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

RUN chown -R nextjs:nodejs /app

# Migrations
COPY --chown=nextjs:nodejs package.json bun.lock ./
COPY --chown=nextjs:nodejs drizzle.config.ts ./
COPY --chown=nextjs:nodejs drizzle ./drizzle

# Web application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/commit.txt ./

EXPOSE 3000
ENV PORT=3000

ENV HOSTNAME="0.0.0.0"
CMD ["bun", "server.js"]

