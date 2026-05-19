<h1 align="center">
  <img src="https://user-gen-media-assets.s3.amazonaws.com/seedream_images/a2746fa4-428d-48a0-b1e5-0264501d7ece.png" alt="Zeus Banner" width="50%" height="50%">
</h1>

<p align="center">
  <div align="center">
    <h3>Zeus Open Source License Management System</h3>
    <a href="https://discord.com/invite/CR7s2aEf9T">
      <img src="https://img.shields.io/discord/829037998552121365?style=flat&logo=discord&color=5865F2" alt="Discord Server" />
    </a>
    <a href="https://github.com/unt1tler/Zeus/graphs/contributors">
      <img src="https://img.shields.io/github/contributors/unt1tler/Zeus?style=flat-square" alt="Contributors">
    </a>
    <a href="https://github.com/unt1tler/Zeus/forks">
      <img src="https://img.shields.io/github/forks/unt1tler/Zeus?style=flat-square" alt="Forks">
    </a>
    <a href="https://github.com/unt1tler/Zeus/stargazers">
      <img src="https://img.shields.io/github/stars/unt1tler/Zeus?style=flat-square" alt="Stars">
    </a>
    <a href="https://github.com/unt1tler/Zeus/issues">
      <img src="https://img.shields.io/github/issues/unt1tler/Zeus?style=flat-square" alt="Issues">
    </a>
  </div>
  <hr />
</p>

## Overview

Zeus is a self-hosted license management system for digital products, subscriptions, and access-controlled resources. It provides an admin dashboard, a Discord-authenticated client portal, a Discord bot, and API endpoints for license validation and provisioning.

Zeus uses JSON files by default for simple deployments. PostgreSQL is also supported for shared storage, managed hosting, and deployments with more than one running process.

The project takes inspiration from panels such as Phantom and Sun Licenses while keeping setup, maintenance, and extension points straightforward.

> [!NOTE]
> Zeus is still moving quickly. If you run into a bug or an edge case, open an issue.

## What Zeus Handles

- Product management
- License creation, renewal, activation, deactivation, and deletion
- Customer records with owner and sub-user relationships
- Voucher creation and redemption
- IP, HWID, and Discord ID blacklist controls
- License validation with configurable response fields
- BuiltByBit webhook and placeholder purchase flows
- Discord bot commands for staff and customers
- Dashboard reporting for validations, customers, webhook activity, and bot usage

## Tech Stack

- Next.js App Router
- React and TypeScript
- Bun runtime and package manager
- Discord.js for bot commands
- Tailwind CSS and Radix UI primitives
- JSON file storage by default
- PostgreSQL relational storage as an optional backend

## Storage

Zeus supports two storage backends:

- `DB=JSON`, the default, stores application data in `data/`
- `DB=POSTGRESQL` stores application data in PostgreSQL

PostgreSQL mode creates relational tables for settings, products, licenses, platform links, validation logs, bot logs, vouchers, blacklist entries, and schema metadata. The dashboard, API routes, and Discord bot use the same storage layer.

When switching between JSON and PostgreSQL, the admin dashboard checks the inactive backend for existing data. If data is found, the dashboard shows a migration prompt after admin sign-in. Migration copies and merges data into the active backend, leaves the source backend unchanged, and writes a destination backup to `data/migration-backups/`.

## Local Development

1. Clone the repository and install dependencies.

```bash
git clone https://github.com/unt1tler/Zeus.git
cd Zeus
bun install
```

2. Copy `.env.example` to `.env` and set the required values.

3. Start the app.

```bash
bun run dev
```

4. Open `http://localhost:9002/admin/login`.

5. Sign in with `LOGIN_EMAIL` and `LOGIN_PASSWORD`.

6. Configure panel URL, admin API settings, Discord settings, and integration settings from the dashboard.

If you only need the admin panel, the Discord bot can stay disabled. If you need the client portal or slash commands, configure Discord settings in the dashboard and provide `DISCORD_BOT_TOKEN`.

## Environment Configuration

Required:

- `LOGIN_EMAIL`
- `LOGIN_PASSWORD`
- `SESSION_SECRET`

