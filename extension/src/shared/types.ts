// Shared type contracts used across the extension.
// Phase 1 scope: only what's needed for screenshot capture + the
// visual perception foundation (provider abstraction + fallback).
// PII/privacy/action types will be added in later phases.

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ElementType =
  | "button"
  | "text_field"
  | "password_field"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "link"
  | "menu"
  | "nav"
  | "card"
  | "form"
  | "text_region"
  | "unknown";

export interface VisualElement {
  id: string;
  type: ElementType;
  label: string;
  bbox: BoundingBox;
  confidence: number;
  source: "vision" | "dom" | "vision+dom";
}

export type VisionBackend = "webgpu" | "wasm" | "fallback";
export type ModelStatus = "loaded" | "loading" | "fallback" | "error";

export interface VisionRuntimeStatus {
  backend: VisionBackend;
  modelStatus: ModelStatus;
  detail: string;
}

export interface PerceptionResult {
  elements: VisualElement[];
  runtime: VisionRuntimeStatus;
  timings: {
    captureMs: number;
    inferenceMs: number;
    totalMs: number;
  };
}

// Message protocol between popup <-> background <-> content script.
export type ExtensionMessage =
  | { type: "CAPTURE_AND_PERCEIVE" }
  | { type: "PERCEPTION_RESULT"; payload: PerceptionResult }
  | { type: "PERCEPTION_ERROR"; error: string }
  | { type: "GET_RUNTIME_STATUS" }
  | { type: "RUNTIME_STATUS"; payload: VisionRuntimeStatus };

// Internal protocol between background service worker <-> offscreen
// document (the offscreen doc is where actual canvas/pixel processing
// happens, since MV3 service workers have no DOM).
export type OffscreenRequest = {
  type: "OFFSCREEN_PERCEIVE";
  dataUrl: string;
  captureMs: number;
};

export type OffscreenResponse =
  | { type: "OFFSCREEN_PERCEIVE_RESULT"; payload: PerceptionResult }
  | { type: "OFFSCREEN_PERCEIVE_ERROR"; error: string };
