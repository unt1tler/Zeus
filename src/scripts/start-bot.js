
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const syncConfig = require('./sync-bot-config');

const botScriptPath = path.join(__dirname, '..', 'bot', 'index.js');
const settingsPath = path.join(__dirname, '..', 'data', 'settings.json');
const pidFilePath = path.join(__dirname, '..', 'bot', 'bot.pid');

let botProcess = null;

function stopBot() {
    return new Promise((resolve) => {
        try {
            if (fs.existsSync(pidFilePath)) {
                const pid = fs.readFileSync(pidFilePath, 'utf8');
                if (pid) {
                    console.log(`[Startup] Stopping existing bot process with PID: ${pid}`);
                    try {
                        process.kill(parseInt(pid, 10), 'SIGTERM');
                    } catch (e) {
                        if (e.code !== 'ESRCH') {
                            console.log('[Startup] Could not stop bot process, it may have already been stopped.', e.message);
                        }
                    }
                    fs.unlinkSync(pidFilePath);
                }
            }
        } catch (e) {
            console.log('[Startup] Error while stopping bot:', e.message);
        }
        resolve();
    });
}

function startBotProcess() {
    try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const token = process.env.DISCORD_BOT_TOKEN;
        
        if (settings.discordBot && settings.discordBot.enabled && token) {
            console.log('[Startup] Starting Discord bot process...');
            
            botProcess = spawn('node', [botScriptPath], {
                detached: true,
                stdio: 'inherit',
                env: {
                    ...process.env,
                    DISCORD_BOT_TOKEN: token,
                    PANEL_URL: settings.panelUrl,
                    INTERNAL_PANEL_URL: 'http://localhost:9002',
                    API_KEY: settings.apiKey,
                }
            });

            fs.writeFileSync(pidFilePath, botProcess.pid.toString());
            console.log(`[Startup] Bot process started with PID: ${botProcess.pid}`);
            
            botProcess.unref();
        } else {
            console.log('[Startup] Discord bot is disabled or token is missing in .env file. Not starting.');
        }
    } catch(e) {
        console.log('[Startup] Could not read settings or start bot. Bot will not be started.', e);
    }
}

async function main() {
    await stopBot();
    syncConfig();
    startBotProcess();
}

if (require.main === module) {
    main();
}

process.on('SIGINT', async () => {
    await stopBot();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await stopBot();
    process.exit(0);
});

module.exports = { startBot: main, stopBot };
