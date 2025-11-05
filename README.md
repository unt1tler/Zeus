<div align="center">
  <img 
    src="https://user-gen-media-assets.s3.amazonaws.com/seedream_images/a2746fa4-428d-48a0-b1e5-0264501d7ece.png" 
    alt="Zeus Logo" 
    width="300"
    height="300"
  />
  
  <h1>Zeus</h1>
  <p><i>A powerful, open-source license management system built with Next.js and Tailwind CSS.</i></p>

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
  
  <br/>
  <br/>
  
  <a href="#-getting-started">Getting Started</a>
  •
  <a href="#-features">Features</a>
  •
  <a href="#-documentation">Documentation</a>
  •
  <a href="https://discord.gg/CR7s2aEf9T">Discord</a>
  
</div>

<br/>

---

> **⚠️ Heads Up**
> 
> Zeus is fresh off the press and might have a few rough edges here and there. Spotted something weird? [Drop an issue on GitHub](https://github.com/unt1tler/Zeus/issues)—we'd genuinely love to hear about it! 
>
> Big thanks to Phantom by Buzz.dev for inspiring some of our coolest features.

---

## 🎯 What's This All About?

Zeus exists because managing licenses doesn't need to be complicated. Whether you're selling plugins, distributing software, or managing access to your products, Zeus gives you everything you need without the headache.

**Built on solid foundations:** Next.js, Tailwind CSS, shadcn/ui, and TypeScript—a modern stack that's fast, reliable, and actually enjoyable to work with.

**Zero database setup.** Everything runs on simple JSON files. No servers to configure, no credentials to manage. Just clone, install, and go. When you're ready to scale up, switching to MySQL or PostgreSQL is as simple as editing one file.

**Made for developers.** Clean code, logical structure, and built to be extended. Adding new features or integrations isn't a nightmare—it's straightforward.

---

## ✨ Features

### Run Your Business Like a Pro

**Product Management** — Create products, set pricing, upload images, and toggle HWID protection with one click. Everything in one clean interface.

**License Control** — Generate, renew, activate, deactivate, or delete licenses. No wrestling with complicated workflows.

**Customer Profiles** — See everything about a customer in one place: their licenses, Discord info, sub-user status, and more.

**Voucher System** — Create redeemable codes for any product with flexible durations. Perfect for promotions, trials, or giveaways.

**Blacklist Management** — Block specific IPs, HWIDs, or entire accounts to keep troublemakers out.

**Detailed Logging** — Every validation request gets recorded with IP, HWID, location, and timestamp. Know exactly what's happening.

### Automate Everything

**BuiltByBit Integration** — When someone downloads your product from BuiltByBit for the first time, Zeus automatically creates a lifetime license. Set it once, forget about it.

**Purchase Webhooks** — Hook into BuiltByBit's webhook system to auto-generate licenses the second someone buys your product.

**Validation API** — Check license validity from any application with a simple, secure API. Customize exactly what data gets returned.

**Admin REST API** — Manage licenses, customers, and products programmatically. Perfect for external integrations.

### Keep Your Customers Happy

**Live Dashboard** — Watch everything happen in real-time. Bot status, validation activity, recent events—all updated live.

**Customer Portal** — Your users get their own beautiful dashboard to view keys, manage IPs/HWIDs, and check expiration dates.

**Brand Customization** — Change the accent color to match your brand identity. Make it yours.

**Powerful Discord Bot** 
- Admins manage licenses and check system status from Discord
- Users check profiles, manage licenses, and redeem vouchers
- `/link-builtbybit` command for seamless account linking

---

## 🧠 The Smart Stuff

This isn't just another CRUD panel. Here's what makes Zeus actually useful:

**Geographic Intelligence** — Interactive world map showing where your validation requests come from. Understand your user base and catch suspicious activity.

**Dynamic Command Control** — Enable or disable Discord bot commands from the dashboard without touching code. Changes apply on next restart.

**API Customization** — Toggle entire APIs on/off or disable specific endpoints. Require Discord IDs in validation requests. Choose exactly what data gets returned. You're in control.

**Modular Everything** — The entire codebase is built to be extended. All data operations live in one file, making database migrations painless.

**Blazing Fast** — Next.js Server Components + lightweight file storage = seriously responsive performance with minimal overhead.

---

## 📦 How Your Data Works

Zeus stores everything in plain JSON files. That's it.

**Why does this matter?**

- **Zero Setup** — No database servers to install or configure. Works immediately.
- **Portable** — Move your entire app and data anywhere. Back it up with Git. Copy to another server. Easy.
- **Surprisingly Fast** — For most use cases, local file operations are incredibly quick and eliminate network latency.
- **Actually Readable** — Open any JSON file and see your data. Edit it directly if needed (though the dashboard is cleaner).

Perfect for getting started fast. When you need something beefier like MySQL or PostgreSQL, the modular data layer makes migration straightforward.

---

## 🚀 Getting Started

Get Zeus running in less than 5 minutes.

### Prerequisites

- Node.js 18+ installed
- A Discord bot token ([create one here](https://discord.com/developers/applications))
- Git

### Installation

**1. Clone the repo**
```bash
git clone https://github.com/unt1tler/Zeus.git
cd Zeus
```

**2. Install dependencies**
```bash
npm install
```

**3. Set up environment variables**

Create a `.env` file in the root directory:

```env
LOGIN_EMAIL=your-email@example.com
LOGIN_PASSWORD=your-secure-password
SESSION_SECRET=generate-a-long-random-string-here
DISCORD_BOT_TOKEN=your-discord-bot-token
```

> 💡 **Tip:** Generate a secure session secret at [generate-secret.vercel.app](https://generate-secret.vercel.app/32)

**4. Start the development server**
```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) and you're in! 🎉

---

## 🌐 Going Live

Ready to deploy? Here's how.

**Build the application**
```bash
npm run build
```
This also deploys your Discord bot commands.

**Start in production mode**
```bash
npm start
```
Starts the Next.js server and runs the Discord bot in the background.

**Deployment Options:**
- **Vercel** — Zero config, just connect your repo
- **VPS** — Any server with Node.js works
- **Dedicated Server** — Full control over everything

---

## 🛠️ Technology Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Discord:** [Discord.js](https://discord.js.org/)
- **Database:** JSON file-based system

---

## 🔧 Making It Your Own

Zeus is designed to be extended. Here's how:

**Add New API Routes** — Drop new endpoints in `src/app/api/`. Use the `checkApiKey` utility for protected routes.

**Add Bot Commands** — Create a JavaScript file in `src/bot/commands/`. The bot auto-registers it if enabled in settings.

**Switch Databases** — All data operations are in `src/lib/data.ts`. Want MySQL, MongoDB, or Firestore? Just rewrite this one file. Everything else keeps working.

**Customize Styling** — Modify `src/app/globals.css` and `tailwind.config.ts`. Tailwind and shadcn/ui give you tons of flexibility.

---

## 📝 Configuration

Your `.env` file controls everything:

| Variable | What It Does | Required |
|----------|-------------|----------|
| `LOGIN_EMAIL` | Email for admin dashboard login | ✅ Yes |
| `LOGIN_PASSWORD` | Password for admin dashboard | ✅ Yes |
| `SESSION_SECRET` | Secret key for session cookies | ✅ Yes |
| `DISCORD_BOT_TOKEN` | Your Discord bot token | ✅ Yes |

---

## 🤝 Contributing

Found a bug? Want to add a feature? Contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 💬 Community & Support

- **Discord:** [Join our community](https://discord.gg/CR7s2aEf9T)
- **Issues:** [Report bugs or request features](https://github.com/unt1tler/Zeus/issues)
- **Discussions:** [Ask questions and share ideas](https://github.com/unt1tler/Zeus/discussions)

---

<div align="center">
  
  **Built with ❤️ by the Zeus team**
  
  If Zeus helped you out, consider giving it a ⭐ on GitHub!
  
</div>
