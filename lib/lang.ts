/**
 * Language handling.
 *
 * Detection is a Unicode block check rather than a model call: it is
 * deterministic, free, instant, and the answer is unambiguous for Bangla.
 * Asking a model "what language is this?" would cost a round trip to learn
 * something a regular expression settles.
 *
 * Safe to import from client and server — no secrets, no model identity.
 */

export type Lang = "en" | "bn";

/** Bengali block, plus the digits and marks that accompany it. */
const BANGLA = /[ঀ-৿]/;

export function detectLang(text: string): Lang {
  return BANGLA.test(text) ? "bn" : "en";
}

/** True if any of the user's authored strings are Bangla. */
export function detectFromParts(parts: string[]): Lang {
  return parts.some((p) => BANGLA.test(p)) ? "bn" : "en";
}

export const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  bn: "বাংলা",
};
