/**
 * Source-equivalent of the #44 useBalance invalidation rules, without React.
 *
 * - A query identity is the (client, address) pair currently shown.
 * - Cleanup / a switch increments the generation and drops the active query,
 *   so in-flight results and retained refetch callbacks cannot apply or
 *   start a new RPC for a stale query.
 * - A same-query response is ignored only if a newer response has already
 *   been applied. A slower earlier request may still apply while a later
 *   request is pending, so polling is not starved by latency.
 * - requestId and appliedRequestId are monotonic across queries, as in the
 *   published hook patch. They are not reset on a switch.
 */

export type QueryKey = { readonly client: unknown; readonly address: unknown };

export type StartedRequest = { readonly id: number; readonly generation: number };

export type QueryGuard = {
  beginQuery(query: QueryKey): void;
  endQuery(): void;
  startRequest(query: QueryKey): StartedRequest | null;
  shouldApply(generation: number, id: number): boolean;
  markApplied(id: number): void;
};

export function sameQuery(a: QueryKey | null, b: QueryKey): boolean {
  return a !== null && a.client === b.client && a.address === b.address;
}

export function createQueryGuard(): QueryGuard {
  let requestId = 0;
  let queryGeneration = 0;
  let appliedRequestId = 0;
  let activeQuery: QueryKey | null = null;

  return {
    beginQuery(query) {
      activeQuery = query;
    },
    endQuery() {
      activeQuery = null;
      queryGeneration += 1;
    },
    startRequest(query) {
      if (!sameQuery(activeQuery, query)) return null;
      return { id: ++requestId, generation: queryGeneration };
    },
    shouldApply(generation, id) {
      return generation === queryGeneration && id >= appliedRequestId;
    },
    markApplied(id) {
      appliedRequestId = id;
    },
  };
}
