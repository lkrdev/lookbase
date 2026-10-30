---
name: lookbase-guided-tours
description: >
  Design, author, and maintain interactive `driver.js` onboarding and feature guides in LookBase
  using the Looker Artifacts API `dismissedGuideIds` UUID array pattern. Use when adding a new
  guided tour, modifying tour steps, designing "What's New" feature walkthroughs, or wiring
  contextual tour triggers in LookBase.
---

# Designing and authoring LookBase guided tours

LookBase uses `driver.js` (MIT license, zero dependencies, native TypeScript) paired with the Looker Artifacts API (`user_<userId>_lookbase_prefs`) to run interactive spotlight tours inside Looker's extension iframe.

Read this guide before adding or modifying any tour in [src/lookbaseTour.ts](../../../src/lookbaseTour.ts) or [src/LookBaseExtension.tsx](../../../src/LookBaseExtension.tsx).

## The dismissedGuideIds UUID array queue

Every guide in [getLookBaseGuides()](../../../src/lookbaseTour.ts) is a [LookBaseGuide](../../../src/lookbaseTour.ts) object with a permanent UUID:

```ts
export interface LookBaseGuide {
  id: string; // Permanent UUIDv4 - never reuse or change once shipped
  title: string;
  description: string;
  steps: DriveStep[];
}
```

### Why dismissedGuideIds uses an array of UUIDs instead of a single pointer or boolean
In `user_<userId>_lookbase_prefs`, LookBase stores two tour fields:
- `dismissedGuideIds: string[]` holds all guide UUIDs the user has completed or closed.
- `lastDismissedGuideId?: string` records the most recently dismissed guide UUID for debugging.

Storing a deduplicated UUID array (`Array.from(new Set([...current, ...patch]))`) instead of a single `lastDismissedGuideId` pointer provides three guarantees:
1. You can reorder guides, insert a high-priority guide at the front, or retire an old guide without breaking existing users' progress.
2. If a user manually replays Guide 1 from the `? Guided Tour` button after completing Guide 1 and Guide 2, merging `dismissedGuideIds` keeps Guide 2 marked as dismissed.
3. When you ship a new feature and append a `LookBaseGuide` with a new UUID to `getLookBaseGuides()`, existing users who already dismissed earlier guides will see only the new guide on their next load.

## UX and anti-fatigue rules

1. Launch at most one guide per session or page load. On startup, [getNextUnseenGuide(prefs)](../../../src/lookbaseTour.ts) finds the first guide in `getLookBaseGuides()` whose `id` is not in `prefs.dismissedGuideIds`. Only that single guide launches (`tourAutoStartedRef.current = true` prevents React re-renders from launching a second guide in the same session). Never chain two guides back-to-back in a single session.
2. Do not split initial onboarding into many small auto-load guides. While the queue supports $N$ sequential guides across $N$ page loads, hitting a new user with a popup on every refresh trains them to close popups reflexively. Keep 1 or 2 core onboarding guides in the auto-on-load queue (3 to 5 steps each, focused on key actions), and reserve additional guide UUIDs for major feature releases or contextual triggers (such as launching a sandbox guide the first time the user switches the POV to `My Sandbox`).
3. Every `DriveStep.element` selector (such as `#lookbase-tour-pov` or `#lookbase-tour-grid`) must exist and be visible in the default starting UI defined by [lookbase.config.json](../../../lookbase.config.json) (`initial_state`). Do not target elements inside closed modals or collapsed drawers unless the step's `onHighlightStarted` hook opens that UI state first.
4. Keep step titles numbered and specific (for example, `"3. Parent-Child Outline Grid (Zoom In / Out)"`), and keep descriptions to 1 or 2 sentences explaining what to click and what it does (for example, `"Click [+] / [-] or double-click any subtotal row to zoom in"`).

## How to add a new guide

### Generate a permanent UUID
Generate a fresh UUIDv4 so it never collides with existing guides:

```bash
uv run python -c "import uuid; print(uuid.uuid4())"
```

### Add stable #lookbase-tour-* IDs in src/LookBaseExtension.tsx
Ensure every DOM element your guide highlights has a dedicated `id="lookbase-tour-<name>"` attribute in [src/LookBaseExtension.tsx](../../../src/LookBaseExtension.tsx).

### Register the guide in getLookBaseGuides()
Append your new `LookBaseGuide` to [getLookBaseGuides()](../../../src/lookbaseTour.ts):

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

Looker extensions run inside a sandboxed iframe where external `<link>` stylesheets may not load automatically. All `driver.js` popover and overlay styles live inline in [src/essbaseTheme.css](../../../src/essbaseTheme.css) under `.driver-popover` and `.driver-overlay`.

### Verify with Jest and test resetting the guide UUID
1. Run the test suite in [tests/essbaseEngine.test.ts](../../../tests/essbaseEngine.test.ts) and update the expected guide count and `getNextUnseenGuide` progression test:
   ```bash
   npm test -- --watchAll=false
   ```
2. Build the extension bundle:
   ```bash
   npm run build
   ```
3. To test your new guide repeatedly on your Looker user without wiping your other saved preferences, run the [lookbase-reset-tour](../lookbase-reset-tour/SKILL.md) script with `--var guide_id=<YOUR_NEW_UUID>`:
   ```bash
   uv run --env-file=.env --with "lkr-dev-cli[code-mode]" lkr-dev-cli code-mode sandbox \
     --file=.agents/skills/lookbase-reset-tour/scripts/reset_tour_artifact.py \
     --var guide_id=<YOUR_NEW_UUID>
   ```
