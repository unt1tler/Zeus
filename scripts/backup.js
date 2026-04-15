
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const backupRoot = path.join(__dirname, '..', 'backups');

const DATA_FILES = [
  'settings.json',
  'licenses.json',
  'products.json',
  'blacklist.json',
  'logs.json',
  'bot-logs.json',
  'vouchers.json',
  'platform-links.json',
];

const MAX_BACKUPS = 30;

function createBackup() {
  if (!fs.existsSync(dataDir)) {
    console.log('[Backup] Data directory does not exist yet. Nothing to back up.');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(backupRoot, `backup-${timestamp}`);

  fs.mkdirSync(backupDir, { recursive: true });

  let copiedCount = 0;
  for (const file of DATA_FILES) {
    const src = path.join(dataDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(backupDir, file));
      copiedCount++;
    }
  }

  if (copiedCount === 0) {
    console.log('[Backup] No data files found to back up.');
    fs.rmSync(backupDir, { recursive: true, force: true });
    return;
  }

  console.log(`[Backup] Backed up ${copiedCount} file(s) to ${backupDir}`);
  pruneOldBackups();
}

function pruneOldBackups() {
  if (!fs.existsSync(backupRoot)) return;

  const entries = fs.readdirSync(backupRoot)
    .filter(e => e.startsWith('backup-') && fs.statSync(path.join(backupRoot, e)).isDirectory())
    .sort();

  while (entries.length > MAX_BACKUPS) {
    const oldest = entries.shift();
    const dirPath = path.join(backupRoot, oldest);
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`[Backup] Pruned old backup: ${oldest}`);
  }
}

createBackup();
