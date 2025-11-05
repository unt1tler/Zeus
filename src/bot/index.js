require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Events, Collection, ActivityType } = require('discord.js');
const { getBlacklist } = require('../lib/data-access');

const configPath = path.join(__dirname, 'config.json');

function readConfig() {
    const defaultConfig = {
        enabled: false,
        clientId: "",
        guildId: "",
        adminIds: [],
        presence: {
            status: 'online',
            activity: {
                type: 'Watching',
                name: 'licenses'
            }
        },
        commands: { ping: true }
    };

    try {
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            if (configData) {
                return JSON.parse(configData);
            }
        }
    } catch (error) {
        console.error('[ERROR] Error reading or parsing config.json:', error);
    }
    return defaultConfig;
}

const config = readConfig();
const token = process.env.DISCORD_BOT_TOKEN;
const internalPanelUrl = process.env.INTERNAL_PANEL_URL;
const apiKey = process.env.API_KEY;

let botStatus = { status: 'starting' };
const statusServer = http.createServer((req, res) => {
    if (req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(botStatus));
    } else {
        res.writeHead(404);
        res.end();
    }
});

const startStatusServer = () => {
    statusServer.listen(8081, '127.0.0.1', () => {
        console.log('[INFO] Status server listening on http://localhost:8081/status');
    });
    statusServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log('[INFO] Status server address already in use, likely from a previous process.');
        } else {
            console.error('[ERROR] Status server error:', err);
        }
    });
}
startStatusServer();

async function logCommandUsage(command, userId) {
    if (!internalPanelUrl || !apiKey) {
        console.error("[ERROR] INTERNAL_PANEL_URL or API_KEY not set. Cannot log command usage.");
        return;
    }

    try {
        const response = await fetch(`${internalPanelUrl}/api/bot/log-usage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
            },
            body: JSON.stringify({ command, userId }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[ERROR] Failed to log command usage. Status: ${response.status}. Body: ${errorBody}`);
        }
    } catch (error) {
        console.error("[ERROR] Exception while logging command usage:", error);
    }
}


if (!token) {
    console.log("[INFO] Bot token not found in .env file, bot will not start.");
    botStatus = { status: 'error', error: 'Bot token not found in .env file' };
    process.exit(0);
}

if (!config.enabled) {
    console.log("[INFO] Bot is disabled in configuration, not starting.");
    botStatus = { status: 'offline' };
    process.exit(0);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });


client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    const enabledCommands = config.commands ? Object.keys(config.commands).filter(key => config.commands[key] === true) : [];
     if (!enabledCommands.includes('ping')) {
        enabledCommands.push('ping');
    }

    for (const file of commandFiles) {
        try {
            const command = require(path.join(commandsPath, file));
            if (command.data && command.data.name && command.execute) {
                const commandName = command.data.name.replace(/-([a-z])/g, g => g[1].toUpperCase());
                if (enabledCommands.includes(commandName)) {
                    client.commands.set(command.data.name, command);
                }
            }
        } catch (error) {
            console.error(`[ERROR] Failed to load command ${file}:`, error);
        }
    }
}

client.once(Events.ClientReady, readyClient => {
    console.log(`[SUCCESS] Ready! Logged in as ${readyClient.user.tag}`);
     botStatus = {
        status: 'online',
        username: client.user.username,
        id: client.user.id,
        avatarUrl: client.user.displayAvatarURL(),
        presence: config.presence,
    };
    try {
        if (config.presence && config.presence.activity && config.presence.activity.name) {
            const activityTypeMap = {
                'Playing': ActivityType.Playing,
                'Streaming': ActivityType.Streaming,
                'Listening': ActivityType.Listening,
                'Watching': ActivityType.Watching,
                'Competing': ActivityType.Competing,
            };

            client.user.setPresence({
                activities: [{
                    name: config.presence.activity.name,
                    type: activityTypeMap[config.presence.activity.type] || ActivityType.Playing
                }],
                status: config.presence.status || 'online',
            });
            console.log(`[INFO] Presence set to: ${config.presence.activity.type} ${config.presence.activity.name}`);
        }
    } catch (error) {
        console.error('[ERROR] Failed to set presence:', error);
    }
});

const adminCommands = [
    'viewUser',
    'searchLicense',
    'deactivate',
    'createLicense',
    'renewLicense'
];

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        const blacklist = await getBlacklist();
        if (blacklist.discordIds && blacklist.discordIds.includes(interaction.user.id)) {
            return interaction.reply({ content: 'You have been blacklisted and cannot use this bot.', ephemeral: true });
        }
        
        const commandName = interaction.commandName.replace(/-([a-z])/g, g => g[1].toUpperCase());
        
        if (adminCommands.includes(commandName)) {
            if (!config.adminIds || !config.adminIds.includes(interaction.user.id)) {
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }
        }
    
        await command.execute(interaction);
        await logCommandUsage(interaction.commandName, interaction.user.id);

    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});


(async () => {
    try {
        console.log('[INFO] Attempting to log in...');
        await client.login(token);

    } catch (err) {
        console.error("[ERROR] Failed to log in. This is likely due to an invalid token or missing intents in your Discord Developer Portal.", err.message);
        botStatus = { status: 'error', error: err.message };
        process.exit(1);
    }
})();

process.on('SIGTERM', () => {
    console.log('[INFO] SIGTERM received. Shutting down bot gracefully.');
    client.destroy();
    statusServer.close(() => {
        console.log('[INFO] Status server closed.');
        process.exit(0);
    });
});
