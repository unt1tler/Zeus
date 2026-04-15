const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const syncConfig = require("./sync-bot-config");

const projectRoot = path.join(__dirname, "..");
const botScriptPath = path.join(projectRoot, "src", "bot", "index.js");
const deployScriptPath = path.join(projectRoot, "src", "bot", "deploy-commands.js");
const settingsPath = path.join(projectRoot, "data", "settings.json");
const pidFilePath = path.join(projectRoot, "src", "bot", "bot.pid");
const appPort = process.env.PORT?.trim() || "9002";
const internalPanelUrl = `http://localhost:${appPort}`;

function removePidFile() {
  if (fs.existsSync(pidFilePath)) {
    fs.unlinkSync(pidFilePath);
  }
}

function readSettings(label) {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch (error) {
    console.log(`[${label}] Could not read settings. Bot will not be started.`, error);
    return null;
  }
}

function waitForChildExit(child, failureMessage) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${failureMessage} Exit code: ${code ?? "unknown"}.`));
    });
  });
}

async function waitForProcessExit(pid, timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      process.kill(pid, 0);
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      if (error.code === "ESRCH") {
        return true;
      }
      throw error;
    }
  }

  return false;
}

async function stopBot(label) {
  try {
    if (!fs.existsSync(pidFilePath)) {
      return;
    }

    const rawPid = fs.readFileSync(pidFilePath, "utf8").trim();
    const pid = Number.parseInt(rawPid, 10);

    if (!Number.isInteger(pid)) {
      removePidFile();
      return;
    }

    console.log(`[${label}] Stopping existing bot process with PID: ${pid}`);

    try {
      process.kill(pid, "SIGTERM");
      const exited = await waitForProcessExit(pid);
      if (!exited) {
        console.log(`[${label}] Bot process did not exit in time. Forcing shutdown for PID: ${pid}`);
        process.kill(pid, "SIGKILL");
      }
    } catch (error) {
      if (error.code !== "ESRCH") {
        console.log(`[${label}] Could not stop bot process, it may have already been stopped.`, error.message);
      }
    }

    removePidFile();
  } catch (error) {
    console.log(`[${label}] Error while stopping bot:`, error.message);
  }
}

async function deployCommands(label) {
  console.log(`[${label}] Deploying Discord commands...`);

  const child = spawn(process.execPath, [deployScriptPath], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });

  await waitForChildExit(child, `[${label}] Command deployment failed.`);
}

function startBotProcess({ label, detached }) {
  syncConfig();

  const settings = readSettings(label);
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!settings?.discordBot?.enabled || !token) {
    console.log(`[${label}] Discord bot is disabled or DISCORD_BOT_TOKEN is missing. Not starting.`);
    return null;
  }

  console.log(`[${label}] Starting Discord bot process...`);

  const botProcess = spawn(process.execPath, [botScriptPath], {
    cwd: projectRoot,
    detached,
    stdio: "inherit",
    env: {
      ...process.env,
      DISCORD_BOT_TOKEN: token,
      PANEL_URL: settings.panelUrl,
      INTERNAL_PANEL_URL: internalPanelUrl,
      API_KEY: settings.apiKey,
    },
  });

  fs.writeFileSync(pidFilePath, String(botProcess.pid));
  console.log(`[${label}] Bot process started with PID: ${botProcess.pid}`);

  if (detached) {
    botProcess.unref();
    return botProcess;
  }

  botProcess.on("exit", (code) => {
    console.log(`[${label}] Bot process exited with code ${code}`);
    try {
      removePidFile();
    } catch {}
  });

  return botProcess;
}

module.exports = {
  appPort,
  deployCommands,
  projectRoot,
  startBotProcess,
  stopBot,
};
