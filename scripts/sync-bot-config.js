
const fs = require('fs');
const path = require('path');
const { getSettings } = require('../src/lib/data-access');

const botConfigPath = path.join(__dirname, '..', 'src', 'bot', 'config.json');
const dataDir = path.join(__dirname, '..', 'data');

async function syncConfig() {
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const settings = await getSettings();

        const botConfig = settings.discordBot || { enabled: false };
        fs.writeFileSync(botConfigPath, JSON.stringify(botConfig, null, 2));

        if (process.env.DB?.toUpperCase() === 'POSTGRESQL') {
            console.log('[Sync] PostgreSQL storage initialized and bot configuration synchronized successfully.');
            return settings;
        }

        console.log('[Sync] Bot configuration synchronized successfully.');
        return settings;
    } catch (error) {
        console.error('[Sync] Failed to synchronize bot configuration:', error);
        throw error;
    }
}

// Ensure this runs if the file is executed directly
if (require.main === module) {
    syncConfig().catch((error) => {
        console.error('[Sync] Fatal synchronization error:', error);
        process.exitCode = 1;
    });
}


module.exports = syncConfig;
