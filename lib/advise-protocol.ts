// Shared between the /api/advise route and the client reader. Kept in its own
// module so importing it never drags lib/advise.ts (and the model name) into
// a client bundle.
export const ADVISE_ERR = `${String.fromCharCode(0x1e)}ERR:`;

/** Split a raw advise stream into its prose and any trailing in-band error. */
export function splitAdviseStream(raw: string): { text: string; error: string | null } {
  const at = raw.indexOf(ADVISE_ERR);
  if (at < 0) return { text: raw, error: null };
  return { text: raw.slice(0, at), error: raw.slice(at + ADVISE_ERR.length) };
}
