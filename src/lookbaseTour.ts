import { driver, DriveStep, Driver } from "driver.js";
import { parseArtifactRecord } from "report-table-extension/artifactUtils";
import {
  canUserUpdateSettings,
  LookBaseCurrentUser,
  LookBaseSettingsConfig,
  normalizeLookBaseSettings,
  QuickStartActionConfig,
  validateLookBaseSettings,
  withSdkTimeout,
} from "./essbaseEngine";

export const TOUR_STORAGE_KEY = "lookbase_guided_tour_seen_v1";
export const DISMISSED_GUIDES_STORAGE_KEY = "lookbase_dismissed_guide_ids_v1";
export const DEFAULT_ARTIFACT_NAMESPACE = "lookbase";
export const GLOBAL_SETTINGS_ARTIFACT_KEY = "global_lookbase_settings";

export interface LookBaseGuide {
  id: string; // UUIDv4 for this guide
  title: string;
  description: string;
  steps: DriveStep[];
}

export interface LookBaseUserPrefs {
  tourDismissed?: boolean;
  dismissedGuideIds?: string[];
  lastDismissedGuideId?: string;
  quickStartDismissed?: boolean;
  dismissedQuickStartIds?: string[];
  customQuickStartActions?: QuickStartActionConfig[];
  savedExpandedMemberIds?: string[];
  savedExpandedPaths?: string[];
  leftHandMetricIds?: string[];
  gridMeasureIds?: string[];
  pov?: {
    version?: string;
    timeframe?: string;
    source?: string;
    year?: string;
  };
}

let prefsSaveQueue: Promise<LookBaseUserPrefs> = Promise.resolve({});

function readLocalDismissedGuideIds(): string[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(DISMISSED_GUIDES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String);
      }
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

/**
 * Loads the logged-in Looker user's preferences (`user_<userId>_lookbase_prefs`)
 * and user identity (`id, email, display_name, role_ids, group_ids`)
 * from Looker's SDK (`core40SDK.me` + `core40SDK.artifact({ namespace, key })`).
 */
export async function loadUserPrefsArtifact(
  core40SDK: any,
  namespace = DEFAULT_ARTIFACT_NAMESPACE,
): Promise<{
  userId: string | null;
  key: string | null;
  user: LookBaseCurrentUser | null;
  prefs: LookBaseUserPrefs;
}> {
  const localDismissed =
    typeof window !== "undefined" && window.localStorage?.getItem(TOUR_STORAGE_KEY) === "true";
  const localGuideIds = readLocalDismissedGuideIds();

  if (!core40SDK || typeof core40SDK.me !== "function" || typeof core40SDK.artifact !== "function") {
    return {
      userId: null,
      key: null,
      user: null,
      prefs: {
        ...(localDismissed ? { tourDismissed: true } : {}),
        ...(localGuideIds.length ? { dismissedGuideIds: localGuideIds } : {}),
      },
    };
  }

  try {
    const rawUser: any = await withSdkTimeout(
      core40SDK.ok(core40SDK.me("id,email,display_name,role_ids,group_ids")),
      2500,
      null,
    );
    const userId = rawUser?.id != null ? String(rawUser.id) : null;
    const user: LookBaseCurrentUser | null = rawUser
      ? {
          id: rawUser.id,
          email: rawUser.email,
          display_name: rawUser.display_name,
          role_ids: Array.isArray(rawUser.role_ids) ? rawUser.role_ids : [],
          group_ids: Array.isArray(rawUser.group_ids) ? rawUser.group_ids : [],
        }
      : null;
    if (!userId) {
      return {
        userId: null,
        key: null,
        user,
        prefs: {
          ...(localDismissed ? { tourDismissed: true } : {}),
          ...(localGuideIds.length ? { dismissedGuideIds: localGuideIds } : {}),
        },
      };
    }

    const key = `user_${userId}_lookbase_prefs`;
    const list: any = await withSdkTimeout(
      core40SDK.ok(core40SDK.artifact({ namespace, key })),
      2500,
      [],
    );
    const parsed = parseArtifactRecord(list?.[0]) as LookBaseUserPrefs;
    const mergedGuideIds = Array.from(
      new Set([...localGuideIds, ...(parsed.dismissedGuideIds || [])]),
    );
    return {
      userId,
      key,
      user,
      prefs: {
        ...(localDismissed ? { tourDismissed: true } : {}),
        ...parsed,
        ...(mergedGuideIds.length ? { dismissedGuideIds: mergedGuideIds } : {}),
      },
    };
  } catch {
    return {
      userId: null,
      key: null,
      user: null,
      prefs: {
        ...(localDismissed ? { tourDismissed: true } : {}),
        ...(localGuideIds.length ? { dismissedGuideIds: localGuideIds } : {}),
      },
    };
  }
}

