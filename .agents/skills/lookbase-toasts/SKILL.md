---
name: lookbase-toasts
description: Design and implementation standard for stacked bottom-right stateful toast notifications in LookBase and Looker Extensions. Use when adding status feedback, async progress indicators, cube rebuild notifications, or writeback alerts so each caller owns an isolated toast lifecycle (info waiting state with no timeout -> in-place transition to green success or red error with auto-dismiss).
---

# LookBase Stacked Stateful Toasts (`lookbase-toasts`)

## Core Principles

1. **Bottom-Right Fixed Stack (Never Inline Ribbon Text)**:
   - Never shift toolbar/ribbon buttons by injecting inline status spans.
   - Render all toasts inside a fixed bottom-right stack container (`#lookbase-toast-stack`, `position: fixed; bottom: 16px; right: 16px; z-index: 9999; display: flex; flex-direction: column; gap: 8px;`).
2. **Per-Caller Isolation & In-Place State Transitions**:
   - Every async operation (`loadStandaloneOutline`, branch zoom, PDT cube rebuild, BigQuery `CLONE` sandbox init, proportional delta writeback, forecast promotion) creates its own toast via `const toastId = pushToast(...)`.
   - Concurrent operations stack vertically without clobbering each other's messages or timers.
3. **Deterministic Timeout Rules by State (`variant`)**:
   - **`info` (Waiting / In-Progress)**: Blue accent + animated spinner. **Default `timeoutMs: null` (no timeout)** so long-running BigQuery PDT rebuilds or consolidated batch queries remain visible for the entire duration of the operation.
   - **`success` (Completed)**: Green accent (`#166534` / `#dcfce7`). Updated **in-place** via `updateToast(toastId, { message, variant: "success", timeoutMs: 4000 })` when the async operation resolves. Automatically dismisses after `4000ms`.
   - **`error` (Failed / Warning)**: Red accent (`#991b1b` / `#fee2e2`). Updated **in-place** via `updateToast(toastId, { message, variant: "error", timeoutMs: 6000 })` when an operation throws. Automatically dismisses after `6000ms`.
   - **Manual Close (`×`)**: Every toast includes an explicit `×` button to dismiss immediately and clear its timer.

---

## Standard Data Model & Hook Pattern

```tsx
export type ToastVariant = "info" | "success" | "error";

export interface LookBaseToast {
  id: string;
  message: string;
  variant: ToastVariant;
  timeoutMs?: number | null;
}
```

### Usage Pattern in Async Callers

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
