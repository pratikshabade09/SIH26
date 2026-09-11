import type {
  ExtensionMessage,
  OffscreenRequest,
  OffscreenResponse,
} from "../shared/types";

const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/offscreen.html";

/**
 * Everything in this file runs locally in the extension's service worker.
 * Nothing here talks to any server — Phase 1 has no network step at all.
 * The screenshot never leaves this process boundary.
 */

async function ensureOffscreenDocument(): Promise<void> {
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (existing.length > 0) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.BLOBS],
    justification:
      "Convert the locally captured screenshot to pixel data and run on-device visual perception (canvas requires a DOM, which service workers do not have).",
  });
}

async function captureAndPerceive(): Promise<ExtensionMessage> {
  const captureStart = performance.now();

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.windowId) {
    return { type: "PERCEPTION_ERROR", error: "No active tab found to capture." };
  }

  let dataUrl: string;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, { format: "png" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { type: "PERCEPTION_ERROR", error: `Screenshot capture failed: ${msg}` };
  }
  const captureMs = performance.now() - captureStart;

  await ensureOffscreenDocument();

  const request: OffscreenRequest = { type: "OFFSCREEN_PERCEIVE", dataUrl, captureMs };
  const response = (await chrome.runtime.sendMessage(request)) as OffscreenResponse | undefined;

  if (!response) {
    return { type: "PERCEPTION_ERROR", error: "No response from offscreen perception worker." };
  }
  if (response.type === "OFFSCREEN_PERCEIVE_ERROR") {
    return { type: "PERCEPTION_ERROR", error: response.error };
  }
  return { type: "PERCEPTION_RESULT", payload: response.payload };
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message?.type === "CAPTURE_AND_PERCEIVE") {
    captureAndPerceive().then(sendResponse);
    return true; // async response
  }
  return undefined;
});
