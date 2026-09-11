import { detectBackend, type VisionModelProvider } from "./visionModelProvider";
import { LightweightFallbackProvider } from "./fallbackProvider";
import { TransformersVisionProvider } from "./transformersProvider";
import type { VisualElement, VisionRuntimeStatus } from "../../shared/types";

export type { VisionModelProvider } from "./visionModelProvider";

/**
 * Detects the runtime backend and returns the perception function to use.
 *
 * Phase 2: attempts to load a real on-device model
 * (TransformersVisionProvider). If that succeeds, its detections are
 * combined with the Phase 1 heuristic fallback (which still gives useful
 * coverage on ordinary webpage UI, since the model is a general photo
 * object-detector, not UI-trained — see transformersProvider.ts).
 *
 * If the real model fails to load for any reason (offline, blocked by
 * the browser's extension CSP, out of memory, etc.) this catches the
 * error, does NOT pretend AI inference happened, and reports
 * modelStatus "fallback"/"error" honestly while still returning working
 * heuristic results.
 */
export async function selectVisionProvider(): Promise<{
  detect: (imageData: ImageData) => Promise<VisualElement[]>;
  runtime: VisionRuntimeStatus;
}> {
  const backendInfo = await detectBackend();
  const heuristic = new LightweightFallbackProvider(backendInfo.backend);
  await heuristic.init();

  let modelProvider: VisionModelProvider | null = null;
  let runtime: VisionRuntimeStatus = backendInfo;

  try {
    const tp = new TransformersVisionProvider(backendInfo.backend);
    await tp.init();
    modelProvider = tp;
    runtime = {
      backend: backendInfo.backend,
      modelStatus: "loaded",
      detail: `${tp.name} loaded and running on-device via ${backendInfo.backend}. Results are merged with the heuristic contrast-region detector for UI coverage.`,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    runtime = {
      backend: backendInfo.backend,
      modelStatus: "fallback",
      detail: `Real on-device model failed to load (${reason}). Running heuristic fallback detector only - no AI inference occurred.`,
    };
  }

  const detect = async (imageData: ImageData): Promise<VisualElement[]> => {
    const heuristicElements = await heuristic.detect(imageData);
    if (!modelProvider) return heuristicElements;

    try {
      const modelElements = await modelProvider.detect(imageData);
      return [...modelElements, ...heuristicElements];
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn("[SIH26171] model inference failed, using heuristic only:", reason);
      return heuristicElements;
    }
  };

  return { detect, runtime };
}
