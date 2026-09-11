// Phase 1: no-op placeholder.
// This content script will later (Phase 7/25 — live visual overlay) draw
// bounding boxes over detected elements directly on the page. It is
// registered now so the extension's content-script injection path is
// wired up and testable from day one.

console.debug("[SIH26171] content script loaded on", window.location.href);
