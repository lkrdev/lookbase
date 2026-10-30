---
name: lookbase-toasts
description: Design and implementation standard for stacked bottom-right stateful toast notifications in LookBase and Looker Extensions. Use when adding status feedback, async progress indicators, cube rebuild notifications, or writeback alerts so each caller owns an isolated toast lifecycle (info waiting state with no timeout -> in-place transition to green success or red error with auto-dismiss).
---

# LookBase stacked stateful toasts

## Core principles

1. Render all toasts inside a fixed bottom-right stack container (`#lookbase-toast-stack`, `position: fixed; bottom: 16px; right: 16px; z-index: 9999; display: flex; flex-direction: column; gap: 8px;`). Never shift toolbar or ribbon buttons by injecting inline status spans.
2. Give each caller an isolated toast with in-place state transitions. Every async operation (`loadStandaloneOutline`, branch zoom, PDT cube rebuild, BigQuery `CLONE` sandbox init, proportional delta writeback, forecast promotion) creates its own toast via `const toastId = pushToast(...)`. Concurrent operations stack vertically without overwriting each other's messages or timers.
3. Apply deterministic timeout rules by `variant`:
   - `info` (waiting or in-progress) renders a blue accent with an animated spinner and defaults to `timeoutMs: null` (no timeout) so long-running BigQuery PDT rebuilds or batch queries stay visible for the entire operation.
   - `success` (completed) renders a green accent (`#166534` / `#dcfce7`), updates in-place via `updateToast(toastId, { message, variant: "success", timeoutMs: 4000 })` when the async operation resolves, and auto-dismisses after `4000ms`.
   - `error` (failed or warning) renders a red accent (`#991b1b` / `#fee2e2`), updates in-place via `updateToast(toastId, { message, variant: "error", timeoutMs: 6000 })` when an operation throws, and auto-dismisses after `6000ms`.
   - Every toast includes an explicit `×` button to dismiss it immediately and clear its timer.

## Standard data model and hook pattern

```tsx
export type ToastVariant = "info" | "success" | "error";

export interface LookBaseToast {
  id: string;
  message: string;
  variant: ToastVariant;
  timeoutMs?: number | null;
}
```

### Usage pattern in async callers

```tsx
const toastId = pushToast({
  message: `Rebuilding PDT '${targetView}' (rebuild_pdts=true)...`,
  variant: "info",
  timeoutMs: null, // No timeout while waiting for BigQuery PDT build
});

try {
  await rebuildCubePdt(core40SDK, {
    model: calcConfig.model || "lookbase",
    view: targetView,
  });
  updateToast(toastId, {
    message: `Cube '${targetView}' rebuilt.`,
    variant: "success",
    timeoutMs: 4000, // Turns green and auto-dismisses after 4s
  });
} catch (err: any) {
  updateToast(toastId, {
    message: `Rebuild error: ${err?.message || "Failed"}`,
    variant: "error",
    timeoutMs: 6000, // Turns red and auto-dismisses after 6s
  });
}
```
