const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const { REST, Routes } = require("discord.js");
const fs = require("node:fs");
const syncConfig = require("../../scripts/sync-bot-config");

function readConfig() {
  const configPath = path.join(__dirname, "config.json");

  if (!fs.existsSync(configPath)) {
    throw new Error("config.json not found. Cannot deploy commands.");
  }

  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function getEnabledCommands(config) {
  const commands = [];
  const commandsPath = path.join(__dirname, "commands");

  if (!fs.existsSync(commandsPath)) {
    console.log("[INFO] 'commands' directory not found. No commands to deploy.");
    return commands;
  }

  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
  const enabledCommands = config.commands
    ? Object.keys(config.commands).filter((key) => config.commands[key] === true)
    : [];

  if (!enabledCommands.includes("ping")) {
    enabledCommands.push("ping");
  }

  for (const file of commandFiles) {
    try {
      const command = require(path.join(commandsPath, file));
      if (!command.data?.name) {
        console.log(`[WARNING] The command at ${file} is missing a required "data" or "name" property.`);
        continue;
      }

      const commandName = command.data.name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      if (!enabledCommands.includes(commandName)) {
        console.log(`[INFO] Skipping disabled command: ${command.data.name}`);
        continue;
      }

      commands.push(command.data.toJSON());
      console.log(`[INFO] Queued command for deployment: ${command.data.name}`);
    } catch (error) {
      console.error(`[ERROR] Failed to load command at ${file}:`, error);
    }
  }

  return commands;
}

async function deploy() {
  await syncConfig();

  let config;
  try {
    config = readConfig();
  } catch (error) {
    console.error("[ERROR]", error.message);
    throw error;
  }

  if (!config.enabled) {
    console.log("[INFO] Discord bot is disabled. Skipping slash command deployment.");
    return;
  }

  if (!config.clientId || !config.guildId) {
    console.log("[INFO] clientId or guildId is not configured. Skipping slash command deployment.");
    return;
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.log("[INFO] DISCORD_BOT_TOKEN is not set. Skipping slash command deployment.");
    return;
  }

  const commands = getEnabledCommands(config);
  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log(`[INFO] Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands },
    );

    console.log(`[INFO] Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error("[ERROR] Failed to deploy commands:", error);
    throw error;
  }
}

if (require.main === module) {
  deploy().catch(() => {
    process.exitCode = 1;
  });
}

module.exports = { deploy };
