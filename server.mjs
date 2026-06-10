import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import {
  generateImage,
  getImageModel,
  getReferenceAsset,
  mimeTypes,
  readJsonBody,
  referenceAssets,
  referenceBrowserCacheHeader,
  sendJson,
  warmReferenceAssets
} from "./lib/app-core.mjs";

async function loadLocalEnv() {
  try {
    const raw = await readFile(join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await loadLocalEnv();

const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || (NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const publicDir = join(process.cwd(), "public");

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream"
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && req.url?.startsWith("/api/reference/")) {
      const referenceUrl = new URL(req.url, `http://${req.headers.host}`);
      const name = decodeURIComponent(referenceUrl.pathname.split("/").pop() || "");
      const asset = referenceAssets[name];
      const { bytes, contentType } = await getReferenceAsset(name);
      res.writeHead(200, {
        "content-type": contentType || asset.mimeType,
        "content-length": bytes.length,
        "cache-control": referenceBrowserCacheHeader
      });
      res.end(bytes);
      return;
    }

    if (req.method === "GET" && req.url === "/api/config") {
      sendJson(res, 200, {
        hasApiKey: Boolean(process.env.OPENAI_API_KEY),
        model: getImageModel()
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/generate") {
      const payload = await readJsonBody(req);
      const result = await generateImage(payload);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.message || "Unexpected error",
      details: error.details || null
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`たけるとにんケット is running at http://${HOST}:${PORT}`);
  warmReferenceAssets().catch((error) => {
    console.warn(`Reference image preload failed: ${error.message}`);
  });
});