/**
 * Loads global LookBase Configuration Settings (`restrict_settings`, `settings_group_ids`,
 * `settings_user_ids`, `restrict_rebuild_cube`, `rebuild_cube_group_ids`, `rebuild_cube_user_ids`)
 * from Looker Extension Context Data (`activeHost.refreshContextData` / `getContextData`, matching
 * `lkrdev/explore-blending`) and the shared Looker Artifact (`global_lookbase_settings`), falling
 * back to `lookbase.config.json`.
 */
export async function loadLookBaseSettings(
  activeHost: any,
  core40SDK: any,
  namespace = DEFAULT_ARTIFACT_NAMESPACE,
  fallbackSettings?: LookBaseSettingsConfig,
): Promise<Required<LookBaseSettingsConfig>> {
  let contextSettings: Partial<LookBaseSettingsConfig> = {};
  let artifactSettings: Partial<LookBaseSettingsConfig> = {};

  if (activeHost) {
    try {
      if (typeof activeHost.refreshContextData === "function") {
        await withSdkTimeout(activeHost.refreshContextData(), 1500, undefined);
      }
      if (typeof activeHost.getContextData === "function") {
        const ctx = await withSdkTimeout(activeHost.getContextData(), 1500, undefined);
        if (ctx && typeof ctx === "object") {
          contextSettings = ctx as Partial<LookBaseSettingsConfig>;
        }
      }
    } catch {
      // ignore context data errors
    }
  }

  if (core40SDK && typeof core40SDK.artifact === "function") {
    try {
      const list: any = await withSdkTimeout(
        core40SDK.ok(
          core40SDK.artifact({ namespace, key: GLOBAL_SETTINGS_ARTIFACT_KEY }),
        ),
        2500,
        [],
      );
      if (list?.[0]) {
        artifactSettings = parseArtifactRecord(
          list[0],
        ) as Partial<LookBaseSettingsConfig>;
      }
    } catch {
      // ignore artifact read errors
    }
  }

  return normalizeLookBaseSettings({
    ...(fallbackSettings || {}),
    ...contextSettings,
    ...artifactSettings,
  });
}

/**
 * Saves global LookBase Configuration Settings after verifying `canUserUpdateSettings`
 * and `validateLookBaseSettings` (preventing self-lockout). Persists to both Looker Extension
 * Context Data (`activeHost.saveContextData`, matching `lkrdev/explore-blending`) and the shared
 * Looker Artifact (`global_lookbase_settings`).
 */
export async function saveLookBaseSettings(
  activeHost: any,
  core40SDK: any,
  newSettings: LookBaseSettingsConfig,
  currentUser?: LookBaseCurrentUser | null,
  currentSettings?: LookBaseSettingsConfig | null,
  namespace = DEFAULT_ARTIFACT_NAMESPACE,
): Promise<Required<LookBaseSettingsConfig>> {
  if (currentSettings && !canUserUpdateSettings(currentUser, currentSettings)) {
    throw new Error("User does not have permission to update settings");
  }
  const validation = validateLookBaseSettings(newSettings, currentUser);
  if (validation.settings_access_error) {
    throw new Error(validation.settings_access_error);
  }

  const normalized = normalizeLookBaseSettings(newSettings);

  if (activeHost && typeof activeHost.saveContextData === "function") {
    try {
      await activeHost.saveContextData(normalized);
      if (typeof activeHost.refreshContextData === "function") {
        await activeHost.refreshContextData();
      }
    } catch {
      // Fall through to Artifact persistence if contextData requires admin role
    }
  }

  if (
    core40SDK &&
    typeof core40SDK.artifact === "function" &&
    typeof core40SDK.update_artifacts === "function"
  ) {
    const existingList = await core40SDK
      .ok(core40SDK.artifact({ namespace, key: GLOBAL_SETTINGS_ARTIFACT_KEY }))
      .catch(() => []);
    const existing = existingList?.[0];
    await core40SDK.ok(
      core40SDK.update_artifacts(namespace, [
        {
          key: GLOBAL_SETTINGS_ARTIFACT_KEY,
          value: JSON.stringify(normalized),
          content_type: "application/json",
          ...(existing?.version != null ? { version: existing.version } : {}),
        },
      ]),
    );
  }

  return normalized;
}