Common optional values:

- `PORT`, defaults to `9002`
- `DISCORD_BOT_TOKEN`
- `TRUST_X_FORWARDED_FOR=true` when running behind a trusted reverse proxy
- `SESSION_COOKIE_SECURE=true|false` to override secure cookie behavior
- `DB=JSON` or `DB=POSTGRESQL`
- `postgresql_db` for the PostgreSQL connection string
- `POSTGRESQL_TABLE`, default `zeus_store`
- `POSTGRESQL_POOL_MAX`, default `10`
- `POSTGRESQL_SSL_REJECT_UNAUTHORIZED=true|false`

For PostgreSQL:

```env
DB=POSTGRESQL
postgresql_db=postgres://user:password@host:5432/database?sslmode=require
```

For PostgreSQL to JSON migration, keep the PostgreSQL connection string available while `DB=JSON` is active so Zeus can read the old source backend.

```env
DB=JSON
postgresql_db=postgres://user:password@host:5432/database?sslmode=require
```

`INTERNAL_PANEL_URL` and `API_KEY` are only needed when running the bot separately. The bundled dev and start scripts inject those values from dashboard settings.

## Project Layout

```text
src/app            Next.js routes, layouts, pages, and API endpoints
src/components     Dashboard, client portal, and integration UI
src/lib            Auth, data access, server actions, settings, and utilities
src/bot            Discord bot runtime and command handlers
data               JSON storage and migration backups
scripts            Startup, build, sync, and maintenance scripts
public             Static assets
```

## Documentation

Usage details, runtime behavior, API routes, storage notes, and contribution guidance are in [USAGE.md](./USAGE.md).

## Build and Start

```bash
bun run build
bun run start
```

`bun run build` builds the Next.js app and attempts Discord command deployment first. Missing or invalid Discord credentials do not stop the web build. `bun run start` runs the panel and bot under one supervisor process.

## Screenshots

<details>
<summary>Panel</summary>

<img width="1902" height="863" alt="Dashboard screenshot" src="https://github.com/user-attachments/assets/a57c7975-60ce-48d2-84ac-5413306887f2" />
<img width="1900" height="867" alt="License management screenshot" src="https://github.com/user-attachments/assets/2e6d5e1c-db2b-4c89-8481-7e2ab8cea113" />
<img width="1900" height="857" alt="Records screenshot" src="https://github.com/user-attachments/assets/bf0d5392-bacc-4501-8bfb-90d62a875810" />
<img width="1904" height="867" alt="Customers screenshot" src="https://github.com/user-attachments/assets/2ee49436-aa8a-40e0-a67b-90a3eb6129ab" />
<img width="1903" height="861" alt="Settings screenshot" src="https://github.com/user-attachments/assets/e29db1a7-2747-4f6f-ba26-d7568c2a65de" />
<img width="1905" height="864" alt="Integration screenshot" src="https://github.com/user-attachments/assets/5f35eb74-33c9-4855-b74e-ee1ef560d466" />

</details>

<details>
<summary>Discord Bot</summary>

<img width="966" height="427" alt="Discord bot command screenshot" src="https://github.com/user-attachments/assets/73aa4cda-f0ea-4096-ba52-53c3975aba4e" />
<img width="1144" height="672" alt="Discord bot license screenshot" src="https://github.com/user-attachments/assets/1a49dfb5-7c22-4916-b13a-05d08f302e04" />
<img width="997" height="482" alt="Discord bot customer screenshot" src="https://github.com/user-attachments/assets/1dbb4e24-f5e9-4d1c-8122-ca0ddf3874fc" />
<img width="778" height="369" alt="Discord bot redemption screenshot" src="https://github.com/user-attachments/assets/0da39897-9321-472b-966e-2047d46bcd65" />

</details>

## Pull Requests

Before opening a pull request:

1. Keep the change focused.
2. Update docs when behavior or configuration changes.
3. Run `bun run typecheck`.
4. Run `bun run lint`.
5. Run `bun run build` for changes that affect runtime behavior, routes, storage, or the bot.

Open an issue first for larger behavior changes so the direction is clear before implementation.
