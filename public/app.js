const form = document.querySelector("#generateForm");
const generateButton = document.querySelector("#generateButton");
const emptyState = document.querySelector("#emptyState");
const loadingState = document.querySelector("#loadingState");
const resultState = document.querySelector("#resultState");
const resultImage = document.querySelector("#resultImage");
const saveToPhotos = document.querySelector("#saveToPhotos");
const postToX = document.querySelector("#postToX");
const fanSiteBanner = document.querySelector(".fan-site-banner");
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

let generatedImageDataUrl = "";

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
  const maxEdge = 1280;
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

  return canvas.toDataURL("image/jpeg", 0.86);
}

function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/^data:([^;]+)/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], filename, { type: mimeType });
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

async function saveGeneratedImageToPhotos() {
  clearError();

  if (!generatedImageDataUrl) {
    showError("先に画像を生成してください。");
    return;
  }

  const file = dataUrlToFile(generatedImageDataUrl, "takeru-ninket.png");

  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({
        files: [file],
        title: "たけるとにんケット",
        text: "生成した画像を保存します。"
      });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
      showError("保存画面を開けませんでした。画像を長押しして保存してください。");
      return;
    }
  }

  const link = document.createElement("a");
  link.href = generatedImageDataUrl;
  link.download = "takeru-ninket.png";
  link.click();
}

function openFanSiteInNewWindow(event) {
  event.preventDefault();
  const url = fanSiteBanner.href;
  window.open(url, "_blank");
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
    const imageAspect = previews.basePhoto.naturalWidth / previews.basePhoto.naturalHeight;
    const outputSize = imageAspect > 1.15 ? "1536x1024" : imageAspect < 0.87 ? "1024x1536" : "1024x1024";

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        basePhoto: imageState.basePhoto,
        maskFaces: document.querySelector("#maskFaces").checked,
        quality: "medium",
        size: outputSize,
        note: ""
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "生成に失敗しました。");
    }

    generatedImageDataUrl = payload.image;
    resultImage.src = payload.image;
    showOnly("result");
  } catch (error) {
    showOnly("empty");
    const message = error.message === "Load failed" || error.message === "Failed to fetch"
      ? "画像生成サーバーとの通信が途中で切れてしまいました。少し時間をおいて、もう一度試してください。"
      : error.message || "生成に失敗しました。";
    showError(message);
  } finally {
    generateButton.disabled = false;
    generateButton.querySelector("span").textContent = "画像を生成する";
  }
}

for (const [name, input] of Object.entries(inputs)) {
  input.addEventListener("change", () => handleFile(name, input.files?.[0]));
}

form.addEventListener("submit", generate);

saveToPhotos.addEventListener("click", saveGeneratedImageToPhotos);
postToX.addEventListener("click", postGeneratedImageToX);
fanSiteBanner.addEventListener("click", openFanSiteInNewWindow);
