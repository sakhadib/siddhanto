// Shared between the /api/advise route and the client reader. Kept in its own
// module so importing it never drags lib/advise.ts (and the model name) into
// a client bundle.

export const ADVISE_ERR = `${String.fromCharCode(0x1e)}ERR:`;

/* A status frame marks a phase change without emitting prose. A Bangla reader
   waits twice — once for the model to write the Reading, once for it to be
   translated back — and without this the client cannot tell the second wait
   from a stalled first one.

   The frame is terminated by U+001F rather than a newline, because the prose
   is plain text and may itself contain line breaks. */
const STATUS_FRAME = new RegExp(
  `${String.fromCharCode(0x1e)}STATUS:([^${String.fromCharCode(0x1f)}]*)${String.fromCharCode(0x1f)}`,
  "g"
);

export function statusFrame(text: string): string {
  return `${String.fromCharCode(0x1e)}STATUS:${text}${String.fromCharCode(0x1f)}`;
}

export interface AdviseParts {
  text: string;
  error: string | null;
  /** The last status frame seen, or null if the server sent none. */
  status: string | null;
}

/** Split a raw advise stream into its prose, its last status frame, and any
 *  trailing in-band error. Status frames are stripped wherever they appear
 *  rather than assumed to lead, since one can arrive mid-stream. */
export function splitAdviseStream(raw: string): AdviseParts {
  const errAt = raw.indexOf(ADVISE_ERR);
  const body = errAt < 0 ? raw : raw.slice(0, errAt);
  const error = errAt < 0 ? null : raw.slice(errAt + ADVISE_ERR.length);

  let status: string | null = null;
  const text = body.replace(STATUS_FRAME, (_m, value: string) => {
    const trimmed = value.trim();
    if (trimmed) status = trimmed;
    return "";
  });

  return { text, error, status };
}
