

<h1 align="center">
  <img src="https://user-gen-media-assets.s3.amazonaws.com/seedream_images/a2746fa4-428d-48a0-b1e5-0264501d7ece.png" alt="Zeus Banner" width="50%" height="50%">
</h1>

<p align="center">
  <div align="center">
    <h3> Zeus - Powerful, Open-Source License Management System</h3>
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

> [!IMPORTANT]
> This project is new and may have bugs or glitches. If you encounter any issues, please [open an issue](https://github.com/unt1tler/Zeus/issues) on GitHub. We appreciate your feedback!  
> This project has taken inspiration for features from pre-existing license management panels such as **Phantom by Buzz.dev** and **Sun Licenses**.
<br />

## Table of Contents
- [Core Philosophy](#core-philosophy)
- [Technology Stack](#technology-stack)
- [Features](#features)
  - [Management & Control](#management--control)
  - [Automation & Integration](#automation--integration)
  - [User Experience](#user-experience)
- [Smart Features](#smart-features)
- [Database Architecture](#database-architecture)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Extending the Panel](#extending-the-panel)
- [Environment Variables](#environment-variables)

## Core Philosophy

Zeus was built with three core principles in mind:

1. **Simplicity & Speed**: Get up and running in minutes. The entire system is designed to be incredibly lightweight, with no external database dependencies.  
2. **Developer-First Modularity**: The codebase is clean, well-organized, and built to be extended.  
3. **Powerful, Not Complicated**: We provide a rich feature set inspired by leading license management solutions, but without the bloat or complexity.  

## Technology Stack

- **Framework**: [Next.js (App Router)](https://nextjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Authentication**: Secure, session-based authentication using HTTP-only cookies.
- **Database**: JSON file-based system (no external dependencies).
- **Discord Integration**: [Discord.js](https://discord.js.org/)

## Features

### Management & Control
- Product, License, and Customer management
- Voucher system for promotions
- Blacklist and validation tracking tools

### Automation & Integration
- BuiltByBit automation and webhooks
- Secure validation and admin REST APIs

### User Experience
- Real-time dashboard updates
- Client-facing management panel
- Discord bot with admin and user commands

## Smart Features
- Geographic validation tracking
- Dynamic command management
- Configurable Admin API
- Customizable Validation API
- Toggleable client panel
- Modular data layer and performance optimizations

## Database Architecture
Uses a JSON file-based data system for zero configuration, portability, and speed.  
Ideal for small-to-medium applications and easily extendable to SQL or Firestore.

## Getting Started
```bash
git clone https://github.com/unt1tler/Zeus.git
cd Zeus
npm install
npm run dev
```
Visit `http://localhost:9002` to access your panel.

## Deployment
```bash
npm run build
npm start
```
Runs the Next.js server and Discord bot in production.

## Extending the Panel
- Add new routes in `src/app/api/`
- Add new bot commands in `src/bot/commands/`
- Replace database logic in `src/lib/data.ts`

## Environment Variables

| Variable | Description | Required |
|-----------|-------------|:--------:|
| `LOGIN_EMAIL` | Admin login email | ✅ |
| `LOGIN_PASSWORD` | Admin login password | ✅ |
| `SESSION_SECRET` | Secret key for session cookies | ✅ |
| `DISCORD_BOT_TOKEN` | Discord bot token | ✅ |

<details>
<summary>Panel Screenshots~</summary>

<img width="1885" height="864" alt="Screenshot_1" src="https://github.com/user-attachments/assets/94f2b992-10c9-4357-ac5e-b0fffef050ef" /><img width="1575" height="861" alt="Screenshot_3" src="https://github.com/user-attachments/assets/cb12564f-1b83-42a0-b453-fcb87d4b623d" />
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
- Have a great idea? open a Pull Request at [Pull](https://github.com/unt1tler/Zeus/pulls)
