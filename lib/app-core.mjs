import { readFile } from "node:fs/promises";
import { join } from "node:path";

const publicDir = join(process.cwd(), "public");

export const referenceAssets = {
  boy: {
    fileId: "1InSoOU08Wej2VD6F207-wsUKnaYUl7Dr",
    fallbackPath: join(publicDir, "assets", "boy-reference.png"),
    filename: "boy-reference.png",
    mimeType: "image/png"
  },
  hero: {
    fileId: "19HnSIGWfhjvf5XEol5rzvt73Do98BEmZ",
    fallbackPath: join(publicDir, "assets", "hero-takeru-snake.png"),
    filename: "hero-takeru-snake.png",
    mimeType: "image/png"
  },
  snake: {
    fileId: "1_Byv4K4SJGV96cEB0brg8Biau5aoLS3Y",
    fallbackPath: join(publicDir, "assets", "snake-reference.png"),
    filename: "snake-reference.png",
    mimeType: "image/png"
  },
  banner: {
    fileId: "1SQoPg-PZNwRAAXaoi83PATvT2lKbuj4-",
    fallbackPath: join(publicDir, "assets", "orochi-fan-site-banner.png"),
    filename: "orochi-fan-site-banner.png",
    mimeType: "image/png"
  }
};

export const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

const referenceCache = new Map();
const referenceFetches = new Map();
const referenceCacheMaxAgeMs = 1000 * 60 * 60 * 24;
export const referenceBrowserCacheHeader = "public, max-age=604800, stale-while-revalidate=86400";

export function getImageModel() {
  return process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
}

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("content-length", Buffer.byteLength(body));
  res.end(body);
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function dataUrlToBlob(dataUrl, fallbackName) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error(`${fallbackName} is not a valid image data URL.`);
  const [, mimeType, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  return new Blob([bytes], { type: mimeType });
}

async function fetchDriveAsset(asset) {
  const url = `https://drive.google.com/uc?export=download&id=${asset.fileId}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "takeru-ninket-photo-app"
    }
  });

  if (!response.ok) {
    throw new Error(`Drive image download failed: ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || asset.mimeType;
  if (!contentType.startsWith("image/")) {
    throw new Error(`Drive returned non-image content: ${contentType}`);
  }

  return { bytes, contentType };
}

export async function getReferenceAsset(name) {
  const asset = referenceAssets[name];
  if (!asset) {
    const error = new Error("Reference asset not found.");
    error.status = 404;
    throw error;
  }

  const cached = referenceCache.get(name);
  if (cached && Date.now() - cached.cachedAt < referenceCacheMaxAgeMs) {
    return cached;
  }

  const existingFetch = referenceFetches.get(name);
  if (existingFetch) return existingFetch;

  const fetchTask = (async () => {
    let result;

    try {
      result = await fetchDriveAsset(asset);
    } catch (error) {
      try {
        const bytes = await readFile(asset.fallbackPath);
        result = {
          bytes,
          contentType: asset.mimeType,
          fallbackReason: error.message
        };
      } catch {
        throw error;
      }
    }

    const cachedResult = {
      ...result,
      cachedAt: Date.now()
    };
    referenceCache.set(name, cachedResult);
    return cachedResult;
  })();

  referenceFetches.set(name, fetchTask);

  try {
    return await fetchTask;
  } finally {
    referenceFetches.delete(name);
  }
}

export async function warmReferenceAssets() {
  await Promise.allSettled(Object.keys(referenceAssets).map((name) => getReferenceAsset(name)));
}

export async function referenceAssetToBlob(name) {
  const asset = referenceAssets[name];
  const { bytes, contentType } = await getReferenceAsset(name);
  return new Blob([bytes], { type: contentType || asset.mimeType });
}

export function buildPrompt({ maskFaces, note }) {
  return [
    "1枚目の写真に、2枚目の男の子を違和感なく馴染ませて入れて。男の子の相棒として、3枚目の蛇も入れて。",
    maskFaces ? "1枚目の写真に人間がいる場合のみ、1枚目にもともと写っている人間全員（メインの人、背景の人、小さく写る人、横顔や一部だけ写る人を含む）の顔に蛇デザインのお面をつけて隠して。2枚目から追加する男の子にはお面をつけないで。既存の人物の削除・追加・位置変更はせず、それ以外は変更不可です。" : "",
    note ? `追加指示: ${note}` : ""
  ].filter(Boolean).join("\n");
}

export async function generateImage(payload) {
  const openaiApiKey = process.env.OPENAI_API_KEY || "";
  if (!openaiApiKey) {
    const error = new Error("OPENAI_API_KEY is not set.");
    error.status = 401;
    throw error;
  }

  const { basePhoto, maskFaces, quality, size, note } = payload;
  if (!basePhoto) {
    const error = new Error("Base photo is required.");
    error.status = 400;
    throw error;
  }

  const form = new FormData();
  form.append("model", getImageModel());
  form.append("prompt", buildPrompt({ maskFaces, note }));
  form.append("image[]", dataUrlToBlob(basePhoto, "base photo"), "base-photo.jpg");
  form.append("image[]", await referenceAssetToBlob("boy"), referenceAssets.boy.filename);
  form.append("image[]", await referenceAssetToBlob("snake"), referenceAssets.snake.filename);
  form.append("quality", quality || "medium");
  form.append("size", size || "auto");
  form.append("output_format", "png");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`
    },
    body: form
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(json?.error?.message || "Image generation failed.");
    error.status = response.status;
    error.details = json;
    throw error;
  }

  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    const error = new Error("OpenAI returned no image data.");
    error.status = 502;
    error.details = json;
    throw error;
  }

  return {
    image: `data:image/png;base64,${b64}`,
    usage: json.usage || null,
    model: getImageModel()
  };
}
