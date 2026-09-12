import type {
  OcrWord,
  PageElement,
  PageSnapshot,
  PiiCandidate,
  SanitizedContext,
  SanitizedElement,
} from "./types";
import { detectDomPii, detectOcrPii, detectVisualPii } from "./detector";
import { fusePiiCandidates } from "./fusion";
import type { VisualCandidate } from "./types";

export interface BuildSanitizedContextInput {
  page: PageSnapshot;
  ocrWords?: OcrWord[];
  visualCandidates?: VisualCandidate[];
}

export function buildSanitizedContext(input: BuildSanitizedContextInput): {
  candidates: PiiCandidate[];
  context: SanitizedContext;
  reverseMap: Record<string, string>;
} {
  const domCandidates = detectDomPii(input.page.elements);
  const ocrCandidates = input.ocrWords ? detectOcrPii(input.ocrWords) : [];
  const visualCandidates = input.visualCandidates ? detectVisualPii(input.visualCandidates) : [];
  const candidates = fusePiiCandidates([...domCandidates, ...ocrCandidates, ...visualCandidates]);

  const reverseMap: Record<string, string> = {};
  for (const candidate of candidates) reverseMap[candidate.placeholder] = candidate.value;

  const sanitizedElements = input.page.elements.map((element) => sanitizeElement(element, candidates));

  const context: SanitizedContext = {
    version: 1,
    page: {
      url: sanitizeUrl(input.page.url),
      title: sanitizeString(input.page.title, candidates) ?? "",
      viewport: input.page.viewport,
    },
    elements: sanitizedElements,
    pii: candidates.map(({ id, piiClass, box, confidence, source, placeholder }) => ({
      id,
      piiClass,
      bbox: box,
      confidence,
      source,
      placeholder,
    })),
    stats: {
      detected: candidates.length,
      redacted: candidates.length,
      rawPiiCountInPayload: 0,
    },
  };

  return { candidates, context, reverseMap };
}

function sanitizeElement(element: PageElement, candidates: PiiCandidate[]): SanitizedElement {
  return {
    id: element.id,
    tag: element.tag,
    type: element.type,
    label: sanitizeString(element.label, candidates),
    text: sanitizeString(element.text, candidates),
    placeholder: sanitizeString(element.placeholder, candidates),
    autocomplete: element.autocomplete,
    bbox: element.bbox,
    visible: element.visible,
  };
}

function sanitizeString(value: string | undefined, candidates: PiiCandidate[]): string | undefined {
  if (value === undefined) return undefined;
  let result = value;
  for (const candidate of candidates) {
    if (!candidate.value) continue;
    result = result.split(candidate.value).join(candidate.placeholder);
    result = result.split(candidate.value.toLowerCase()).join(candidate.placeholder);
  }
  return result;
}

function sanitizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "about:blank";
  }
}

