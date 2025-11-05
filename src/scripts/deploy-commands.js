
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const syncConfig = require('./sync-bot-config');

function deploy() {
    syncConfig();

    let config;
    try {
        const configPath = path.join(__dirname, '..', 'bot', 'config.json');
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } else {
            console.error("[ERROR] config.json not found. Cannot deploy commands.");
            process.exit(1);
        }
    } catch (error) {
        console.error("[ERROR] Could not read or parse config.json. Cannot deploy commands.", error);
        process.exit(1);
    }
    
    if (!config.clientId || !config.guildId) {
        console.error("[ERROR] clientId or guildId is not set in your settings. Cannot deploy commands.");
        return;
    }


    const commands = [];
    const commandsPath = path.join(__dirname, '..', 'bot', 'commands');
    if (!fs.existsSync(commandsPath)) {
        console.log("[INFO] 'commands' directory not found. No commands to deploy.");
        return;
    }
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    const enabledCommands = config.commands ? Object.keys(config.commands).filter(key => config.commands[key] === true) : [];
     if (!enabledCommands.includes('ping')) {
        enabledCommands.push('ping');
    }

    for (const file of commandFiles) {
        try {
            const command = require(path.join(commandsPath, file));
            if (command.data && command.data.name) {
                const commandName = command.data.name.replace(/-([a-z])/g, g => g[1].toUpperCase());
                if (enabledCommands.includes(commandName)) {
                    commands.push(command.data.toJSON());
                    console.log(`[INFO] Queued command for deployment: ${command.data.name}`);
                } else {
                     console.log(`[INFO] Skipping disabled command: ${command.data.name}`);
                }
            } else {
                console.log(`[WARNING] The command at ${file} is missing a required "data" or "name" property.`);
            }
        } catch(e) {
            console.error(`[ERROR] Failed to load command at ${file}:`, e);
        }
    }
    
    const token = process.env.DISCORD_BOT_TOKEN;

    if (!token) {
        console.log("[INFO] DISCORD_BOT_TOKEN not found in .env file. Bot commands will not be deployed.");
        return;
    }

    const rest = new REST({ version: '10' }).setToken(token);

    (async () => {
        try {
            console.log(`[INFO] Started refreshing ${commands.length} application (/) commands.`);

            const data = await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body: commands },
            );

            console.log(`[INFO] Successfully reloaded ${data.length} application (/) commands.`);
        } catch (error) {
            console.error("[ERROR] Failed to deploy commands:", error);
        }
    })();
}

if (require.main === module) {
    deploy();
}

module.exports = { deploy };

// took me 3 hours of bug fixing to find out there was a typo here
