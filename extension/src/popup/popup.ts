import type { ExtensionMessage } from "../shared/types";

const runBtn = document.getElementById("runBtn") as HTMLButtonElement;
const backendVal = document.getElementById("backendVal")!;
const modelVal = document.getElementById("modelVal")!;
const modelDetailBox = document.getElementById("modelDetail")!;
const tlCapture = document.getElementById("tl-capture")!;
const tlPerceive = document.getElementById("tl-perceive")!;
const elementsBox = document.getElementById("elements")!;
const errorBox = document.getElementById("error")!;

function resetTimeline() {
  tlCapture.className = "";
  tlCapture.textContent = "○ Screenshot captured locally";
  tlPerceive.className = "";
  tlPerceive.textContent = "○ Visual perception completed";
  modelDetailBox.textContent = "";
  elementsBox.innerHTML = "";
  errorBox.style.display = "none";
  errorBox.textContent = "";
}

function showError(msg: string) {
  errorBox.style.display = "block";
  errorBox.textContent = `⚠ ${msg}`;
}

runBtn.addEventListener("click", async () => {
  resetTimeline();
  runBtn.disabled = true;
  runBtn.textContent = "Capturing...";

  try {
    const response = (await chrome.runtime.sendMessage({
      type: "CAPTURE_AND_PERCEIVE",
    } as ExtensionMessage)) as ExtensionMessage;

    if (response.type === "PERCEPTION_ERROR") {
      showError(response.error);
      return;
    }

    if (response.type === "PERCEPTION_RESULT") {
      const { elements, runtime, timings } = response.payload;

      tlCapture.className = "done";
      tlCapture.textContent = `✓ Screenshot captured locally (${timings.captureMs}ms)`;

      tlPerceive.className = "done";
      tlPerceive.textContent = `✓ Visual perception completed (${timings.inferenceMs}ms, ${elements.length} region${elements.length === 1 ? "" : "s"} found)`;

      backendVal.textContent = runtime.backend.toUpperCase();
      modelVal.textContent = runtime.modelStatus.toUpperCase();
      modelDetailBox.textContent = runtime.detail;

      elementsBox.innerHTML = elements
        .map(
          (el) =>
            `<div class="el-row">${el.id}${el.label ? ` (${el.label})` : ""} · ${el.bbox.width}×${el.bbox.height} @ (${el.bbox.x},${el.bbox.y}) · conf ${el.confidence}</div>`
        )
        .join("");

      if (elements.length === 0) {
        elementsBox.innerHTML = '<div class="el-row">No high-contrast regions found on this page.</div>';
      }
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "Capture & Perceive Current Page";
  }
});