/**
 * Persists a patch to the logged-in Looker user's preferences (`user_<userId>_lookbase_prefs`)
 * in Looker's Artifacts API (`core40SDK.update_artifacts`), serialized through a promise queue
 * so concurrent updates never conflict on artifact `version`.
 * Automatically unions `dismissedGuideIds` unless explicitly reset.
 */
export function saveUserPrefsArtifact(
  core40SDK: any,
  patch: Partial<LookBaseUserPrefs> & {
    resetDismissedGuides?: boolean;
    resetDismissedQuickStarts?: boolean;
  },
  namespace = DEFAULT_ARTIFACT_NAMESPACE,
): Promise<LookBaseUserPrefs> {
  const { resetDismissedGuides, resetDismissedQuickStarts, ...cleanPatch } = patch;

  if (resetDismissedGuides) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(TOUR_STORAGE_KEY);
        window.localStorage.removeItem(DISMISSED_GUIDES_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  } else {
    if (cleanPatch.tourDismissed) {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(TOUR_STORAGE_KEY, "true");
        }
      } catch {
        // ignore storage errors
      }
    }
    if (cleanPatch.dismissedGuideIds?.length || cleanPatch.lastDismissedGuideId) {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          const nextLocal = Array.from(
            new Set([
              ...readLocalDismissedGuideIds(),
              ...(cleanPatch.dismissedGuideIds || []),
              ...(cleanPatch.lastDismissedGuideId ? [cleanPatch.lastDismissedGuideId] : []),
            ]),
          );
          window.localStorage.setItem(DISMISSED_GUIDES_STORAGE_KEY, JSON.stringify(nextLocal));
        }
      } catch {
        // ignore storage errors
      }
    }
  }

  if (
    !core40SDK ||
    typeof core40SDK.me !== "function" ||
    typeof core40SDK.artifact !== "function" ||
    typeof core40SDK.update_artifacts !== "function"
  ) {
    return Promise.resolve({ ...cleanPatch });
  }

  const nextTask = prefsSaveQueue
    .catch(() => ({}))
    .then(async () => {
      try {
        const user = await core40SDK.ok(core40SDK.me("id"));
        const userId = user?.id != null ? String(user.id) : null;
        if (!userId) return { ...cleanPatch };

        const key = `user_${userId}_lookbase_prefs`;
        const existingList = await core40SDK.ok(core40SDK.artifact({ namespace, key }));
        const existing = existingList?.[0];
        const currentPrefs = parseArtifactRecord(existing) as LookBaseUserPrefs;

        const combinedGuideIds = resetDismissedGuides
          ? []
          : Array.from(
              new Set([
                ...(currentPrefs.dismissedGuideIds || []),
                ...(cleanPatch.dismissedGuideIds || []),
                ...(cleanPatch.lastDismissedGuideId ? [cleanPatch.lastDismissedGuideId] : []),
              ]),
            );

        const combinedQuickStartIds = resetDismissedQuickStarts
          ? []
          : cleanPatch.dismissedQuickStartIds !== undefined
            ? Array.from(
                new Set([
                  ...(currentPrefs.dismissedQuickStartIds || []),
                  ...cleanPatch.dismissedQuickStartIds,
                ]),
              )
            : currentPrefs.dismissedQuickStartIds;

        const merged: LookBaseUserPrefs = {
          ...currentPrefs,
          ...cleanPatch,
          dismissedGuideIds: combinedGuideIds,
          ...(combinedQuickStartIds !== undefined
            ? { dismissedQuickStartIds: combinedQuickStartIds }
            : {}),
        };

        await core40SDK.ok(
          core40SDK.update_artifacts(namespace, [
            {
              key,
              value: JSON.stringify(merged),
              content_type: "application/json",
              ...(existing?.version != null ? { version: existing.version } : {}),
            },
          ]),
        );
        return merged;
      } catch {
        return { ...cleanPatch };
      }
    });

  prefsSaveQueue = nextTask;
  return nextTask;
}

