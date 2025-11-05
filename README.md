<div align="center">
  <img 
    src="https://user-gen-media-assets.s3.amazonaws.com/seedream_images/a2746fa4-428d-48a0-b1e5-0264501d7ece.png" 
    alt="Zeus Logo" 
    width="300"
  />
  
  <h1>Zeus</h1>
  <p>A license management system built with Next.js and Tailwind CSS.</p>

  <a href="https://discord.gg/CR7s2aEf9T">
    <img src="https://img.shields.io/discord/829037998552121300?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord">
  </a>
  <a href="https://github.com/unt1tler/Zeus/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/unt1tler/Zeus?style=for-the-badge&color=orange" alt="Contributors">
  </a>
  <a href="https://github.com/unt1tler/Zeus/network/members">
    <img src="https://img.shields.io/github/forks/unt1tler/Zeus?style=for-the-badge&color=blue" alt="Forks">
  </a>
  <a href="https://github.com/unt1tler/Zeus/stargazers">
    <img src="https://img.shields.io/github/stars/unt1tler/Zeus?style=for-the-badge&color=yellow" alt="Stars">
  </a>
  <a href="https://github.com/unt1tler/Zeus/issues">
    <img src="https://img.shields.io/github/issues/unt1tler/Zeus?style=for-the-badge&color=red" alt="Issues">
  </a>

  <hr />
</div>

## About

Zeus is a license management system. It lets you generate, manage, and validate software licenses. The whole thing is built on a JSON file database, so there's no complex setup—just clone it and go.

**Built with:** Next.js, Tailwind CSS, shadcn/ui, TypeScript

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API](#api)
- [Database](#database)
- [Contributing](#contributing)

## Features

**Core Functionality**

- Product and license management through a clean admin panel
- Customer profiles with linked accounts and metadata
- Voucher system for promotional codes
- IP and HWID blacklisting
- Detailed validation logs with geographic tracking
- Public validation API and protected admin REST API

**Automation**

- BuiltByBit integration for automatic license generation
- Webhook support for purchase-triggered license creation
- Discord bot with admin and user commands
- Bot command management from the dashboard

**Customization**

- Configurable validation API responses
- Toggleable client dashboard and admin features
- Customizable accent colors for branding
- Enable/disable specific API endpoints
- Support for custom database backends

## Installation

**Requirements**

- Node.js 18 or higher
- npm or yarn
- A Discord bot token (create one in the [Discord Developer Portal](https://discord.com/developers/applications))

**Steps**

1. Clone the repository

```bash
git clone https://github.com/unt1tler/Zeus.git
cd Zeus
```

2. Install dependencies

```bash
npm install
```

3. Create a `.env` file in the root directory and add the required environment variables

```env
LOGIN_EMAIL=your-email@example.com
LOGIN_PASSWORD=your-password
SESSION_SECRET=generate-one-here
DISCORD_BOT_TOKEN=your-bot-token
```

To generate a secure session secret, use [generate-secret.vercel.app](https://generate-secret.vercel.app/32).

4. Start the development server

```bash
npm run dev
```

Access the admin panel at `http://localhost:9002`.

## Configuration

All configuration is handled through environment variables in your `.env` file.

| Variable | Description | Required |
|----------|-------------|----------|
| `LOGIN_EMAIL` | Email to log into the admin panel | Yes |
| `LOGIN_PASSWORD` | Password for the admin panel | Yes |
| `SESSION_SECRET` | Secret key for signing session cookies | Yes |
| `DISCORD_BOT_TOKEN` | Your Discord bot's token | Yes |

Additional settings like API configuration, accent colors, and feature toggles can be managed from the admin dashboard.

## Usage

### Admin Panel

The admin panel at `/admin` is where you manage everything. Log in with your credentials to:

- Create and manage products
- Generate and manage licenses
- View customer profiles
- Create vouchers
- Configure API settings
- Manage Discord bot commands
- View validation logs and geographic data

### Client Dashboard

Customers can access their dashboard (if enabled) to:

- View their licenses
- Manage allowed IPs and HWIDs
- Check expiration dates
- Redeem vouchers

### Discord Bot

The bot supports both admin and user commands:

**Admin commands:** Manage licenses, create users, check system status
**User commands:** Check profile, manage licenses, redeem vouchers

Use the `/link-builtbybit` command to connect a Discord account with a BuiltByBit account.

## API

Zeus provides two main APIs for external integrations.

### Validation API

Check if a license key is valid. This is public and can be called from your applications.

**Endpoint:** `POST /api/validate`

**Request:**
```json
{
  "license_key": "your-license-key"
}
```

**Response (on success):**
```json
{
  "valid": true,
  "license": { /* license object */ },
  "customer": { /* customer object */ },
  "product": { /* product object */ }
}
```

Response payload is configurable from the admin dashboard.

### Admin REST API

Manage licenses, customers, and products programmatically.

**Endpoint:** `POST /api/admin/*`

Protected by API key (set in admin settings).

**Available endpoints:**
- Create, read, update, delete licenses
- Create, read, update, delete customers
- Create, read, update, delete products

## Database

Zeus uses a file-based JSON database by default. All data is stored in the `/data` directory as simple JSON files.

**Why JSON files?**

- No database server to install or manage
- Easy to back up and version control
- Fast for small to medium workloads
- Human-readable data

**Switching databases**

All database operations are handled in `src/lib/data.ts`. To use MySQL, PostgreSQL, MongoDB, or another system, rewrite the functions in that file. The rest of the application will work unchanged.

## Project Structure

```
zeus/
├── src/
│   ├── app/           # Next.js pages and API routes
│   ├── bot/           # Discord bot commands
│   ├── lib/           # Core utilities and data layer
│   ├── components/    # React components
│   └── styles/        # Tailwind and global styles
├── data/              # JSON database files
├── public/            # Static assets
└── .env               # Environment variables (create this)
```

## Development

**Running the dev server:**
```bash
npm run dev
```

**Building for production:**
```bash
npm run build
```

**Starting in production mode:**
```bash
npm start
```

## Adding Features

**New API routes:** Add files to `src/app/api/` and use the `checkApiKey` utility for protected routes.

**New bot commands:** Create a file in `src/bot/commands/`. The bot loads it automatically if enabled in settings.

**Custom styling:** Modify `src/app/globals.css` and `tailwind.config.ts`.

## Contributing

Contributions are welcome. If you have ideas, found a bug, or want to improve the code:

1. Fork the repository
2. Create a branch for your changes (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to your branch (`git push origin feature/your-feature`)
5. Open a pull request

## License

This project is open source under the [MIT License](LICENSE).

## Support

- **Discord:** [Join the community](https://discord.gg/CR7s2aEf9T)
- **Issues:** [Report bugs](https://github.com/unt1tler/Zeus/issues)
- **Discussions:** [Ask questions](https://github.com/unt1tler/Zeus/discussions)