
<h1 align="center">
  <img src="https://user-gen-media-assets.s3.amazonaws.com/seedream_images/a2746fa4-428d-48a0-b1e5-0264501d7ece.png" alt="Zeus Banner" width="50%" height="50%">
</h1>

<p align="center">
  <div align="center">
    <h3> Zeus Open Source License Management System</h3>
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

Zeus is a self hosted license management system for teams selling private products, subscriptions, or access controlled resources. It combines an admin dashboard, a Discord authenticated client portal, a Discord bot, and a small set of automation endpoints for validation and provisioning.

The project is intentionally simple to run. The web app is built on Next.js App Router, the bot is built on Discord.js, and persistent state lives in JSON files under `data/`. That makes local setup fast and keeps single instance deployments straightforward. It also means the current storage model is designed around one deployed instance with `data/` treated as the source of truth.

> [!NOTE]
> Zeus is still moving quickly. If you run into a bug or an edge case, open an issue.

The product direction takes cues from panels like Phantom and Sun Licenses, but the implementation here is focused on a smaller operational footprint, simpler setup, and clearer extension points.

Small thanks to Sun Licenses and Ember for some of the early inspiration behind the project.


## What Zeus Handles

- Product management
- License creation, renewal, activation, deactivation, and deletion
- Customer records with owner and sub user relationships
- Voucher generation and redemption flows
- IP, HWID, and Discord based blacklist controls
- License validation with configurable response payloads
- BuiltByBit webhook and placeholder purchase flows
- Discord bot commands for staff and end users
- Dashboard reporting for validations, new customers, webhook activity, and bot usage

## Runtime Model

Zeus ships as two cooperating parts:

- A Next.js app that serves the admin dashboard, client portal, and API routes
- A Discord bot process that handles slash commands and reports usage back to the panel

When you run `bun run dev`, the supervisor script does three things before the web server comes up:

1. Syncs `data/settings.json` into `src/bot/config.json`
2. Deploys enabled guild slash commands if the bot is configured
3. Starts the bot if `discordBot.enabled` is `true` and `DISCORD_BOT_TOKEN` is present

The web app runs on port `9002` by default in both development and production. `bun start` starts the web server and bot as one supervised process, so shutdown and failure handling stay linked. You can override the port with `PORT`.

## Architecture Notes

The current persistence layer is file based and lives entirely under `data/`. Writes are done atomically, and the app uses in process file locks to avoid clobbering concurrent updates inside a single runtime. That is a good fit for local development and small to medium single host deployments.

If you need horizontal scaling, shared storage, or higher write throughput, the place to swap persistence is `src/lib/data.ts`. The rest of the codebase is already structured so the data layer is reasonably isolated.

## Project Layout

```text
src/app            Next.js routes, pages, layouts, and API endpoints
src/components     UI components for the dashboard, client portal, and integrations
src/lib            Auth, data access, server actions, settings validation, and utilities
src/bot            Discord bot runtime, command handlers, and bot config
data               JSON backed application state
scripts            Startup, config sync, and maintenance helpers
public             Static assets
```

The most important files if you are extending the project are:

- `src/lib/data.ts` for persistence
- `src/lib/actions.ts` for server side mutations
- `src/lib/auth.ts` for admin and client session handling
- `src/lib/settings-validation.ts` for settings shape and validation rules
- `src/bot/commands/` for slash command behavior

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

4. Open `http://localhost:9002/admin/login` and sign in with `LOGIN_EMAIL` and `LOGIN_PASSWORD`.

5. Configure the runtime settings from the dashboard, especially `panelUrl`, admin API settings, and Discord settings if you plan to use the bot or client portal.

If you only want the panel, the Discord bot can stay disabled. If you want the client portal or slash commands, finish the Discord configuration in settings and provide a valid `DISCORD_BOT_TOKEN`.

## Environment Configuration

These values are required for a usable local setup:

- `LOGIN_EMAIL`
- `LOGIN_PASSWORD`
- `SESSION_SECRET`

These values are optional, depending on how much of the stack you want to enable:

- `DISCORD_BOT_TOKEN` for the bot runtime, slash command deployment, and Discord user enrichment
- `PORT` to run the panel and bot bridge on a port other than `9002`
- `TRUST_X_FORWARDED_FOR=true` if you are behind a trusted reverse proxy and want the app to read `X-Forwarded-For`
- `SESSION_COOKIE_SECURE=true|false` if you want to explicitly override secure cookie behavior

Two values deserve a note:

- `INTERNAL_PANEL_URL`
- `API_KEY`

If you start the project through the bundled scripts, both are injected into the bot automatically from panel settings. If you run the bot separately, set them yourself.

## Runtime Settings

Operational settings that change per deployment live in `data/settings.json` and can be managed from the dashboard. That includes:

- Admin API enablement and per endpoint toggles
- Client portal enablement and accent color
- Validation response shape
- BuiltByBit webhook mode and placeholder mode settings
- Discord bot client ID, guild ID, client secret, admin IDs, command toggles, and presence
- Webhook based audit logging

The bot configuration is synced into `src/bot/config.json` on startup, so the panel remains the main control surface.

## Auth Model

