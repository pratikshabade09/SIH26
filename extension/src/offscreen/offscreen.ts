import type { OffscreenRequest, OffscreenResponse } from "../shared/types";
import { selectVisionProvider } from "../perception/vision";

// Cache the provider across calls within this offscreen document's
// lifetime so repeated captures don't re-detect the backend every time.
let providerPromise: ReturnType<typeof selectVisionProvider> | null = null;

async function getProvider() {
  if (!providerPromise) {
    providerPromise = selectVisionProvider();
  }
  return providerPromise;
}

async function handlePerceive(req: OffscreenRequest): Promise<OffscreenResponse> {
  const inferenceStart = performance.now();
  try {
    const blob = await (await fetch(req.dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not acquire 2D canvas context in offscreen document");
    }
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const { detect, runtime } = await getProvider();
    const elements = await detect(imageData);

    const inferenceMs = performance.now() - inferenceStart;

    return {
      type: "OFFSCREEN_PERCEIVE_RESULT",
      payload: {
        elements,
        runtime,
        timings: {
          captureMs: Math.round(req.captureMs),
          inferenceMs: Math.round(inferenceMs),
          totalMs: Math.round(req.captureMs + inferenceMs),
        },
      },
    };
  } catch (err) {
    return {
      type: "OFFSCREEN_PERCEIVE_ERROR",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

chrome.runtime.onMessage.addListener((message: OffscreenRequest, _sender, sendResponse) => {
  if (message?.type !== "OFFSCREEN_PERCEIVE") return undefined;
  handlePerceive(message).then(sendResponse);
  return true; // keep the message channel open for the async response
});
