import { getImageModel, sendJson } from "../lib/app-core.mjs";

export default function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  sendJson(res, 200, {
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    model: getImageModel()
  });
}
