import type { VoidRouter } from "void/pages-client";

/** Refetch after native fetch mutations or a long absence from the page. */
export function refreshPage(router: Pick<VoidRouter, "flushAll" | "refresh">) {
  // Void 1.2.1 refresh() reuses prefetched props. Unlike page actions, native
  // fetch mutations do not invalidate them, including other affected pages.
  router.flushAll();
  return router.refresh();
}
