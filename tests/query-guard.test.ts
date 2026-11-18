import assert from "node:assert/strict";
import test from "node:test";
import { createQueryGuard, type QueryKey } from "../src/query-guard.ts";

const alice: QueryKey = { client: "A", address: "Alice" };
const bob: QueryKey = { client: "A", address: "Bob" };
const otherClient: QueryKey = { client: "B", address: "Alice" };

test("late response from a previous address cannot apply", () => {
  const g = createQueryGuard();
  g.beginQuery(alice);
  const aliceReq = g.startRequest(alice);
  assert.ok(aliceReq);
  g.endQuery();
  g.beginQuery(bob);
  const bobReq = g.startRequest(bob);
  assert.ok(bobReq);
  assert.equal(g.shouldApply(bobReq.generation, bobReq.id), true);
  g.markApplied(bobReq.id);
  assert.equal(g.shouldApply(aliceReq.generation, aliceReq.id), false);
});

test("a retained callback cannot start a request after a switch", () => {
  const g = createQueryGuard();
  g.beginQuery(alice);
  g.endQuery();
  g.beginQuery(bob);
  assert.equal(g.startRequest(alice), null);
  assert.ok(g.startRequest(bob) !== null);
});

test("a slower earlier same-query response may still apply while a later request is pending", () => {
  const g = createQueryGuard();
  g.beginQuery(alice);
  const first = g.startRequest(alice);
  const second = g.startRequest(alice);
  assert.ok(first && second && second.id > first.id);
  assert.equal(first.generation, second.generation);
  assert.equal(g.shouldApply(first.generation, first.id), true);
  g.markApplied(first.id);
  assert.equal(g.shouldApply(second.generation, second.id), true);
  g.markApplied(second.id);
  assert.equal(g.shouldApply(first.generation, first.id), false);
});

test("a client switch is a different query", () => {
  const g = createQueryGuard();
  g.beginQuery(alice);
  const first = g.startRequest(alice);
  assert.ok(first);
  g.endQuery();
  g.beginQuery(otherClient);
  assert.equal(g.shouldApply(first.generation, first.id), false);
  assert.ok(g.startRequest(otherClient) !== null);
});
