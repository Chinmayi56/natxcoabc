/*
 * NTAXCO local development launcher.
 * Starts CRACO with browser auto-open disabled, waits until the dev server
 * is actually responding, then opens the NTAXCO app on localhost.
 */
const { spawn, execFile } = require("child_process");
const path = require("path");
const http = require("http");

const PORT = Number(process.env.PORT || 3000);
const HOST = "127.0.0.1";
const URL = `http://localhost:${PORT}`;
const MAX_WAIT_MS = 60_000;

const env = {
  ...process.env,
  HOST,
  PORT: String(PORT),
  BROWSER: "none",
};

const command = path.resolve(
  __dirname,
  "..",
  "node_modules",
  ".bin",
  process.platform === "win32" ? "craco.cmd" : "craco"
);
// Windows exposes CRACO as craco.cmd. Node cannot spawn a .cmd file
// with shell:false on some Node/Windows combinations (EINVAL). Use the
// Windows command shell only for the .cmd wrapper; Unix keeps a direct spawn.
const spawnOptions = {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
};

const child = spawn(command, ["start"], spawnOptions);

let opened = false;
const startedAt = Date.now();

function openBrowser(url) {
  if (opened) return;
  opened = true;
  console.log(`\nNTAXCO local URL: ${url}\n`);

  if (process.platform === "win32") {
    execFile("cmd", ["/c", "start", "", url]);
  } else if (process.platform === "darwin") {
    execFile("open", [url]);
  } else {
    execFile("xdg-open", [url]);
  }
}

function checkServer() {
  if (opened || Date.now() - startedAt > MAX_WAIT_MS) return;

  const req = http.get({ hostname: HOST, port: PORT, path: "/", timeout: 1000 }, (res) => {
    res.resume();
    if (res.statusCode >= 200 && res.statusCode < 500) openBrowser(URL);
    else setTimeout(checkServer, 500);
  });

  req.on("error", () => setTimeout(checkServer, 500));
  req.on("timeout", () => {
    req.destroy();
    setTimeout(checkServer, 500);
  });
}

setTimeout(checkServer, 500);

child.on("exit", (code, signal) => {
  process.exitCode = typeof code === "number" ? code : 1;
  if (signal) console.error(`NTAXCO frontend stopped (${signal}).`);
});
