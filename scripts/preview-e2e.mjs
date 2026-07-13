import { spawn } from "node:child_process";

const children = [];

const waitFor = async (url, timeoutMs = 120_000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const spawnProcess = (command, args, env = {}) => {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ...env
    }
  });
  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      process.exitCode = code;
      stopChildren();
    }
  });
  children.push(child);
  return child;
};

const stopChildren = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
};

process.on("SIGINT", () => {
  stopChildren();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopChildren();
  process.exit(0);
});

spawnProcess("pnpm", ["--filter", "@neon-duel/server", "start"], {
  PORT: "3001",
  CLIENT_ORIGIN: "http://127.0.0.1:4173",
  INVITATION_BASE_URL: "http://127.0.0.1:4173"
});

spawnProcess("pnpm", ["--filter", "@neon-duel/client", "preview"]);

await Promise.all([waitFor("http://127.0.0.1:3001/health"), waitFor("http://127.0.0.1:4173")]);

await new Promise(() => {});
