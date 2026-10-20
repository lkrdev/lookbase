---
name: lookbase-guided-tours
description: >
  Design, author, and maintain interactive `driver.js` onboarding and feature guides in LookBase
  using the Looker Artifacts API `dismissedGuideIds` UUID array pattern. Use when adding a new
  guided tour, modifying tour steps, designing "What's New" feature walkthroughs, or wiring
  contextual tour triggers in LookBase.
---

# Skill: Designing & Authoring LookBase Guided Tours (`lookbase-guided-tours`)

LookBase uses **`driver.js`** (MIT license, zero dependencies, native TypeScript) paired with the **Looker Artifacts API** (`user_<userId>_lookbase_prefs`) to deliver interactive spotlight tours inside Looker's extension iframe.

Read this skill before adding or modifying any tour in [`src/lookbaseTour.ts`](../../../src/lookbaseTour.ts) or [`src/LookBaseExtension.tsx`](../../../src/LookBaseExtension.tsx).

---

## 1. Architecture: The `dismissedGuideIds` UUID Array Queue

Every guide in [`getLookBaseGuides()`](../../../src/lookbaseTour.ts) is a [`LookBaseGuide`](../../../src/lookbaseTour.ts) object with a **permanent UUID**:

```ts
export interface LookBaseGuide {
  id: string; // Permanent UUIDv4 — never reuse or change once shipped
  title: string;
  description: string;
  steps: DriveStep[];
}
```

### Why `dismissedGuideIds: string[]` (Array of UUIDs) Instead of a Single Pointer or Boolean?
In `user_<userId>_lookbase_prefs`, we store:
- `dismissedGuideIds: string[]` — the set of all guide UUIDs the user has completed or closed.
- `lastDismissedGuideId?: string` — the most recently dismissed guide UUID (for audit/debugging).

Using a **deduplicated UUID array** (`Array.from(new Set([...current, ...patch]))`) instead of a single `lastDismissedGuideId` pointer guarantees:
1. **Order-Independence:** You can reorder guides, insert a high-priority guide at the front, or retire an old guide without breaking existing users' progress.
2. **Replay Safety:** If a user manually replays *Guide 1* from the `? Guided Tour` button after having already completed *Guide 1* and *Guide 2*, unioning `dismissedGuideIds` preserves *Guide 2* as dismissed.
3. **Zero-Config "What's New" Rollouts:** When you ship a new feature and append a new `LookBaseGuide` with a fresh UUID to `getLookBaseGuides()`, existing users who already dismissed earlier guides will automatically see **only the new guide** on their next load.

---

## 2. UX & Anti-Fatigue Design Rules

1. **One Guide Per Session / Refresh Maximum:**
   - On startup, [`getNextUnseenGuide(prefs)`](../../../src/lookbaseTour.ts) finds the **first** guide in `getLookBaseGuides()` whose `id` is not in `prefs.dismissedGuideIds`.
   - Only **that single guide** launches (`tourAutoStartedRef.current = true` prevents React re-renders from launching a second guide in the same session).
   - Never chain two guides back-to-back in a single session.

2. **Avoid "10 Refreshes = 10 Popups" Tour Fatigue:**
   - While the queue supports $N$ sequential guides across $N$ page loads, **do not split initial onboarding into 10 tiny auto-load guides**. If a new user refreshes 5 times during their first hour and gets hit with a popup every single time, they develop *banner blindness* and reflexively click `✕`.
   - **Best Practice:**
     - Keep **1–2 core onboarding guides** in the auto-on-load queue (3–5 steps each, focused on high-signal actions).
     - Reserve additional guide UUIDs for **major new feature releases ("What's New")** or **contextual triggers** (e.g., launching a sandbox guide the first time the user switches the POV to `My Sandbox`).

3. **Every Step Must Target a Visible `#lookbase-tour-*` Element:**
   - Every `DriveStep.element` selector (e.g., `#lookbase-tour-pov`, `#lookbase-tour-grid`) **must** exist and be visible in the default starting UI defined by [`lookbase.config.json`](../../../lookbase.config.json) (`initial_state`).
   - Do not target elements inside closed modals or collapsed drawers unless the step's `onHighlightStarted` hook opens that UI state first.

4. **Keep Step Copy Action-Oriented and Concise:**
   - **Title:** Numbered and specific (e.g., `"3. Parent-Child Outline Grid (Zoom In / Out)"`).
   - **Description:** 1–2 sentences explaining **what to click** and **why it matters** (e.g., *"Click `[+]` / `[-]` or double-click any subtotal row to zoom in"*).

---

## 3. Step-by-Step: How to Add a New Guide

### Step 1: Generate a Permanent UUID
Generate a fresh UUIDv4 so it never collides with existing guides:

```bash
uv run python -c "import uuid; print(uuid.uuid4())"
```

### Step 2: Add Stable `#lookbase-tour-*` IDs in `src/LookBaseExtension.tsx`
Ensure every DOM element your guide highlights has a dedicated `id="lookbase-tour-<name>"` attribute in [`src/LookBaseExtension.tsx`](../../../src/LookBaseExtension.tsx).

### Step 3: Register the Guide in `getLookBaseGuides()` (`src/lookbaseTour.ts`)
Append your new `LookBaseGuide` to [`getLookBaseGuides()`](../../../src/lookbaseTour.ts):

```ts
{
  id: "<YOUR_NEW_UUID>",
  title: "Guide 3: <Short Feature Title>",
  description: "<1-line summary of what this guide covers>",
  steps: [
    {
      element: "#lookbase-tour-my-feature",
      popover: {
        title: "1. <Step Title>",
        description: "<Actionable 1-2 sentence explanation>",
        side: "bottom",
        align: "start",
      },
    },
  ],
}
```

> **Note:** Looker extensions run inside a sandboxed iframe where external `<link>` stylesheets may not load automatically. All `driver.js` popover and overlay styles live inline in [`src/essbaseTheme.css`](../../../src/essbaseTheme.css) under `.driver-popover` and `.driver-overlay`.

### Step 4: Verify with Jest & Test Resetting the Guide UUID
1. Run the test suite in [`tests/essbaseEngine.test.ts`](../../../tests/essbaseEngine.test.ts) and update the expected guide count / `getNextUnseenGuide` progression test:
   ```bash
   npm test -- --watchAll=false
   ```
2. Build the extension bundle:
   ```bash
   npm run build
   ```
3. To test your new guide repeatedly on your Looker user without wiping your other saved preferences, use the [`lookbase-reset-tour`](../lookbase-reset-tour/SKILL.md) skill with `--var guide_id=<YOUR_NEW_UUID>`:
   ```bash
   uv run --env-file=.env --with "lkr-dev-cli[code-mode]" lkr-dev-cli code-mode sandbox \
     --file=.agents/skills/lookbase-reset-tour/scripts/reset_tour_artifact.py \
     --var guide_id=<YOUR_NEW_UUID>
   ```
