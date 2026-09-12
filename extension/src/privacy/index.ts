export * from "./types";
export * from "./detector";
export * from "./fusion";
export * from "./sanitizer";
export * from "./leakChecker";
export * from "./redactor";

import { buildSanitizedContext } from "./sanitizer";
import { checkSanitizedContext } from "./leakChecker";
import type { BuildSanitizedContextInput } from "./sanitizer";
import type { PrivacyResult } from "./types";

/**
 * Main API for the extension integration.
 * Raw PII stays in the returned reverseMap and candidates, both of which are
 * local-only objects. The sanitizedContext contains placeholders only.
 */
export function sanitizePage(input: BuildSanitizedContextInput): PrivacyResult {
  const { candidates, context, reverseMap } = buildSanitizedContext(input);
  const leakCheck = checkSanitizedContext(context, candidates);

  const safeContext = {
    ...context,
    stats: {
      ...context.stats,
      rawPiiCountInPayload: leakCheck.leakedValues.length + leakCheck.patternMatches.length,
    },
  };

  return {
    candidates,
    sanitizedContext: safeContext,
    reverseMap,
    safeToTransmit: leakCheck.safe,
  };
}
