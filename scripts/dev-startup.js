
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const syncConfig = require('./sync-bot-config');

const botScriptPath = path.join(__dirname, '..', 'src', 'bot', 'index.js');
const deployScriptPath = path.join(__dirname, '..', 'src', 'bot', 'deploy-commands.js');
const settingsPath = path.join(__dirname, '..', 'data', 'settings.json');
const pidFilePath = path.join(__dirname, '..', 'src', 'bot', 'bot.pid');

let botProcess = null;

function stopBot() {
    return new Promise((resolve) => {
        try {
            if (fs.existsSync(pidFilePath)) {
                const pid = fs.readFileSync(pidFilePath, 'utf8');
                if (pid) {
                    console.log(`[Dev Startup] Stopping existing bot process with PID: ${pid}`);
                    try {
                        process.kill(parseInt(pid, 10), 'SIGTERM');
                    } catch (e) {
                        if (e.code !== 'ESRCH') {
                            console.log('[Dev Startup] Could not stop bot process, it may have already been stopped.', e.message);
                        }
                    }
                    fs.unlinkSync(pidFilePath);
                }
            }
        } catch (e) {
            console.log('[Dev Startup] Error while stopping bot:', e.message);
        }
        resolve();
    });
}

function deployCommands() {
    return new Promise((resolve, reject) => {
        console.log('[Dev Startup] Deploying Discord commands...');
        const deployProcess = exec(`node "${deployScriptPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`[ERROR] Command deployment failed: ${stderr}`);
                return reject(new Error(`Command deployment failed: ${stderr}`));
            }
            console.log(`[Dev Startup] Command deployment output: ${stdout}`);
            resolve();
        });
    });
}

function startBotProcess() {
    try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const token = process.env.DISCORD_BOT_TOKEN;
        
        if (settings.discordBot && settings.discordBot.enabled && token) {
            console.log('[Dev Startup] Starting Discord bot process...');
            
            botProcess = spawn('node', [botScriptPath], {
                detached: false,
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
            console.log(`[Dev Startup] Bot process started with PID: ${botProcess.pid}`);
            
            botProcess.on('exit', (code) => {
                console.log(`[Dev Startup] Bot process exited with code ${code}`);
                if (fs.existsSync(pidFilePath)) {
                    fs.unlinkSync(pidFilePath);
                }
            });

        } else {
            console.log('[Dev Startup] Discord bot is disabled or token is missing in .env file. Not starting.');
        }
    } catch(e) {
        console.log('[Dev Startup] Could not read settings or start bot. Bot will not be started.', e);
    }
}

async function main() {
    await stopBot();
    syncConfig();
    try {
        await deployCommands();
        startBotProcess();
    } catch (error) {
        console.error('[FATAL] Could not deploy commands. The bot will not start.');
    }
}

if (require.main === module) {
    main();
}

const cleanup = async () => {
    console.log('[Dev Startup] Shutting down...');
    await stopBot();
    process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
