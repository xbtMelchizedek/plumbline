/**
 * Source-equivalent of the #321 correlation check.
 *
 * The published @flop-labs/client@0.2.2 patch throws FlopValidationError
 * with the same message after normal receipt shape validation. This helper
 * is the exact-equality rule only: no normalization, retry, or replay.
 */

export const RECEIPT_REQUEST_ID_MISMATCH =
  "Receipt request ID does not match requested ID";

export class ReceiptRequestIdMismatchError extends Error {
  readonly name = "ReceiptRequestIdMismatchError";
  constructor(
    readonly requestedId: string,
    readonly receiptId: string,
  ) {
    super(RECEIPT_REQUEST_ID_MISMATCH);
  }
}

export function assertReceiptMatchesRequest<T extends { request_id: string }>(
  receipt: T,
  requestId: string,
): T {
  if (receipt.request_id !== requestId) {
    throw new ReceiptRequestIdMismatchError(requestId, receipt.request_id);
  }
  return receipt;
}
