import { generateImage, readJsonBody, sendJson } from "../lib/app-core.mjs";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"
    }
  },
  maxDuration: 60
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const payload = await readJsonBody(req);
    const result = await generateImage(payload);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.message || "Unexpected error",
      details: error.details || null
    });
  }
}
