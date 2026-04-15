require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });

const { spawn } = require("node:child_process");
const { deployCommands, projectRoot } = require("./bot-runtime");

const label = "Build";
const nextBinPath = require.resolve("next/dist/bin/next");

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

async function buildWebApp() {
  console.log(`[${label}] Starting Next.js production build...`);

  const child = spawn(process.execPath, [nextBinPath, "build"], {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
  });

  await waitForChildExit(child, `[${label}] Web build failed.`);
}

async function main() {
  try {
    await deployCommands(label);
  } catch (error) {
    console.warn(
      `[${label}] Discord command deployment failed. Continuing with the web build only.`,
      error.message,
    );
  }

  await buildWebApp();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[${label}] Build failed.`, error);
    process.exit(1);
  });
}
