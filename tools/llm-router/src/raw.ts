/**
 * R4-U3 · Raw provider-body retention.
 *
 * One job: turn the exact bytes a provider returned into a {@link RawProviderResponse}
 * that can be persisted, with truncation made explicit rather than silent.
 *
 * The design rule this file exists to enforce: **a cut body must still name the
 * body it was cut from.** `sha256` is always computed over the FULL, untruncated
 * bytes, so a capped record is evidence of a specific response rather than an
 * anonymous fragment; `bytes` records the original length and `truncated` says
 * plainly that something was removed. Nothing here decides *whether* to retain —
 * that is the caller's (defaulted-on) choice in `routes/apiWorker.ts`.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions. No network, no fs.
 */

import { createHash } from 'node:crypto';

import { DEFAULT_RAW_BODY_CAP_BYTES, type RawProviderResponse } from './types.js';

/**
 * Cut a UTF-8 buffer to at most `capBytes`, backing off to the last COMPLETE
 * character. A naive byte slice can land inside a multi-byte sequence, which
 * decodes to U+FFFD and — because U+FFFD re-encodes to 3 bytes — can make the
 * stored string LARGER than the cap it was supposed to respect. Backing off to a
 * character boundary keeps `capBytes` a real bound and keeps the retained bytes a
 * faithful prefix of what the provider sent.
 */
function cutAtCharBoundary(buf: Buffer, capBytes: number): Buffer {
  let end = capBytes;
  // 0b10xxxxxx is a UTF-8 continuation byte: if the first EXCLUDED byte is one,
  // the cut is mid-character, so walk back to the start of that character.
  while (end > 0 && (buf[end]! & 0xc0) === 0x80) end--;
  return buf.subarray(0, end);
}

/**
 * Capture a raw response body under a byte cap.
 *
 * Truncation is measured on the BYTE buffer (not the JS string) so `capBytes` is
 * a real bound on what lands on disk regardless of how many multi-byte characters
 * the body contains.
 *
 * `capBytes <= 0` is treated as "no cap" (retain everything).
 */
export function captureRawBody(
  text: string,
  capBytes: number = DEFAULT_RAW_BODY_CAP_BYTES,
): RawProviderResponse {
  const buf = Buffer.from(text, 'utf8');
  const sha256 = `sha256:${createHash('sha256').update(buf).digest('hex')}`;
  const uncapped = capBytes <= 0 || buf.byteLength <= capBytes;
  return {
    body: uncapped ? text : cutAtCharBoundary(buf, capBytes).toString('utf8'),
    bytes: buf.byteLength,
    truncated: !uncapped,
    capBytes,
    sha256,
  };
}
