require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  appPort,
  deployCommands,
  projectRoot,
  startBotProcess,
  stopBot,
} = require("./bot-runtime");

const mode = process.argv[2] === "dev" ? "dev" : "start";
const isDev = mode === "dev";
const label = isDev ? "Development" : "Startup";
const nextBinPath = require.resolve("next/dist/bin/next");
const buildIdPath = path.join(projectRoot, ".next", "BUILD_ID");

let botProcess = null;
let webProcess = null;
let shuttingDown = false;

function describeExit(code, signal) {
  if (signal) {
    return `signal ${signal}`;
  }

  return `exit code ${code ?? 0}`;
}

function ensureProductionBuild() {
  if (isDev) {
    return true;
  }

  if (fs.existsSync(buildIdPath)) {
    return true;
  }

  console.error(`[${label}] Production build not found at .next/BUILD_ID. Run "bun run build" before "bun start".`);
  return false;
}

function startWebProcess() {
  const args = [nextBinPath, mode];

  if (isDev) {
    args.push("--turbopack");
  }

  args.push("-p", appPort);

  console.log(
    `[${label}] Starting ${isDev ? "development" : "production"} web server on http://localhost:${appPort}`,
  );

  return spawn(process.execPath, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });
}

async function stopWebProcess() {
  if (!webProcess) {
    return;
  }

  if (webProcess.exitCode !== null || webProcess.signalCode !== null) {
    return;
  }

  console.log(`[${label}] Stopping web server...`);

  const exited = await new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      webProcess.off("exit", onExit);
      clearTimeout(timeoutId);
    };

    const onExit = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(true);
    };

    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(false);
    }, 5000);

    webProcess.once("exit", onExit);

    try {
      webProcess.kill("SIGTERM");
    } catch {
      settled = true;
      cleanup();
      resolve(false);
    }
  });

  if (exited) {
    return;
  }

  console.log(`[${label}] Web server did not exit in time. Forcing shutdown.`);

  try {
    webProcess.kill("SIGKILL");
  } catch {}
}

async function shutdown({ origin, exitCode = 0, stopWeb = true }) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`[${label}] Shutdown requested by ${origin}.`);

  if (stopWeb) {
    await stopWebProcess();
  }

  await stopBot(label);
  process.exit(exitCode);
}

async function main() {
  if (!ensureProductionBuild()) {
    process.exit(1);
  }

  await stopBot(label);

  if (isDev) {
    try {
      await deployCommands(label);
    } catch (error) {
      console.error(`[${label}] Command deployment failed. Continuing without refreshing slash commands.`, error.message);
    }
  }

  botProcess = await startBotProcess({ label, detached: false });
  webProcess = startWebProcess();

  webProcess.once("exit", async (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.log(`[${label}] Web server exited with ${describeExit(code, signal)}.`);
    await shutdown({
      origin: "web server exit",
      exitCode: typeof code === "number" ? code : 1,
      stopWeb: false,
    });
  });

  webProcess.once("error", async (error) => {
    if (shuttingDown) {
      return;
    }

    console.error(`[${label}] Failed to start web server.`, error);
    await shutdown({ origin: "web server error", exitCode: 1, stopWeb: false });
  });

  if (botProcess) {
    botProcess.once("exit", async (code, signal) => {
      if (shuttingDown) {
        return;
      }

      botProcess = null;
      console.warn(
        `[${label}] Bot process exited with ${describeExit(code, signal)}. The web server will continue running without Discord bot support.`,
      );
    });

    botProcess.once("error", async (error) => {
      if (shuttingDown) {
        return;
      }

      botProcess = null;
      console.warn(`[${label}] Failed to start the Discord bot. The web server will continue running.`, error);
    });
  } else {
    console.log(`[${label}] Bot not started. Web server will run by itself.`);
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(`[${label}] Fatal startup error.`, error);
    await shutdown({ origin: "fatal startup error", exitCode: 1, stopWeb: false });
  });
}

process.on("SIGINT", async () => {
  await shutdown({ origin: "SIGINT" });
});

process.on("SIGTERM", async () => {
  await shutdown({ origin: "SIGTERM" });
});
