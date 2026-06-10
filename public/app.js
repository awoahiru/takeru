const form = document.querySelector("#generateForm");
const generateButton = document.querySelector("#generateButton");
const emptyState = document.querySelector("#emptyState");
const loadingState = document.querySelector("#loadingState");
const resultState = document.querySelector("#resultState");
const resultImage = document.querySelector("#resultImage");
const downloadLink = document.querySelector("#downloadLink");
const postToX = document.querySelector("#postToX");
const errorBox = document.querySelector("#errorBox");

const inputs = {
  basePhoto: document.querySelector("#basePhoto")
};

const previews = {
  basePhoto: document.querySelector("#basePreview")
};

const imageState = {
  basePhoto: ""
};

function showOnly(state) {
  emptyState.classList.toggle("hidden", state !== "empty");
  loadingState.classList.toggle("hidden", state !== "loading");
  resultState.classList.toggle("hidden", state !== "result");
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を標準形式に変換できませんでした。"));
    image.src = dataUrl;
  });
}

async function normalizeImageFile(file) {
  const sourceDataUrl = await fileToDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const maxEdge = 2048;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}

function applyPreview(name, dataUrl) {
  imageState[name] = dataUrl;
  previews[name].src = dataUrl;
  previews[name].closest(".drop-zone").classList.toggle("has-image", Boolean(dataUrl));
}

async function postGeneratedImageToX() {
  clearError();

  if (!resultImage.src) {
    showError("先に画像を生成してください。");
    return;
  }

  const text = encodeURIComponent("#たけるとにんケット #にんケット2026");
  window.open(`https://x.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
}

async function handleFile(name, file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showError("画像ファイルを選んでください。");
    return;
  }

  try {
    const dataUrl = await normalizeImageFile(file);
    applyPreview(name, dataUrl);
  } catch (error) {
    showError(error.message || "画像を標準形式に変換できませんでした。");
  }
}

async function generate(event) {
  event.preventDefault();
  clearError();

  if (!imageState.basePhoto) {
    showError("元の写真を選んでください。");
    return;
  }

  generateButton.disabled = true;
  generateButton.querySelector("span").textContent = "生成中";
  showOnly("loading");

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        basePhoto: imageState.basePhoto,
        maskFaces: document.querySelector("#maskFaces").checked,
        quality: "medium",
        size: "auto",
        note: ""
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "生成に失敗しました。");
    }

    resultImage.src = payload.image;
    downloadLink.href = payload.image;
    showOnly("result");
  } catch (error) {
    showOnly("empty");
    showError(error.message || "生成に失敗しました。");
  } finally {
    generateButton.disabled = false;
    generateButton.querySelector("span").textContent = "画像を生成する";
  }
}

for (const [name, input] of Object.entries(inputs)) {
  input.addEventListener("change", () => handleFile(name, input.files?.[0]));
}

form.addEventListener("submit", generate);

postToX.addEventListener("click", postGeneratedImageToX);
