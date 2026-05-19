# Usage

This document covers the runtime behavior, storage model, API surface, and contribution workflow for Zeus. The README stays focused on setup and project overview.

## Runtime Model

Zeus runs as two cooperating parts:

- A Next.js app that serves the admin dashboard, client portal, and API routes
- A Discord bot process that handles slash commands and reports usage back to the panel

When `bun run dev` starts, the supervisor script:

1. Reads settings from the active storage backend
2. Syncs bot settings into `src/bot/config.json`
3. Deploys enabled guild slash commands when Discord is configured
4. Starts the bot when `discordBot.enabled` is true and `DISCORD_BOT_TOKEN` is set
5. Starts the web app on `PORT`, default `9002`

`bun run start` uses the same supervised model for production. If the bot cannot start, the panel remains online.

## Runtime Settings

Deployment-specific settings are managed from the dashboard and stored in the active backend.

Settings include:

- Admin API enablement and endpoint toggles
- Client portal enablement and accent color
- License validation response fields
- BuiltByBit webhook and placeholder settings
- Discord bot client ID, guild ID, client secret, admin IDs, command toggles, and presence
- Webhook audit logging settings

In JSON mode, settings are stored in `data/settings.json`. In PostgreSQL mode, settings are stored in PostgreSQL.

## Storage Backends

Zeus supports JSON and PostgreSQL through the same data access layer.

Important storage files:

- `src/lib/data-store.js` handles backend selection, PostgreSQL schema setup, JSON reads and writes, and storage migration
- `src/lib/data.ts` is the Next.js server-side data access layer
- `src/lib/data-access.js` is the Discord bot data access layer

PostgreSQL mode creates relational tables for:

- Settings
- Products
- Licenses
- Platform account links
- Validation logs
- Bot logs
- Vouchers
- Blacklist entries
- Schema metadata

The default PostgreSQL table prefix is `zeus_store`. Override it with `POSTGRESQL_TABLE`.

## Storage Migration

When the active backend changes, the dashboard checks the inactive backend for existing data.

Examples:

- `DB=JSON` to `DB=POSTGRESQL`: the dashboard checks JSON files for data that should be copied into PostgreSQL
- `DB=POSTGRESQL` to `DB=JSON`: the dashboard checks PostgreSQL for data that should be copied into JSON files

If source data is found, the admin dashboard shows a migration prompt after sign-in. Confirming the prompt copies and merges the inactive backend into the active backend.

Migration behavior:

- Source data is not deleted
- Destination data is backed up before migration
- Backups are written under `data/migration-backups/`
- Products, licenses, platform links, logs, bot logs, vouchers, blacklist entries, and settings are included
- PostgreSQL writes run through the relational schema
- PostgreSQL migration validates duplicate keys and unsupported enum values before writing

For PostgreSQL to JSON migration, keep the PostgreSQL connection string configured while `DB=JSON` is active. Without it, Zeus cannot read the inactive PostgreSQL backend.

## Auth Model

Admin access uses signed HTTP-only session cookies. Admin credentials come from:

- `LOGIN_EMAIL`
- `LOGIN_PASSWORD`
- `SESSION_SECRET`

The admin login route is `/admin/login`.

Client access uses Discord OAuth. The public client login route is `/login`, and authenticated users land on `/client`. If the client portal is disabled in settings, client routes do not expose the portal experience.

Admin API access uses the `x-api-key` header. The key is managed from dashboard settings. Admin API endpoints are rate limited and can be enabled or disabled individually.

## API Surface

Main external routes:

- `POST /api/validate` for license validation
- `GET /api/admin/licenses` for admin license listing
- `POST /api/admin/licenses` for admin license creation
- `PATCH /api/admin/licenses/[key]` for license updates
- `DELETE /api/admin/licenses/[key]` for license deletion
- `PATCH /api/admin/licenses/[key]/renew` for license renewal
- `PATCH /api/admin/licenses/[key]/identities` for IP and HWID updates
- `POST /api/admin/licenses/[key]/sub-users` for adding sub-users
- `DELETE /api/admin/licenses/[key]/sub-users` for removing sub-users
- `POST /api/webhooks/builtbybit` for BuiltByBit webhook automation
- `POST /api/webhooks/builtbybit/placeholder` for placeholder purchase automation
- `GET /api/bot/status` for dashboard bot status checks
- `POST /api/bot/log-usage` for bot usage logging

## Operational Notes

- JSON mode stores application state in `data/`. Back up this directory.
- PostgreSQL mode stores application state in the configured database. Back up the database.
- Keep migration backups until the migrated deployment has been verified.
- Slash commands are deployed as guild commands so changes apply quickly.
- The dashboard reads local bot status from `http://localhost:8081/status`.
- Validation logs can include IP address, HWID, Discord ID, product context, result, and public IP geolocation data.

## Development Commands

```bash
bun run dev
bun run typecheck
bun run lint
bun run build
bun run start
```

`bun run check` runs typecheck and lint together.

## Extension Points

Common extension points:

- Add routes or server endpoints under `src/app`
- Add dashboard and portal UI under `src/components`
- Add bot commands under `src/bot/commands`
- Extend storage through `src/lib/data-store.js`, `src/lib/data.ts`, and `src/lib/data-access.js`
- Add server mutations in `src/lib/actions.ts`
- Extend settings validation in `src/lib/settings-validation.ts`

Keep new persistence behavior behind the shared data layer so the dashboard, API routes, and Discord bot stay consistent.
