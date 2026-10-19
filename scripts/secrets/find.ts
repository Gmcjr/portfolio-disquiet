// Finds strings that look like a Resend API key (they start with re_).
// Pure, so the pattern can be tested; scan-secrets.ts does the file I/O.

const RESEND_KEY = /\bre_[A-Za-z0-9_]{24,}/;

/** 1-based line numbers that contain a key-like string. */
export function findSecrets(text: string): number[] {
  return text
    .split('\n')
    .flatMap((line, i) => (RESEND_KEY.test(line) ? [i + 1] : []));
}
