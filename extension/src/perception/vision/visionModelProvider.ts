import type {
  VisualElement,
  VisionBackend,
  VisionRuntimeStatus,
} from "../../shared/types";

/**
 * Abstraction every on-device vision implementation must satisfy.
 *
 * Phase 1 ships only `LightweightFallbackProvider` (a real, if simple,
 * heuristic detector — not a trained model). Phase 2 adds
 * `ONNXVisionProvider` / `TransformersVisionProvider` behind this same
 * interface, chosen automatically by `selectVisionProvider()` based on
 * detected backend capability.
 */
export interface VisionModelProvider {
  readonly name: string;
  readonly backend: VisionBackend;

  /** Load/warm up the model. Fallback provider is a no-op. */
  init(): Promise<void>;

  /**
   * Run perception over a captured screenshot.
   * `imageData` is raw pixel data from the (local, in-browser) canvas —
   * it never leaves this process.
   */
  detect(imageData: ImageData): Promise<VisualElement[]>;
}

/**
 * Detects the best available on-device compute backend.
 * Order of preference: WebGPU > WASM > fallback (no acceleration).
 *
 * This runs inside the offscreen document, which has a real `navigator`,
 * unlike the background service worker.
 */
export async function detectBackend(): Promise<VisionRuntimeStatus> {
  const nav = navigator as Navigator & { gpu?: unknown };

  if (nav.gpu) {
    try {
      // Presence of navigator.gpu is not a guarantee an adapter exists —
      // actually request one before claiming WebGPU is usable.
      const gpu = nav.gpu as {
        requestAdapter: () => Promise<unknown | null>;
      };
      const adapter = await gpu.requestAdapter();
      if (adapter) {
        return {
          backend: "webgpu",
          modelStatus: "fallback",
          detail:
            "WebGPU adapter available. No on-device model loaded yet (Phase 1) — running heuristic fallback detector.",
        };
      }
    } catch {
      // fall through to WASM check
    }
  }

  const hasWasm = typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";
  if (hasWasm) {
    return {
      backend: "wasm",
      modelStatus: "fallback",
      detail:
        "WebGPU unavailable; WebAssembly runtime available. No on-device model loaded yet (Phase 1) — running heuristic fallback detector.",
    };
  }

  return {
    backend: "fallback",
    modelStatus: "fallback",
    detail:
      "Neither WebGPU nor WebAssembly detected. Running heuristic fallback detector only.",
  };
}
