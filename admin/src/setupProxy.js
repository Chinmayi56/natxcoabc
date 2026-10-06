/*
 * NTAXCO dev-server proxy (used by `yarn start` / `npm start` on ANY port, e.g. Admin on 3004).
 *
 * Browser -> http://localhost:3004/api/...  ->  FastAPI at BACKEND_URL (default http://127.0.0.1:8001)
 *
 * Why this file exists: package.json already has  "proxy": "http://127.0.0.1:8001",  but that shorthand
 * fails silently - if FastAPI is down the browser sees a bodiless 500, and if a STALE backend is running
 * on 8001 (an older copy without the newer routes) the browser sees a plain 404 for routes that exist in
 * this project's code, e.g. GET /api/admin/customers/summary. This explicit proxy:
 *   1. always forwards /api/* to the FastAPI port, whatever port the frontend itself runs on;
 *   2. answers a down backend with a JSON 502 that names the URL it tried;
 *   3. at startup asks the backend (GET /api/health) whether it has the Admin -> Customers routes and
 *      prints a clear warning if it is stale or unreachable.
 *
 * Override the target with BACKEND_URL (e.g. BACKEND_URL=http://127.0.0.1:8001). No app code changes.
 */
const { createProxyMiddleware } = require("http-proxy-middleware");
const http = require("http");

const TARGET = (process.env.BACKEND_URL || "http://127.0.0.1:8001").replace(/\/+$/, "");

function checkBackend() {
  const req = http.get(`${TARGET}/api/health`, { timeout: 4000 }, (res) => {
    let body = "";
    res.on("data", (c) => { body += c; });
    res.on("end", () => {
      if (res.statusCode !== 200) {
        console.warn(
          `\n[NTAXCO proxy] ${TARGET}/api/health answered HTTP ${res.statusCode}. ` +
            "Whatever is listening there is NOT this project's backend (or is a stale older revision). " +
            "Stop it and start this project's backend:  cd backend && python run_local.py\n"
        );
        return;
      }
      try {
        const features = JSON.parse(body).features || {};
        const missing = ["customer_summary", "workflow_drag_drop"].filter((k) => features[k] !== true);
        if (missing.length) {
          console.warn(
            `\n[NTAXCO proxy] The backend on ${TARGET} is a STALE revision - it is missing: ${missing.join(", ")}.\n` +
              "  That is why /api/admin/customers/summary returns 404. Stop the old uvicorn process and restart it\n" +
              "  from THIS project's backend folder:  cd backend && python run_local.py   (port 8001)\n"
          );
        } else {
          console.info(`[NTAXCO proxy] /api -> ${TARGET}  (backend OK: customer summary + drag-drop routes present)`);
        }
      } catch (e) {
        console.warn(`[NTAXCO proxy] ${TARGET}/api/health did not return JSON - not this project's backend.`);
      }
    });
  });
  req.on("timeout", () => req.destroy());
  req.on("error", () => {
    console.warn(
      `\n[NTAXCO proxy] Cannot reach the FastAPI backend at ${TARGET}. Start it:  cd backend && python run_local.py\n`
    );
  });
}

module.exports = function setupProxy(app) {
  app.use(
    createProxyMiddleware("/api", {
      target: TARGET,
      changeOrigin: true,
      onError(err, req, res) {
        if (res.headersSent) return;
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          detail: `Cannot reach the FastAPI backend at ${TARGET} (${err.code || err.message}). ` +
            "Start it with: cd backend && python run_local.py",
        }));
      },
    })
  );
  setTimeout(checkBackend, 1500);
};