Admin access is handled with signed HTTP only session cookies and credentials from the environment. The admin entry point is `/admin/login`.

Client access is handled through Discord OAuth. The public client login route is `/login`, and authenticated users land on `/client`. If the client portal is disabled in settings, those routes stay out of the way.

## API Surface

The main external surfaces are:

- `POST /api/validate` for license validation
- `GET /api/admin/licenses` and `POST /api/admin/licenses` for admin API listing and creation
- `PATCH` and `DELETE /api/admin/licenses/[key]` for admin lifecycle actions
- `PATCH /api/admin/licenses/[key]/renew` for renewals
- `PATCH /api/admin/licenses/[key]/identities` and `POST` or `DELETE /api/admin/licenses/[key]/sub-users` for identity management
- `POST /api/webhooks/builtbybit` for BuiltByBit automation
- `POST /api/webhooks/builtbybit/placeholder` for the placeholder flow

The admin API is guarded by `x-api-key`, rate limited, and individually switchable per endpoint from settings.

## Operational Notes

- Validation logs include IP address, HWID, Discord ID, product context, result, and optional geolocation data for public IPs.
- Slash commands are deployed as guild commands, so command updates apply quickly once the bot is configured.
- The dashboard uses the local bot status endpoint on `http://localhost:8081/status` to report whether the bot is online.
- Your actual application state lives in `data/`. Back that directory up.

## Build and Deploy

Use the standard scripts:

```bash
bun run build
bun run start
```

`bun run build` deploys enabled guild slash commands when the bot is configured and then builds the Next.js app. `bun start` starts the panel and bot together under one supervisor process and uses port `9002` unless `PORT` is set.

Before putting Zeus behind a public domain, make sure these are set correctly:

1. `panelUrl` in settings matches the public origin
2. Discord OAuth credentials are valid if the client portal is enabled
3. BuiltByBit secrets are configured if webhook automation is enabled
4. Proxy header trust is configured intentionally

## Extending Zeus

Common extension points are straightforward:

- Add routes or server endpoints under `src/app`
- Add bot commands under `src/bot/commands`
- Replace the file store in `src/lib/data.ts`
- Extend settings validation in `src/lib/settings-validation.ts`
- Add new admin actions in `src/lib/actions.ts`

If you are adapting Zeus to a database backed deployment, start with the data layer first. Most of the rest of the application already consumes that layer instead of reading files directly.

<details>
<summary>Panel Screenshots~</summary>

<img width="1902" height="863" alt="Screenshot_2" src="https://github.com/user-attachments/assets/a57c7975-60ce-48d2-84ac-5413306887f2" />
<img width="1900" height="867" alt="Screenshot_5" src="https://github.com/user-attachments/assets/2e6d5e1c-db2b-4c89-8481-7e2ab8cea113" />
<img width="1900" height="857" alt="Screenshot_4" src="https://github.com/user-attachments/assets/bf0d5392-bacc-4501-8bfb-90d62a875810" />
<img width="1904" height="867" alt="Screenshot_6" src="https://github.com/user-attachments/assets/2ee49436-aa8a-40e0-a67b-90a3eb6129ab" />
<img width="1903" height="861" alt="Screenshot_9" src="https://github.com/user-attachments/assets/e29db1a7-2747-4f6f-ba26-d7568c2a65de" />
<img width="1905" height="864" alt="Screenshot_10" src="https://github.com/user-attachments/assets/5f35eb74-33c9-4855-b74e-ee1ef560d466" />
<img width="1908" height="861" alt="Screenshot_11" src="https://github.com/user-attachments/assets/d8cfc7a3-f695-4843-9368-c47593c730e0" />
<img width="1904" height="863" alt="Screenshot_12" src="https://github.com/user-attachments/assets/06d11f4e-3504-44db-886e-df8a38c5b908" />
<img width="744" height="844" alt="Screenshot_13" src="https://github.com/user-attachments/assets/e53eaa20-3b7f-45d5-bd1e-548831c248e0" />
<img width="1902" height="863" alt="Screenshot_8" src="https://github.com/user-attachments/assets/8d1e0a00-13eb-44c4-8d8d-e84563cc55cd" />
<img width="1906" height="864" alt="Screenshot_7" src="https://github.com/user-attachments/assets/78a75d1e-2b70-4915-a276-c40eb8a3b083" />
</details>

<details>
    <summary>Discord Bot~</summary>
<img width="966" height="427" alt="Screenshot_16" src="https://github.com/user-attachments/assets/73aa4cda-f0ea-4096-ba52-53c3975aba4e" />
<img width="1144" height="672" alt="Screenshot_15" src="https://github.com/user-attachments/assets/1a49dfb5-7c22-4916-b13a-05d08f302e04" />
<img width="997" height="482" alt="Screenshot_14" src="https://github.com/user-attachments/assets/1dbb4e24-f5e9-4d1c-8122-ca0ddf3874fc" />
<img width="778" height="369" alt="Screenshot_17" src="https://github.com/user-attachments/assets/0da39897-9321-472b-966e-2047d46bcd65" />

</details>

## Contribution

Pull requests are welcome. If you are planning a larger behavioral change, open an issue first so the direction is clear before code starts moving.
