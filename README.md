# Zeus

<div align="center">
  <img src="https://user-gen-media-assets.s3.amazonaws.com/seedream_images/a2746fa4-428d-48a0-b1e5-0264501d7ece.png" alt="Zeus Banner" width="420"/>
  <h1>Zeus</h1>
  <p>High‑quality, extensible license management panel with admin + client dashboards and a Discord bot.</p>

  <div>
    <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/TailwindCSS-3-38B2AC?logo=tailwindcss&logoColor=white" alt="Tailwind" />
    <img src="https://img.shields.io/badge/Discord.js-14-5865F2?logo=discord&logoColor=white" alt="Discord.js" />
  </div>
</div>

> [!IMPORTANT]
> • Zeus is an educational, open‑source panel. Use responsibly and comply with your platform’s terms.
>
> • This project borrows ideas from existing panels (e.g., Phantom by Buzz.dev) but is an original implementation.

<br />

## Table of Contents
- [Core Philosophy](#core-philosophy)
- [Technology Stack](#technology-stack)
- [Feature Overview](#feature-overview)
  - [Management & Control](#management--control)
  - [Automation & Integrations](#automation--integrations)
  - [User Experience](#user-experience)
- [Smart Features](#smart-features)
- [Architecture & Data Model](#architecture--data-model)
- [Project Structure](#project-structure)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Settings (data/settings.json)](#settings-datasettingsjson)
- [Development Commands](#development-commands)
- [APIs](#apis)
  - [Public Validation API](#public-validation-api)
  - [Admin REST API](#admin-rest-api)
- [Discord Bot](#discord-bot)
- [Deployment](#deployment)
- [Troubleshooting & FAQs](#troubleshooting--faqs)
- [Extending the Panel](#extending-the-panel)

## Core Philosophy

1. **Simplicity & Speed**: Run in minutes. No external DB required; JSON files power a blazing‑fast panel with a tiny footprint.
2. **Developer‑First Modularity**: Clear separation between data layer and UI. Swap JSON for any DB by changing a single file.
3. **Powerful, Not Complicated**: Feature‑rich without bloat. Actions are designed around real publisher workflows.

## Technology Stack

- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Language**: TypeScript
- **Authentication**: Session‑based auth via HTTP‑only cookies
- **Database**: JSON file storage (swap‑able)
- **Discord Integration**: discord.js v14

## Feature Overview

### Management & Control
- **Products**: Create/edit products with imagery and HWID protection toggles.
- **Licenses**: Create, renew, activate/deactivate, delete.
- **Customers**: Owner + sub‑user modeling with Discord identities.
- **Vouchers**: Codes to create/renew licenses (e.g., 1m, 6m, 1y, lifetime).
- **Blacklist**: IP / HWID / Discord user blocks.
- **Validation Records**: Detailed logs with location, reason and status.

### Automation & Integrations
- **BuiltByBit Placeholder**: Auto‑create lifetime licenses on first download.
- **BuiltByBit Webhook**: Auto‑create licenses on purchase.
- **Secure Validation API**: Public endpoint, response shaping from settings.
- **Admin REST API**: Key‑protected control plane for server‑to‑server automation.

### User Experience
- **Admin Dashboard**: Live bot status, charts, map, recent activity.
- **Client Panel**: User dashboard with keys, IP/HWID management, expirations.
- **Branding**: Configurable accent color.
- **Discord Bot**: Admin + user commands with role‑gated access.

## Smart Features

- **Interactive Geo Map** of validation locations.
- **Dynamic Command Toggles** for the bot (dashboard‑driven).
- **Granular Admin API**: Enable/disable the API or specific endpoints.
- **Customizable Validation Response**: Choose exactly what fields are returned.
- **Toggleable Client Panel** for B2B/B2C modes.
- **Centralized Data Layer** in `src/lib/data.ts` for painless DB swaps.

## Architecture & Data Model

Zeus uses a **JSON file‑based database** by default. Data is persisted in `data/` and accessed through:
- `src/lib/data.ts` (server panel)
- `src/lib/data-access.js` (bot adapter)

Key types are in `src/lib/types.ts` (Products, Licenses, Customers, Blacklist, Vouchers, Settings, charts, logs, etc.).

> Migrating to a real DB? Replace implementations inside `src/lib/data.ts` and keep the rest of the code unchanged.

## Project Structure

```text
src/
  app/                # Next.js App Router (admin, client, and API routes)
  bot/                # Discord bot, commands, config sync & deployment
  components/         # UI components (shadcn), charts, dialogs, pages
  lib/                # Data layer, types, logging utils, helpers
  data/               # JSON storage (auto‑created at runtime)
scripts/              # Dev/prod startup helpers and bot config sync
```

## Quickstart

1) **Clone**
```bash
git clone https://github.com/your-github/zeus.git
cd zeus
```

2) **Install**
```bash
yarn install  # or: npm install / pnpm i
```

3) **Configure `.env`** (see [Environment Variables](#environment-variables))
- Create `./.env` and fill the required values.
- `data/` is auto‑created on first run.

4) **Run dev**
```bash
npm run dev
```
Visit `http://localhost:9002`.

5) (Optional) **Enable the bot** in dashboard settings after setting `DISCORD_BOT_TOKEN`.

> Windows: scripts work with PowerShell on Windows 10+. No extra process manager needed for local dev.

## Configuration

### Environment Variables
Create `./.env` in the repo root.

| Variable | Description | Required |
| --- | --- | :--: |
| `LOGIN_EMAIL` | Admin login email for the panel. | Yes |
| `LOGIN_PASSWORD` | Admin login password. | Yes |
| `SESSION_SECRET` | Random secret for signing session cookies. | Yes |
| `DISCORD_BOT_TOKEN` | Token for your Discord bot. | No |
| `API_KEY` | Secret for Admin API + bot usage logging. | Yes |
| `INTERNAL_PANEL_URL` | Internal base URL used by the bot (scripts default to `http://localhost:9002`). | No |

Notes
- Bot won’t start without `DISCORD_BOT_TOKEN` and `discordBot.enabled = true` in settings.
- The Admin API requires `adminApiEnabled = true` and correct `x-api-key`.

### Settings (`data/settings.json`)
This file is managed by the dashboard; edit there or directly here.

- `apiKey`, `panelUrl`, `adminApiEnabled`, `adminApiEndpoints.*`
- `clientPanel.enabled`, `clientPanel.accentColor`
- `validationResponse.*`: require Discord ID, custom success text, response fields
- `builtByBitWebhookSecret` and `builtByBitPlaceholder`: automation defaults & protections
- `discordBot.*`: `enabled`, `clientId`, `guildId`, `adminIds`, command toggles, presence
- `logging.*`: webhook URL and event toggles

## Development Commands

```bash
npm run dev    # Deploys slash commands, syncs bot config, starts bot (if enabled) and Next.js at :9002
npm run build  # Deploys slash commands, builds Next.js
npm start      # Starts Next.js at :9002 and launches bot in the background
npm run typecheck
npm run lint
```

Helpers
- `scripts/dev-startup.js`: stops stray bot, deploys commands, starts bot for dev.
- `scripts/start-bot.js`: runs the bot as a detached process in production.
- `scripts/sync-bot-config.js`: mirrors dashboard bot settings to `src/bot/config.json`.

## APIs

### Public Validation API
- Route: `POST /api/validate`
- Body:
```json
{
  "key": "LF-...",
  "hwid": "optional-hwid",
  "discordId": "optional-user-id"
}
```
- Returns: `{ success, status, message?, license?, customer?, product? }` depending on `validationResponse` settings.
- Built‑in protections: blacklist checks (IP/HWID/Discord), status/expiry, IP/HWID limits, optional user authorization by `discordId`.

### Admin REST API
Guarded by `x-api-key: <API_KEY>` and `adminApiEnabled`, with per‑endpoint flags.

- `GET /api/admin/licenses` — list licenses with product name.
- `POST /api/admin/licenses` — create license. Body includes `productId`, `discordId`, optional `discordUsername`, `email`, `expiresAt`, `maxIps`, `maxHwids`, `platform`, `platformUserId`, `subUserDiscordIds`.
- `PATCH /api/admin/licenses/[key]` — set status `active|inactive`.
- `DELETE /api/admin/licenses/[key]` — delete license.
- `PATCH /api/admin/licenses/[key]/identities` — add `ip` or `hwid` respecting max limits.
- `PATCH /api/admin/licenses/[key]/renew` — set a new `expiresAt` and reactivate.

Bot usage logging
- `POST /api/bot/log-usage` with `x-api-key` logs command usage for charts.

## Discord Bot

What it does
- Reads `src/bot/config.json` (synced from dashboard) and `.env`.
- Starts a tiny status server at `http://127.0.0.1:8081/status` used by the dashboard.
- Loads commands from `src/bot/commands/*.js`; admin commands require `adminIds`.
- Reports command usage back to the panel with `INTERNAL_PANEL_URL` + `API_KEY`.

Setup checklist
1) Create a Discord application and bot; put the token into `.env` as `DISCORD_BOT_TOKEN`.
2) In the dashboard, set `discordBot.enabled = true`, add `clientId`, `guildId`, `adminIds`, and presence.
3) Run `npm run dev` (or `npm start`) to deploy slash commands and start the bot.

## Deployment

Minimal VPS steps
```bash
git clone https://github.com/your-github/zeus.git
cd zeus && npm ci
cp .env.example .env   # then edit values
npm run build
npm start
```

Notes
- The bot is launched detached by `scripts/start-bot.js` and tracked by `src/bot/bot.pid`.
- Persist the `data/` directory; that is your database.
- Any Node.js host works (VPS, bare metal, Docker). Mount `data/` as a volume for containers.

## Troubleshooting & FAQs

- Bot not starting?
  - Ensure `.env` has `DISCORD_BOT_TOKEN` and dashboard settings have `discordBot.enabled = true`.
  - Verify `clientId`/`guildId` and re‑run `npm run dev` to deploy commands.

- Validation failing with "Missing discordId"?
  - Disable `validationResponse.requireDiscordId` in settings, or include `discordId` in requests.

- Hitting max IP/HWID limits?
  - Increase `maxIps`/`maxHwids` on the license or set `-1` for unlimited. Set `maxIps = -2` to disable IP checks.

- Admin API 401?
  - Include `x-api-key: <API_KEY>` and ensure `adminApiEnabled = true`.

Security tips
- Keep `API_KEY` private; rotate if leaked.
- Use HTTPS and a strong `SESSION_SECRET`.
- Disable endpoints you do not use via `adminApiEndpoints`.

## Extending the Panel

- Add routes under `src/app/api/*`.
- Add Discord commands in `src/bot/commands/` and toggle in settings.
- Swap the store by editing only `src/lib/data.ts` (and bot adapter if needed).