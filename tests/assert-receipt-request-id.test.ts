import assert from "node:assert/strict";
import test from "node:test";
import {
  RECEIPT_REQUEST_ID_MISMATCH,
  ReceiptRequestIdMismatchError,
  assertReceiptMatchesRequest,
} from "../src/assert-receipt-request-id.ts";

const receipt = (id: string) => ({ request_id: id, state: "estimated" });

test("matching id is returned unchanged", () => {
  const r = receipt("request-a");
  assert.equal(assertReceiptMatchesRequest(r, "request-a"), r);
});

test("a different id is rejected with exact equality", () => {
  assert.throws(
    () => assertReceiptMatchesRequest(receipt("request-b"), "request-a"),
    (err: unknown) =>
      err instanceof ReceiptRequestIdMismatchError &&
      err.message === RECEIPT_REQUEST_ID_MISMATCH &&
      err.requestedId === "request-a" &&
      err.receiptId === "request-b",
  );
});

test("case differences are not normalized", () => {
  assert.throws(
    () => assertReceiptMatchesRequest(receipt("REQUEST-A"), "request-a"),
    ReceiptRequestIdMismatchError,
  );
});
