import {
  getReferenceAsset,
  referenceAssets,
  referenceBrowserCacheHeader,
  sendJson
} from "../../lib/app-core.mjs";

export const config = {
  maxDuration: 30
};

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const rawName = req.query?.name;
    const name = Array.isArray(rawName) ? rawName[0] : rawName;
    const asset = referenceAssets[name];
    const { bytes, contentType } = await getReferenceAsset(name);

    res.statusCode = 200;
    res.setHeader("content-type", contentType || asset.mimeType);
    res.setHeader("content-length", bytes.length);
    res.setHeader("cache-control", referenceBrowserCacheHeader);
    if (req.method === "HEAD") {
      res.end();
      return;
    }

    res.end(bytes);
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.message || "Unexpected error",
      details: error.details || null
    });
  }
}
