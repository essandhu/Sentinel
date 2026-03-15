import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies a Figma webhook payload signature using HMAC-SHA256.
 *
 * @param rawBody - The raw request body string
 * @param signatureHeader - The signature from the X-Figma-Signature header
 * @param passcode - The webhook passcode (shared secret)
 * @returns true if the signature is valid, false otherwise
 */
export function verifyFigmaWebhook(
  rawBody: string,
  signatureHeader: string,
  passcode: string,
): boolean {
  const expected = createHmac('sha256', passcode).update(rawBody).digest('hex');

  const sigBuf = Buffer.from(signatureHeader, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  // Guard: timingSafeEqual throws if buffers have different lengths
  if (sigBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(sigBuf, expectedBuf);
}
