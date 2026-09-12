# Local privacy engine

This module is the privacy/sanitization part of SIH 26171.

## Ownership

This folder is intended to be owned by the privacy/PII side of the team. The browser-extension integration should call the public `sanitizePage()` function from `index.ts`.

## Input

`sanitizePage()` accepts a `PageSnapshot` plus optional OCR words and visual candidates.

## Output

It returns:

- `candidates`: local-only PII detections, including raw values.
- `reverseMap`: local-only placeholder -> raw-value mapping.
- `sanitizedContext`: the server-safe structured representation. It contains placeholders only.
- `safeToTransmit`: result of a second-pass leak check.

The rule is that **only `sanitizedContext` may ever cross a future network boundary**. Do not serialize `candidates` or `reverseMap` for network transmission.

## Current sources

- DOM: strongest signal for password, email, phone, payment and autocomplete fields.
- OCR: structured PII such as email, phone, PAN, Aadhaar, card, IFSC, DOB and account numbers.
- Vision: currently accepts visual candidates such as face/person regions and other sensitive-document candidates.

## Example

```ts
const result = sanitizePage({
  page: pageSnapshot,
  ocrWords,
  visualCandidates,
});

if (!result.safeToTransmit) {
  throw new Error("Privacy gate blocked transmission");
}

// Later: ONLY this object can be sent to a server.
const payload = result.sanitizedContext;
```
