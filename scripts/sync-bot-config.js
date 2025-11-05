
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '..', 'data', 'settings.json');
const botConfigPath = path.join(__dirname, '..', 'src', 'bot', 'config.json');
const dataDir = path.join(__dirname, '..', 'data');

function syncConfig() {
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        let settings = {};
        if (fs.existsSync(settingsPath)) {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }

        const botConfig = settings.discordBot || { enabled: false };
        fs.writeFileSync(botConfigPath, JSON.stringify(botConfig, null, 2));

        console.log('[Sync] Bot configuration synchronized successfully.');
    } catch (error) {
        console.error('[Sync] Failed to synchronize bot configuration:', error);
    }
}

// Ensure this runs if the file is executed directly
if (require.main === module) {
    syncConfig();
}


module.exports = syncConfig;