/**
 * Ordered registry of LookBase guides, each identified by a permanent UUID.
 * On each page load/refresh, `getNextUnseenGuide` selects only the first guide
 * whose UUID is not yet in `prefs.dismissedGuideIds`.
 */
export function getLookBaseGuides(): LookBaseGuide[] {
  return [
    {
      id: "6f8a1c30-4e2b-4d9a-9c11-100000000001",
      title: "Guide 1: LookBase Core & Outline Hierarchy",
      description: "Point of View (POV) slicing, parent-child outline zoom, and saved batch expansions.",
      steps: [
        {
          element: "#lookbase-tour-brand",
          popover: {
            title: "1. Welcome to LookBase",
            description:
              "LookBase wraps Looker's Report Table submodule with an ad-hoc multidimensional grid, parent-child outline zoom, two-pass calculations, and BigQuery CLONE writeback sandboxes.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#lookbase-tour-pov",
          popover: {
            title: "2. Point of View (POV) Slice Bar",
            description:
              "Use these dropdowns to slice the entire Long Metrics cube by Scenario Version (Actual/Base, Personal Sandbox, Forecast v1), Stacked Timeframe (YTD, Rolling 7D/28D/90D/12M), Grain (Daily/Monthly/Quarterly), and Year.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: "#lookbase-tour-grid",
          popover: {
            title: "3. Parent-Child Outline Grid (Zoom In / Out)",
            description:
              "Click the [+] / [-] icons or double-click any subtotal row (like 'All Products', 'Men', or 'Jeans') to zoom in. LookBase fires an incremental WHERE parent_id = '<member_id>' query and splices child rows directly into the hierarchy.",
            side: "left",
            align: "start",
          },
        },
        {
          element: "#lookbase-tour-hierarchy-btn",
          popover: {
            title: "4. Jagged Hierarchy Filter & Saved Batch Expansions",
            description:
              "Our hierarchy uses a BigQuery WITH RECURSIVE CTE (L0–L20). Instead of querying the full hierarchy at once (which hits Looker row limits), LookBase saves your expanded branches and runs them together in a consolidated IN batch query on load.",
            side: "bottom",
            align: "start",
          },
        },
      ],
    },
    {
      id: "6f8a1c30-4e2b-4d9a-9c11-100000000002",
      title: "Guide 2: Left-Hand Metrics, Formula Bar & Sandboxes",
      description: "Autocomplete measures & two-pass formulas, proportional cell writeback, and BigQuery CLONE sandboxes.",
      steps: [
        {
          element: "#lookbase-tour-autocomplete",
          popover: {
            title: "5. Left-Hand Metric & Calculation Autocomplete",
            description:
              "Type here to search and add LookML measures ('Total Sale Price', 'Total Gross Margin'), Two-Pass Calculations ('Gross Margin %', '% of Parent Sales', 'Implied COGS'), or type a custom formula starting with '=' (e.g. =MEMBER('Total Sale Price') * 1.1) and press Enter!",
            side: "right",
            align: "start",
          },
        },
        {
          element: "#lookbase-tour-left-table",
          popover: {
            title: "6. Metrics Down the Left-Hand Side (Column A)",
            description:
              "All active measures and two-pass calculations (auto-discovered from the Explore or configured in lookbase.config.json) are evaluated live for the selected Outline Member across Current, Last Year, and YoY Var %. Click '⇄' on any row to swap it in place.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "#lookbase-tour-formula-bar",
          popover: {
            title: "7. Formula Bar & Proportional Cell Writeback",
            description:
              "Click any cell in the grid to inspect its =GETVALUE(...) coordinate or [Member] parent-child path. When switched to 'My Sandbox', type a target number or percentage adjustment (like +10%) and click 'Submit Data' to write back proportional deltas.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#lookbase-tour-actions",
          popover: {
            title: "8. Cube Rebuilds (Calc All) & BigQuery CLONE Sandboxes",
            description:
              "Click 'Calc All' or 'Calc Sales PDT' to force an on-demand PDT rebuild (rebuild_pdts=true). Click 'New Sandbox (CLONE)' to create a zero-copy BigQuery CLONE of the base cube, then 'Promote Sandbox → Fcst v1' to publish your changes.",
            side: "bottom",
            align: "start",
          },
        },
      ],
    },
  ];
}

/**
 * Returns the first guide in `guides` whose UUID is NOT in `prefs.dismissedGuideIds`,
 * or `null` if all guides have already been dismissed.
 * Ensures at most ONE unseen guide opens per page load / refresh.
 */
export function getNextUnseenGuide(
  prefs: LookBaseUserPrefs,
  guides: LookBaseGuide[] = getLookBaseGuides(),
): LookBaseGuide | null {
  const dismissed = new Set(prefs.dismissedGuideIds || []);
  return guides.find((g) => !dismissed.has(g.id)) || null;
}

export function getLookBaseTourSteps(): DriveStep[] {
  return getLookBaseGuides().flatMap((g) => g.steps);
}

export function startLookBaseTour(options?: {
  core40SDK?: any;
  namespace?: string;
  guide?: LookBaseGuide;
  onComplete?: (dismissedGuideId?: string) => void;
  onDismiss?: (dismissedGuideId?: string) => void;
  onClose?: () => void;
}): Driver {
  const activeGuide = options?.guide;
  const steps = activeGuide ? activeGuide.steps : getLookBaseTourSteps();
  const allGuides = getLookBaseGuides();
  let explicitlyDismissed = false;

  const drv = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    nextBtnText: "Next →",
    prevBtnText: "← Back",
    doneBtnText: "Got It (Don't Show Again)",
    steps,
    onDoneClick: (_el, _step, { driver: d }) => {
      explicitlyDismissed = true;
      d.destroy();
    },
    onCloseClick: (_el, _step, { driver: d }) => {
      explicitlyDismissed = false;
      d.destroy();
    },
    onPopoverRender: (popover, { driver: d }) => {
      if (popover.closeButton) {
        popover.closeButton.title = "Close for now (will show again next refresh)";
      }
      if (popover.footerButtons && !d.isLastStep()) {
        const dismissBtn = document.createElement("button");
        dismissBtn.type = "button";
        dismissBtn.id = "lookbase-tour-dismiss-btn";
        dismissBtn.className = "driver-popover-dismiss-btn";
        dismissBtn.textContent = "Don't Show Again";
        dismissBtn.title = "Permanently dismiss this guide so it never auto-opens again";
        dismissBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          explicitlyDismissed = true;
          d.destroy();
        });
        popover.footerButtons.insertBefore(dismissBtn, popover.previousButton);
      }
    },
    onDestroyed: () => {
      if (!explicitlyDismissed) {
        options?.onClose?.();
        return;
      }

      const dismissedIdsToRecord = activeGuide
        ? [activeGuide.id]
        : allGuides.map((g) => g.id);
      const lastId = activeGuide
        ? activeGuide.id
        : allGuides[allGuides.length - 1]?.id;

      saveUserPrefsArtifact(
        options?.core40SDK,
        {
          tourDismissed: !activeGuide || activeGuide.id === allGuides[allGuides.length - 1]?.id,
          dismissedGuideIds: dismissedIdsToRecord,
          ...(lastId ? { lastDismissedGuideId: lastId } : {}),
        },
        options?.namespace || DEFAULT_ARTIFACT_NAMESPACE,
      );
      options?.onDismiss?.(lastId);
      options?.onComplete?.(lastId);
    },
  });
  drv.drive();
  return drv;
}
