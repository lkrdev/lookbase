import {
  connectExtensionHost,
  ExtensionSDK,
  LookerExtensionSDK,
  RawVisualizationData,
} from "@looker/extension-sdk";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QueryResponse, ReportTable, VisConfig } from "report-table-react";
import { useUserArtifacts } from "report-table-extension/useUserArtifacts";
import { applyFiltersToHost } from "report-table-extension/artifactUtils";
import {
  AutocompleteItem,
  BIEngineCandidateTable,
  buildAlterBiCapacitySql,
  buildAutocompleteCatalog,
  buildLookerFilterExpression,
  CalculationsConfig,
  canUserRebuildCube,
  canUserUpdateSettings,
  DEFAULT_AUTOCOMPLETE_MEMBER_LEVELS,
  DEFAULT_CALCULATIONS_CONFIG,
  DEFAULT_LOOKBASE_SETTINGS,
  DEFAULT_MODAL_UNFOLDED_IDS,
  DEFAULT_QUICK_START_ACTIONS,
  deriveExpandedPathsFromMemberIds,
  discoverBIEngineCandidateTables,
  discoverFieldsFromExplore,
  escapeLookerFilterValue,
  evaluateLookBaseFormula,
  evaluateLeftHandMetricRow,
  fetchChildHierarchySlice,
  fetchFullHierarchyCatalog,
  fetchHierarchyModalChildren,
  formatLookBaseValue,
  getHierarchyNodeTriState,
  getHierarchyRowStickyStyle,
  getOutlineIndentationPx,
  getVirtualizedAutocompleteWindow,
  getVisibleHierarchyModalNodes,
  isLookerAdminUser,
  loadProjectCalculations,
  LOOKBASE_SHARED_PDT_CATALOG,
  LookBaseCurrentUser,
  LookBaseSettingsConfig,
  LookBaseUrlState,
  mergeOutlineRows,
  normalizeLookBaseSettings,
  normalizeQueryResponseFields,
  normalizeSourceAndTimeframe,
  OutlineNodeMeta,
  parseLookBaseUrlState,
  parseSdkJson,
  projectOutlineRowsToReportTable,
  QuickStartActionConfig,
  rebuildCubePdt,
  resolveInitialLeftHandMetrics,
  restoreSavedOutlineExpansion,
  searchAutocompleteItems,
  serializeLookBaseUrlState,
  sortOutlineNodesTreeOrder,
  STARTER_HIERARCHY_CATALOG_NODES,
  STARTER_OUTLINE_QUERY_RESPONSE,
  toggleHierarchyNodeTriState,
  validateLookBaseSettings,
} from "./essbaseEngine";
import {
  DEFAULT_ARTIFACT_NAMESPACE,
  getLookBaseGuides,
  getNextUnseenGuide,
  loadLookBaseSettings,
  loadUserPrefsArtifact,
  saveLookBaseSettings,
  saveUserPrefsArtifact,
  startLookBaseTour,
} from "./lookbaseTour";
import driverStyles from "driver.js/dist/driver.css";
import styles from "./essbaseTheme.css";

const SAVED_EXPANSION_STORAGE_KEY = "lookbase_saved_expanded_member_ids";
const SAVED_PATHS_STORAGE_KEY = "lookbase_saved_expanded_paths";

export type ToastVariant = "info" | "success" | "error";

export interface LookBaseToast {
  id: string;
  message: string;
  variant: ToastVariant;
  timeoutMs?: number | null;
}

const LOOKBASE_DEFAULT_VIS_CONFIG: VisConfig = {
  theme: "custom",
  customTheme: "",
  rowSubtotals: true,
  subtotalStyle: "collapsed",
  subtotalsOnTop: true,
  startFolded: true,
  indexColumn: true,
  spanCols: true,
  spanRows: true,
  arrowStyle: "plus_minus",
  freezeTableHeaders: true,
  freezeColumns: 1,
  minWidthForIndexColumns: true,
  allowUserEdits: true,
  allowUserFilters: true,
};

const defaultInit = DEFAULT_CALCULATIONS_CONFIG.initial_state || {};

export const LookBaseExtension: React.FC<{ host?: ExtensionSDK }> = ({ host }) => {
  const [extensionSDK, setExtensionSDK] = useState<ExtensionSDK | undefined>(host);
  const [visData, setVisData] = useState<RawVisualizationData | undefined>(undefined);
  const [tileHostData, setTileHostData] = useState<Record<string, any> | undefined>(undefined);
  const [calcConfig, setCalcConfig] = useState<CalculationsConfig>(DEFAULT_CALCULATIONS_CONFIG);
  const [hostRoute, setHostRoute] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.search : "",
  );

  const initialUrlState = useMemo(
    () =>
      parseLookBaseUrlState(
        typeof window !== "undefined" ? window.location.search : "",
      ),
    [],
  );

  // Initialize immediately with STARTER_OUTLINE_QUERY_RESPONSE so the grid is interactive on first render
  const [outlineRows, setOutlineRows] = useState<Record<string, any>[]>(
    STARTER_OUTLINE_QUERY_RESPONSE.data,
  );
  const [standaloneQueryResponse, setStandaloneQueryResponse] = useState<QueryResponse | undefined>(
    STARTER_OUTLINE_QUERY_RESPONSE as QueryResponse,
  );
  const [savedExpandedMemberIds, setSavedExpandedMemberIds] = useState<string[]>(
    initialUrlState.expanded?.length
      ? initialUrlState.expanded
      : defaultInit.expanded_member_ids || ["ROOT", "ALL", "DEPT:Men", "DEPT:Women"],
  );
  const [expandedPaths, setExpandedPaths] = useState<string[]>(
    defaultInit.expanded_paths || ["All Products", "All Products|Men"],
  );
  const fetchedMemberIdsRef = useRef<Set<string>>(
    new Set(["ROOT", "ALL", "DEPT:Men", "DEPT:Women", "CAT:Men|Jeans", "CAT:Men|Outerwear & Coats", "CAT:Women|Dresses", "CAT:Women|Active"]),
  );

  // POV slice state initialized from URL query params -> lookbase.config.json initial_state
  const [povVersion, setPovVersion] = useState<string>(
    initialUrlState.version || defaultInit.version || "base",
  );
  const [povTimeframe, setPovTimeframe] = useState<string>(
    initialUrlState.timeframe || defaultInit.timeframe || "ytd",
  );
  const [povSource, setPovSource] = useState<string>(
    initialUrlState.source || defaultInit.source || "Daily Actual",
  );
  const [povYear, setPovYear] = useState<string>(
    initialUrlState.year || defaultInit.year || "ALL",
  );
  const [availableYears, setAvailableYears] = useState<string[]>([
    "2026",
    "2025",
    "2024",
    "2023",
    "2022",
    "2021",
    "2020",
    "2019",
  ]);

  // Quick-Start Guide & Tour state (persisted in Looker Artifacts API per logged-in user, overridable via URL)
  const [showQuickStartBar, setShowQuickStartBar] = useState<boolean>(
    initialUrlState.quickstart !== "0",
  );
  const [dismissedQuickStartIds, setDismissedQuickStartIds] = useState<string[]>([]);
  const [customQuickStartActions, setCustomQuickStartActions] = useState<QuickStartActionConfig[]>(
    [],
  );
  const [isAddingCustomQuickStart, setIsAddingCustomQuickStart] = useState<boolean>(false);
  const [newQuickStartLabel, setNewQuickStartLabel] = useState<string>("");
  const tourAutoStartedRef = useRef<boolean>(false);

  // Left-Hand Side Metrics & Calculation Autocomplete state
  const [showLeftMetricsPane, setShowLeftMetricsPane] = useState<boolean>(
    initialUrlState.pane !== undefined
      ? initialUrlState.pane
      : defaultInit.show_left_metrics_pane !== false,
  );
  const [leftMetricQuery, setLeftMetricQuery] = useState<string>(initialUrlState.q || "");
  const [debouncedMetricQuery, setDebouncedMetricQuery] = useState<string>(
    initialUrlState.q || "",
  );
  const [autocompleteMemberLevels, setAutocompleteMemberLevels] = useState<number[]>(
    DEFAULT_AUTOCOMPLETE_MEMBER_LEVELS,
  );
  const [autocompleteScrollTop, setAutocompleteScrollTop] = useState<number>(0);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState<boolean>(
    Boolean(initialUrlState.q),
  );
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [replacingRowId, setReplacingRowId] = useState<string | null>(null);
  const [selectedOutlineMemberId, setSelectedOutlineMemberId] = useState<string>(
    initialUrlState.member || defaultInit.selected_outline_member_id || "ALL",
  );
  const [activeMetricRowId, setActiveMetricRowId] = useState<string>(
    defaultInit.left_hand_metrics?.[0] || "long_metrics.total_sale_price",
  );
  const [leftMetricRows, setLeftMetricRows] = useState<AutocompleteItem[]>(() =>
    resolveInitialLeftHandMetrics(
      DEFAULT_CALCULATIONS_CONFIG,
      buildAutocompleteCatalog(DEFAULT_CALCULATIONS_CONFIG),
      initialUrlState.metrics,
    ),
  );

  // Jagged Hierarchy Subtree Modal state (defaults to folded L1: only "ALL" unfolded so L1 Men & Women are visible)
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState<boolean>(
    initialUrlState.modal === "hierarchy",
  );
  const [hierarchyFilterSearch, setHierarchyFilterSearch] = useState<string>("");
  const [hierarchyCatalogNodes, setHierarchyCatalogNodes] = useState<OutlineNodeMeta[]>(
    STARTER_HIERARCHY_CATALOG_NODES,
  );
  const [modalUnfoldedIds, setModalUnfoldedIds] = useState<string[]>(
    DEFAULT_MODAL_UNFOLDED_IDS,
  );
  const [modalLoadingParentIds, setModalLoadingParentIds] = useState<string[]>([]);
  const modalFetchedParentsRef = useRef<Set<string>>(new Set(["ROOT", "ALL"]));

  // Configuration Settings & User Access Control state (lkrdev/explore-blending pattern)
  const [currentUser, setCurrentUser] = useState<LookBaseCurrentUser | null>(null);
  const [appSettings, setAppSettings] = useState<Required<LookBaseSettingsConfig>>(() =>
    normalizeLookBaseSettings(DEFAULT_CALCULATIONS_CONFIG.settings || DEFAULT_LOOKBASE_SETTINGS),
  );
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(
    initialUrlState.modal === "settings",
  );
  const [settingsDraft, setSettingsDraft] = useState<Required<LookBaseSettingsConfig>>(() =>
    normalizeLookBaseSettings(DEFAULT_CALCULATIONS_CONFIG.settings || DEFAULT_LOOKBASE_SETTINGS),
  );
  const [settingsGroupIdsInput, setSettingsGroupIdsInput] = useState<string>("");
  const [settingsUserIdsInput, setSettingsUserIdsInput] = useState<string>("");
  const [rebuildCubeGroupIdsInput, setRebuildCubeGroupIdsInput] = useState<string>("");
  const [rebuildCubeUserIdsInput, setRebuildCubeUserIdsInput] = useState<string>("");
  const [settingsFormError, setSettingsFormError] = useState<string>("");
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [biEngineProjectId, setBiEngineProjectId] = useState<string>("looker-private-demo");
  const [biEngineTables, setBiEngineTables] = useState<BIEngineCandidateTable[]>(() =>
    LOOKBASE_SHARED_PDT_CATALOG.map((c) => ({
      viewName: c.viewName,
      label: c.label,
      category: c.category,
      fullTableName: `looker-private-demo.lookerdemo_scratch.${c.viewName}`,
      datasetTable: `lookerdemo_scratch.${c.viewName}`,
    })),
  );
  const [isDiscoveringBiTables, setIsDiscoveringBiTables] = useState<boolean>(false);

  const canUpdateSettings = useMemo(
    () => canUserUpdateSettings(currentUser, appSettings),
    [currentUser, appSettings],
  );
  const canRebuildCube = useMemo(
    () => canUserRebuildCube(currentUser, appSettings),
    [currentUser, appSettings],
  );
  const isCurrentUserAdmin = useMemo(
    () => isLookerAdminUser(currentUser),
    [currentUser],
  );

  // Formula bar & writeback cell state
  const [activeCellCoord, setActiveCellCoord] = useState<string>("A1");
  const [formulaText, setFormulaText] = useState<string>(
    '=GETVALUE("Total Sale Price", "Current", "ytd", "ALL")',
  );
  const [selectedCellMeta, setSelectedCellMeta] = useState<{
    memberId: string;
    path: string;
    metric: string;
    period: string;
    currentValue: number;
  } | null>(
    initialUrlState.edit
      ? {
          memberId: initialUrlState.member || "DEPT:Men",
          path: "All Products|Men",
          metric: "Total Sale Price",
          period: "Current",
          currentValue: 942100,
        }
      : null,
  );
  const [editValueInput, setEditValueInput] = useState<string>(initialUrlState.edit || "");
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Stacked Bottom-Right Stateful Toasts (lookbase-toasts skill)
  const [toasts, setToasts] = useState<LookBaseToast[]>([]);
  const toastTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismissToast = useCallback((id: string) => {
    if (toastTimersRef.current[id]) {
      clearTimeout(toastTimersRef.current[id]);
      delete toastTimersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleToastTimer = useCallback(
    (id: string, timeoutMs?: number | null) => {
      if (toastTimersRef.current[id]) {
        clearTimeout(toastTimersRef.current[id]);
        delete toastTimersRef.current[id];
      }
      if (typeof timeoutMs === "number" && timeoutMs > 0) {
        toastTimersRef.current[id] = setTimeout(() => {
          dismissToast(id);
        }, timeoutMs);
      }
    },
    [dismissToast],
  );

  const pushToast = useCallback(
    (opts: { message: string; variant?: ToastVariant; timeoutMs?: number | null }): string => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const variant: ToastVariant = opts.variant || "info";
      const timeoutMs =
        opts.timeoutMs !== undefined
          ? opts.timeoutMs
          : variant === "info"
            ? null
            : variant === "error"
              ? 6000
              : 4000;
      setToasts((prev) => [...prev, { id, message: opts.message, variant, timeoutMs }]);
      scheduleToastTimer(id, timeoutMs);
      return id;
    },
    [scheduleToastTimer],
  );

  const updateToast = useCallback(
    (
      id: string,
      patch: { message?: string; variant?: ToastVariant; timeoutMs?: number | null },
    ) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const nextVariant = patch.variant || t.variant;
          const nextTimeout =
            patch.timeoutMs !== undefined
              ? patch.timeoutMs
              : nextVariant === "info"
                ? null
                : nextVariant === "error"
                  ? 6000
                  : 4000;
          scheduleToastTimer(id, nextTimeout);
          return {
            ...t,
            ...(patch.message !== undefined ? { message: patch.message } : {}),
            variant: nextVariant,
            timeoutMs: nextTimeout,
          };
        }),
      );
    },
    [scheduleToastTimer],
  );

  useEffect(() => {
    return () => {
      Object.values(toastTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const autocompleteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (styles && typeof (styles as any).use === "function") {
      (styles as any).use();
    }
    if (driverStyles && typeof (driverStyles as any).use === "function") {
      (driverStyles as any).use();
    }
    return () => {
      (styles as any)?.unuse?.();
      (driverStyles as any)?.unuse?.();
    };
  }, []);

  useEffect(() => {
    if (host) return;
    connectExtensionHost({
      chattyTimeout: -1,
      setInitialRoute: (route: string) => {
        if (route) setHostRoute(route);
      },
      hostChangedRoute: (route: string) => {
        if (route) setHostRoute(route);
      },
      visualizationDataReceivedCallback: setVisData,
      tileHostDataChangedCallback: (newHostData: Record<string, any>) =>
        setTileHostData((prev) => ({ ...(prev || {}), ...(newHostData || {}) })),
    }).then((sdk) => {
      setExtensionSDK(sdk);
      if (sdk.lookerHostData?.route) {
        setHostRoute(sdk.lookerHostData.route);
      }
      if (sdk.visualizationSDK?.visualizationData) {
        setVisData(sdk.visualizationSDK.visualizationData);
      }
      if ((sdk.tileSDK as any)?.tileHostData) {
        setTileHostData((sdk.tileSDK as any).tileHostData);
      }
    });
  }, [host]);

  const activeHost = host ?? extensionSDK;
  const tileSDK = activeHost?.tileSDK;
  const visualizationSDK = activeHost?.visualizationSDK;
  const artifactNamespace =
    activeHost?.lookerHostData?.extensionId || DEFAULT_ARTIFACT_NAMESPACE;

  const core40SDK = useMemo(
    () =>
      activeHost && typeof (activeHost as any).invokeCoreSdk === "function"
        ? LookerExtensionSDK.createClient(activeHost as any)
        : undefined,
    [activeHost],
  );

  const pcConfig =
    calcConfig.parent_child_hierarchy || DEFAULT_CALCULATIONS_CONFIG.parent_child_hierarchy!;

  const activeVisData = visData ?? visualizationSDK?.visualizationData;
  const hostQueryResponse = activeVisData?.queryResponse as unknown as QueryResponse | undefined;
  const rawQueryResponse = useMemo(
    () => normalizeQueryResponseFields(hostQueryResponse ?? standaloneQueryResponse),
    [hostQueryResponse, standaloneQueryResponse],
  );

  // Detect whether current query uses parent-child (member_id / parent_id) outline mode
  const isParentChildMode = useMemo(() => {
    if (outlineRows.length > 0) return true;
    const dims = rawQueryResponse?.fields?.dimension_like || [];
    return dims.some((d: any) => d.name === pcConfig.memberIdField);
  }, [outlineRows, rawQueryResponse, pcConfig.memberIdField]);

  const projectedOutline = useMemo(() => {
    if (!isParentChildMode || !rawQueryResponse) return null;
    const rawRows = outlineRows.length > 0 ? outlineRows : rawQueryResponse.data || [];
    const explicitBrandIds = new Set(
      savedExpandedMemberIds.filter((id) => id.startsWith("BRAND:")),
    );
    const categoriesWithExplicitBrands = new Set(
      Array.from(explicitBrandIds).map((id) => {
        const parts = id.slice("BRAND:".length).split("|");
        return `CAT:${parts[0]}|${parts[1]}`;
      }),
    );
    const rowsToProject =
      categoriesWithExplicitBrands.size === 0
        ? rawRows
        : rawRows.filter((r: any) => {
            const memberId = String(
              r?.[pcConfig.memberIdField]?.value ?? r?.[pcConfig.memberIdField] ?? "",
            );
            const parentId = String(
              r?.[pcConfig.parentIdField]?.value ?? r?.[pcConfig.parentIdField] ?? "",
            );
            if (memberId.startsWith("BRAND:") && categoriesWithExplicitBrands.has(parentId)) {
              return explicitBrandIds.has(memberId);
            }
            return true;
          });
    return projectOutlineRowsToReportTable(rowsToProject, rawQueryResponse, pcConfig, 4);
  }, [isParentChildMode, outlineRows, rawQueryResponse, pcConfig, savedExpandedMemberIds]);

  const effectiveQueryResponse: QueryResponse | undefined = useMemo(() => {
    if (projectedOutline) {
      return projectedOutline.queryResponse;
    }
    return rawQueryResponse;
  }, [projectedOutline, rawQueryResponse]);

  // Build unified catalog of all hierarchy nodes (merging full dim_product_hierarchy catalog with loaded grid nodes)
  const loadedOutlineNodes = useMemo(
    () =>
      projectedOutline
        ? sortOutlineNodesTreeOrder(Object.values(projectedOutline.memberIdToNode))
        : [],
    [projectedOutline],
  );

  const allHierarchyNodes = useMemo(() => {
    const byId = new Map<string, OutlineNodeMeta>();
    for (const n of hierarchyCatalogNodes) {
      byId.set(n.memberId, n);
    }
    for (const n of loadedOutlineNodes) {
      byId.set(n.memberId, n);
    }
    return sortOutlineNodesTreeOrder(Array.from(byId.values()));
  }, [hierarchyCatalogNodes, loadedOutlineNodes]);

  const allHierarchyNodeMap = useMemo(() => {
    const map: Record<string, OutlineNodeMeta> = {};
    for (const n of allHierarchyNodes) {
      map[n.memberId] = n;
    }
    return map;
  }, [allHierarchyNodes]);

  // Keep expandedPaths deterministically synchronized whenever savedExpandedMemberIds or hierarchy updates
  useEffect(() => {
    if (projectedOutline) {
      const derived = deriveExpandedPathsFromMemberIds(
        savedExpandedMemberIds,
        allHierarchyNodeMap,
        expandedPaths,
      );
      if (derived.join(",") !== expandedPaths.join(",")) {
        setExpandedPaths(derived);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedExpandedMemberIds, projectedOutline, allHierarchyNodeMap]);

  // Debounce autocomplete search query (150ms) and reset virtual scroll offset when query or level checkboxes change
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMetricQuery(leftMetricQuery);
      setAutocompleteScrollTop(0);
    }, 150);
    return () => clearTimeout(timer);
  }, [leftMetricQuery]);

  const availableMemberLevels = useMemo(() => {
    let maxLvl = 3;
    for (const n of allHierarchyNodes) {
      if (n.level > maxLvl) maxLvl = n.level;
    }
    return Array.from({ length: maxLvl }, (_, i) => i + 1);
  }, [allHierarchyNodes]);

  const autocompleteCatalog = useMemo(
    () =>
      buildAutocompleteCatalog(
        calcConfig,
        rawQueryResponse?.fields?.measure_like || [],
        allHierarchyNodes,
      ),
    [calcConfig, rawQueryResponse?.fields?.measure_like, allHierarchyNodes],
  );

  const autocompleteMatches = useMemo(
    () =>
      searchAutocompleteItems(
        debouncedMetricQuery,
        autocompleteCatalog,
        Infinity,
        autocompleteMemberLevels,
      ),
    [debouncedMetricQuery, autocompleteCatalog, autocompleteMemberLevels],
  );

  // Sync deterministic URL query string whenever state changes
  const lastSyncedQueryRef = useRef<string>("");
  useEffect(() => {
    const qs = serializeLookBaseUrlState({
      version: povVersion,
      timeframe: povTimeframe,
      source: povSource,
      year: povYear,
      member: selectedOutlineMemberId,
      expanded: savedExpandedMemberIds,
      metrics: leftMetricRows.map((r) => r.id),
      pane: showLeftMetricsPane,
      modal: isHierarchyModalOpen ? "hierarchy" : null,
      q: leftMetricQuery || undefined,
      edit: editValueInput || undefined,
    });
    if (!qs || qs === lastSyncedQueryRef.current) return;
    lastSyncedQueryRef.current = qs;

    try {
      activeHost?.clientRouteChanged?.(`/?${qs}`);
    } catch {
      // ignore host route notification errors
    }
    try {
      if (typeof window !== "undefined" && window.history?.replaceState) {
        window.history.replaceState(null, "", `?${qs}`);
      }
    } catch {
      // ignore sandboxed history errors
    }
  }, [
    activeHost,
    povVersion,
    povTimeframe,
    povSource,
    povYear,
    selectedOutlineMemberId,
    savedExpandedMemberIds,
    leftMetricRows,
    showLeftMetricsPane,
    isHierarchyModalOpen,
    leftMetricQuery,
    editValueInput,
  ]);

  // Persist saved expansion to Looker Artifacts API (and localStorage fallback) so all expanded branches load together on startup
  const persistSavedExpansion = useCallback(
    (memberIds: string[], paths: string[]) => {
      setSavedExpandedMemberIds(memberIds);
      saveUserPrefsArtifact(
        core40SDK,
        {
          savedExpandedMemberIds: memberIds,
          savedExpandedPaths: paths,
        },
        artifactNamespace,
      );
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(SAVED_EXPANSION_STORAGE_KEY, JSON.stringify(memberIds));
          window.localStorage.setItem(SAVED_PATHS_STORAGE_KEY, JSON.stringify(paths));
        }
      } catch {
        // ignore storage errors
      }
    },
    [core40SDK, artifactNamespace],
  );

  // Unfold/fold a branch inside the Jagged Hierarchy Modal, async-loading its immediate children on demand
  const handleToggleModalUnfold = useCallback(
    async (node: OutlineNodeMeta) => {
      if (node.isLeaf) return;
      const isCurrentlyUnfolded = modalUnfoldedIds.includes(node.memberId);
      if (isCurrentlyUnfolded) {
        setModalUnfoldedIds((prev) =>
          prev.filter((id) => {
            if (id === node.memberId) return false;
            const target = allHierarchyNodeMap[id];
            if (target && target.path.startsWith(node.path + "|")) return false;
            return true;
          }),
        );
        return;
      }

      setModalUnfoldedIds((prev) =>
        prev.includes(node.memberId) ? prev : [...prev, node.memberId],
      );

      if (core40SDK && !modalFetchedParentsRef.current.has(node.memberId)) {
        modalFetchedParentsRef.current.add(node.memberId);
        setModalLoadingParentIds((prev) =>
          prev.includes(node.memberId) ? prev : [...prev, node.memberId],
        );
        try {
          const childNodes = await fetchHierarchyModalChildren(
            core40SDK,
            calcConfig.model || "lookbase",
            [node.memberId],
            pcConfig,
          );
          if (childNodes.length > 0) {
            setHierarchyCatalogNodes((prev) => {
              const byId = new Map<string, OutlineNodeMeta>();
              for (const existing of prev) byId.set(existing.memberId, existing);
              for (const child of childNodes) byId.set(child.memberId, child);
              return sortOutlineNodesTreeOrder(Array.from(byId.values()));
            });
          }
        } finally {
          setModalLoadingParentIds((prev) => prev.filter((id) => id !== node.memberId));
        }
      }
    },
    [modalUnfoldedIds, allHierarchyNodeMap, core40SDK, calcConfig.model, pcConfig],
  );

  // Load initial parent-child outline AND restore all saved expanded branches together on load
  const loadStandaloneOutline = useCallback(
    async (
      versionOverride = povVersion,
      timeframeOverride = povTimeframe,
      sourceOverride = povSource,
      yearOverride = povYear,
      expandedMemberIdsOverride = savedExpandedMemberIds,
    ) => {
      if (!core40SDK) return;
      setIsBusy(true);
      const aligned = normalizeSourceAndTimeframe(sourceOverride, timeframeOverride);
      const explicitBrandIds = expandedMemberIdsOverride.filter((id) =>
        id.startsWith("BRAND:"),
      );
      const nonLeafParentIds = expandedMemberIdsOverride.flatMap((id) => {
        if (id.startsWith("BRAND:")) {
          const parts = id.slice("BRAND:".length).split("|");
          if (parts.length >= 2) {
            return [`DEPT:${parts[0]}`, `CAT:${parts[0]}|${parts[1]}`];
          }
          return [];
        }
        return [id];
      });
      const parentSet = Array.from(new Set(["ROOT", "ALL", ...nonLeafParentIds]));

      const toastId = pushToast({
        message: `Syncing live cube (${parentSet.length} parent branch${parentSet.length === 1 ? "" : "es"} in batch)...`,
        variant: "info",
        timeoutMs: null,
      });
      try {
        const baseFilters: Record<string, string> = {
          "long_metrics.timeframe": aligned.timeframe,
          "long_metrics.source_parameter": aligned.source,
        };
        if (yearOverride && yearOverride !== "ALL") {
          baseFilters["long_metrics.year"] = escapeLookerFilterValue(yearOverride);
        }

        const gridMeasures = calcConfig.initial_state?.grid_measures?.length
          ? calcConfig.initial_state.grid_measures
          : [
              "long_metrics.total_sale_price",
              "long_metrics.total_gross_margin",
              "long_metrics.gross_margin_percentage",
            ];

        const fields = [
          pcConfig.memberIdField,
          pcConfig.parentIdField,
          pcConfig.labelField,
          pcConfig.pathField,
          pcConfig.levelField,
          pcConfig.isLeafField,
          "long_metrics.current_period",
          ...gridMeasures,
        ];

        const firstChunk = buildLookerFilterExpression(parentSet.slice(0, 20));
        const explicitBrandsFilter =
          explicitBrandIds.length > 0
            ? buildLookerFilterExpression(explicitBrandIds.slice(0, 50))
            : "";

        const [rawFirstResp, restored, rawExplicitBrandsResp] = await Promise.all([
          core40SDK.ok(
            core40SDK.run_inline_query({
              result_format: "json_detail",
              body: {
                model: calcConfig.model || "lookbase",
                view: calcConfig.explore || "long_metrics",
                fields,
                pivots: ["long_metrics.current_period"],
                filters: {
                  ...baseFilters,
                  [pcConfig.parentIdField]: firstChunk,
                },
                sorts: [pcConfig.levelField, pcConfig.labelField],
                limit: "500",
              },
            }),
          ),
          parentSet.length > 20
            ? restoreSavedOutlineExpansion(
                core40SDK,
                {
                  model: calcConfig.model || "lookbase",
                  view: calcConfig.explore || "long_metrics",
                  fields,
                  pivots: ["long_metrics.current_period"],
                  filters: baseFilters,
                  sorts: [pcConfig.levelField, pcConfig.labelField],
                },
                parentSet.slice(20),
                pcConfig,
                20,
              )
            : Promise.resolve({ rows: [], fetchedParentIds: parentSet, batchCount: 1 }),
          explicitBrandsFilter
            ? core40SDK
                .ok(
                  core40SDK.run_inline_query({
                    result_format: "json_detail",
                    body: {
                      model: calcConfig.model || "lookbase",
                      view: calcConfig.explore || "long_metrics",
                      fields,
                      pivots: ["long_metrics.current_period"],
                      filters: {
                        ...baseFilters,
                        [pcConfig.memberIdField]: explicitBrandsFilter,
                      },
                      sorts: [pcConfig.levelField, pcConfig.labelField],
                      limit: "500",
                    },
                  }),
                )
                .catch(() => null)
            : Promise.resolve(null),
        ]);

        const firstResp = parseSdkJson(rawFirstResp);
        const primaryRows = Array.isArray((firstResp as any)?.data) ? (firstResp as any).data : [];
        let allMergedRows =
          restored.rows.length > 0
            ? mergeOutlineRows(primaryRows, restored.rows, pcConfig)
            : primaryRows;

        if (rawExplicitBrandsResp) {
          const parsedBrandsResp = parseSdkJson(rawExplicitBrandsResp);
          const brandRows = Array.isArray((parsedBrandsResp as any)?.data)
            ? (parsedBrandsResp as any).data
            : [];
          if (brandRows.length > 0) {
            allMergedRows = mergeOutlineRows(allMergedRows, brandRows, pcConfig);
          }
        }

        if (firstResp && allMergedRows.length > 0) {
          const normalizedResp = normalizeQueryResponseFields(firstResp);
          setOutlineRows(allMergedRows);
          setStandaloneQueryResponse({
            ...normalizedResp,
            data: allMergedRows,
          } as QueryResponse);
          fetchedMemberIdsRef.current = new Set(parentSet);
        }
        updateToast(toastId, {
          message: `Cube synced (${allMergedRows.length} rows across ${parentSet.length} parent branch${parentSet.length === 1 ? "" : "es"}).`,
          variant: "success",
          timeoutMs: 3500,
        });
      } catch {
        updateToast(toastId, {
          message: "Interactive Cube Ready (using cached outline snapshot).",
          variant: "success",
          timeoutMs: 3500,
        });
      } finally {
        setIsBusy(false);
      }
    },
    [
      core40SDK,
      calcConfig.model,
      calcConfig.explore,
      calcConfig.initial_state?.grid_measures,
      pcConfig,
      povVersion,
      povTimeframe,
      povSource,
      povYear,
      savedExpandedMemberIds,
      pushToast,
      updateToast,
    ],
  );

  // Unified deterministic URL state applier (used by URL query params AND Quick-Start Action pills)
  const applyUrlState = useCallback(
    (urlPatch: LookBaseUrlState, triggerLiveSync = true) => {
      const nextVersion = urlPatch.version ?? povVersion;
      const nextTimeframe = urlPatch.timeframe ?? povTimeframe;
      const nextSource = urlPatch.source ?? povSource;
      const nextYear = urlPatch.year ?? povYear;

      if (urlPatch.version !== undefined) setPovVersion(urlPatch.version);
      if (urlPatch.timeframe !== undefined) setPovTimeframe(urlPatch.timeframe);
      if (urlPatch.source !== undefined) setPovSource(urlPatch.source);
      if (urlPatch.year !== undefined) setPovYear(urlPatch.year);

      if (urlPatch.pane !== undefined) {
        setShowLeftMetricsPane(urlPatch.pane);
      }
      if (urlPatch.q !== undefined) {
        setLeftMetricQuery(urlPatch.q);
        if (urlPatch.q) {
          setShowLeftMetricsPane(true);
          setIsAutocompleteOpen(true);
          setTimeout(() => autocompleteInputRef.current?.focus(), 30);
        }
      }
      if (urlPatch.modal !== undefined) {
        setIsHierarchyModalOpen(urlPatch.modal === "hierarchy");
        setIsSettingsModalOpen(urlPatch.modal === "settings");
      }
      if (urlPatch.member !== undefined) {
        setSelectedOutlineMemberId(urlPatch.member);
        const node = projectedOutline?.memberIdToNode?.[urlPatch.member];
        const salesVal =
          node?.rawRow?.["long_metrics.total_sale_price"]?.Current?.value ?? 942100;
        setFormulaText(
          `=GETVALUE("Total Sale Price", "Current", "${nextTimeframe}", "${pcConfig.memberIdField}=${urlPatch.member}")`,
        );
        if (urlPatch.edit !== undefined || nextVersion === "sandbox") {
          setSelectedCellMeta({
            memberId: urlPatch.member,
            path: node?.path || "All Products|Men",
            metric: "Total Sale Price",
            period: "Current",
            currentValue: salesVal,
          });
        }
      }
      if (urlPatch.edit !== undefined) {
        setEditValueInput(urlPatch.edit);
        if (!selectedCellMeta) {
          const targetMember = urlPatch.member || selectedOutlineMemberId || "DEPT:Men";
          const node = projectedOutline?.memberIdToNode?.[targetMember];
          setSelectedCellMeta({
            memberId: targetMember,
            path: node?.path || "All Products|Men",
            metric: "Total Sale Price",
            period: "Current",
            currentValue:
              node?.rawRow?.["long_metrics.total_sale_price"]?.Current?.value ?? 942100,
          });
        }
      }
      if (urlPatch.expanded && urlPatch.expanded.length > 0) {
        const nextIds = Array.from(new Set(["ROOT", "ALL", ...urlPatch.expanded]));
        const nextPaths = projectedOutline
          ? deriveExpandedPathsFromMemberIds(nextIds, projectedOutline.memberIdToNode, expandedPaths)
          : expandedPaths;
        setExpandedPaths(nextPaths);
        persistSavedExpansion(nextIds, nextPaths);
      }
      if (urlPatch.metrics && urlPatch.metrics.length > 0) {
        setLeftMetricRows(
          resolveInitialLeftHandMetrics(calcConfig, autocompleteCatalog, urlPatch.metrics),
        );
      }
      if (urlPatch.quickstart === "1") {
        setShowQuickStartBar(true);
      } else if (urlPatch.quickstart === "0") {
        setShowQuickStartBar(false);
      } else if (urlPatch.quickstart === "reset") {
        setShowQuickStartBar(true);
        setDismissedQuickStartIds([]);
        saveUserPrefsArtifact(
          core40SDK,
          { quickStartDismissed: false, resetDismissedQuickStarts: true },
          artifactNamespace,
        );
      }

      if (
        triggerLiveSync &&
        (urlPatch.version !== undefined ||
          urlPatch.timeframe !== undefined ||
          urlPatch.source !== undefined ||
          urlPatch.year !== undefined ||
          urlPatch.expanded !== undefined)
      ) {
        loadStandaloneOutline(
          nextVersion,
          nextTimeframe,
          nextSource,
          nextYear,
          urlPatch.expanded || savedExpandedMemberIds,
        );
      }
    },
    [
      povVersion,
      povTimeframe,
      povSource,
      povYear,
      projectedOutline,
      pcConfig.memberIdField,
      selectedCellMeta,
      selectedOutlineMemberId,
      expandedPaths,
      persistSavedExpansion,
      calcConfig,
      autocompleteCatalog,
      core40SDK,
      artifactNamespace,
      loadStandaloneOutline,
      savedExpandedMemberIds,
    ],
  );

  // Load project-backed calculations.strings.json, auto-discover LookML Explore fields, AND apply URL > Artifact > Config precedence
  useEffect(() => {
    if (!activeHost) return;
    let cancelled = false;

    (async () => {
      const [rawCfg, userArtifact, exploreMeta] = await Promise.all([
        loadProjectCalculations(activeHost, "lookbase", "calculations.strings.json"),
        loadUserPrefsArtifact(core40SDK, artifactNamespace),
        core40SDK && typeof core40SDK.lookml_model_explore === "function"
          ? core40SDK
              .ok(
                core40SDK.lookml_model_explore(
                  "lookbase",
                  "long_metrics",
                  "id,name,fields",
                ),
              )
              .catch(() => null)
          : Promise.resolve(null),
      ]);
      if (cancelled) return;

      const loadedCfg = exploreMeta
        ? discoverFieldsFromExplore(exploreMeta, rawCfg)
        : rawCfg;
      setCalcConfig(loadedCfg);
      if (userArtifact.user) {
        setCurrentUser(userArtifact.user);
      }

      const loadedSettings = await loadLookBaseSettings(
        activeHost,
        core40SDK,
        artifactNamespace,
        loadedCfg.settings,
      );
      if (cancelled) return;
      setAppSettings(loadedSettings);
      setSettingsDraft(loadedSettings);
      setSettingsGroupIdsInput(loadedSettings.settings_group_ids.join(", "));
      setSettingsUserIdsInput(loadedSettings.settings_user_ids.join(", "));
      setRebuildCubeGroupIdsInput(loadedSettings.rebuild_cube_group_ids.join(", "));
      setRebuildCubeUserIdsInput(loadedSettings.rebuild_cube_user_ids.join(", "));

      const initCfg = loadedCfg.initial_state || DEFAULT_CALCULATIONS_CONFIG.initial_state || {};
      const prefs = userArtifact.prefs || {};
      const urlState = parseLookBaseUrlState(
        hostRoute || (typeof window !== "undefined" ? window.location.search : ""),
      );

      // Deterministic Precedence: 1. URL Query Parameter -> 2. User Artifact -> 3. lookbase.config.json
      const startVersion = urlState.version || prefs.pov?.version || initCfg.version || "base";
      const rawTimeframe =
        urlState.timeframe || prefs.pov?.timeframe || initCfg.timeframe || "ytd";
      const rawSource =
        urlState.source || prefs.pov?.source || initCfg.source || "Daily Actual";
      const alignedPov = normalizeSourceAndTimeframe(rawSource, rawTimeframe);
      const startTimeframe = alignedPov.timeframe;
      const startSource = alignedPov.source;
      const startYear = urlState.year || prefs.pov?.year || initCfg.year || "ALL";
      setPovVersion(startVersion);
      setPovTimeframe(startTimeframe);
      setPovSource(startSource);
      setPovYear(startYear);

      const startMember =
        urlState.member || initCfg.selected_outline_member_id || "ALL";
      setSelectedOutlineMemberId(startMember);

      if (urlState.pane !== undefined) {
        setShowLeftMetricsPane(urlState.pane);
      } else if (initCfg.show_left_metrics_pane !== undefined) {
        setShowLeftMetricsPane(Boolean(initCfg.show_left_metrics_pane));
      }

      if (urlState.modal === "hierarchy") {
        setIsHierarchyModalOpen(true);
      } else if (urlState.modal === "settings") {
        if (canUserUpdateSettings(userArtifact.user, loadedSettings)) {
          setIsSettingsModalOpen(true);
        }
      }
      if (urlState.q) {
        setLeftMetricQuery(urlState.q);
        setIsAutocompleteOpen(true);
      }
      if (urlState.edit) {
        setEditValueInput(urlState.edit);
      }

      // Apply starting expanded hierarchy nodes (URL -> User Artifact -> Project Config)
      const startMemberIds =
        urlState.expanded?.length
          ? urlState.expanded
          : prefs.savedExpandedMemberIds?.length
            ? prefs.savedExpandedMemberIds
            : initCfg.expanded_member_ids || ["ROOT", "ALL", "DEPT:Men", "DEPT:Women"];
      const startPaths =
        prefs.savedExpandedPaths?.length && !urlState.expanded?.length
          ? prefs.savedExpandedPaths
          : initCfg.expanded_paths || ["All Products", "All Products|Men"];
      setSavedExpandedMemberIds(startMemberIds);
      setExpandedPaths(startPaths);

      // Apply starting Left-Hand Metrics (URL -> User Artifact -> Project Config)
      const catalog = buildAutocompleteCatalog(loadedCfg);
      setLeftMetricRows(
        resolveInitialLeftHandMetrics(
          loadedCfg,
          catalog,
          urlState.metrics?.length ? urlState.metrics : prefs.leftHandMetricIds,
        ),
      );

      // Quick-Start Bar & Custom Quick-Start Pills
      if (prefs.customQuickStartActions?.length) {
        setCustomQuickStartActions(prefs.customQuickStartActions);
      }
      if (urlState.quickstart === "reset") {
        setShowQuickStartBar(true);
        setDismissedQuickStartIds([]);
        saveUserPrefsArtifact(
          core40SDK,
          { quickStartDismissed: false, resetDismissedQuickStarts: true },
          artifactNamespace,
        );
      } else {
        if (prefs.dismissedQuickStartIds?.length) {
          setDismissedQuickStartIds(prefs.dismissedQuickStartIds);
        }
        if (urlState.quickstart === "1") {
          setShowQuickStartBar(true);
        } else if (urlState.quickstart === "0" || prefs.quickStartDismissed) {
          setShowQuickStartBar(false);
        }
      }

      if (core40SDK) {
        fetchFullHierarchyCatalog(
          core40SDK,
          loadedCfg.model || "lookbase",
          loadedCfg.parent_child_hierarchy || pcConfig,
        ).then((fullNodes) => {
          if (!cancelled && fullNodes.length > 0) {
            setHierarchyCatalogNodes(fullNodes);
          }
        });

        // Dynamically discover all available years in long_metrics
        core40SDK
          .ok(
            core40SDK.run_inline_query({
              result_format: "json",
              body: {
                model: loadedCfg.model || "lookbase",
                view: loadedCfg.explore || "long_metrics",
                fields: ["long_metrics.year"],
                filters: {
                  [pcConfig.memberIdField]: "ALL",
                  "long_metrics.timeframe": "current_view",
                  "long_metrics.source_parameter": "Daily Actual",
                },
                sorts: ["long_metrics.year desc"],
                limit: "50",
              },
            }),
          )
          .then((rawYr) => {
            const parsedYr = parseSdkJson(rawYr);
            if (!cancelled && Array.isArray(parsedYr) && parsedYr.length > 0) {
              const yrs = Array.from(
                new Set(
                  parsedYr
                    .map((r: any) => String(r?.["long_metrics.year"] ?? ""))
                    .filter(Boolean),
                ),
              );
              if (yrs.length > 0) {
                setAvailableYears(yrs);
              }
            }
          })
          .catch(() => {
            // keep default 2026..2019 years list
          });
      }

      if (!hostQueryResponse && core40SDK) {
        loadStandaloneOutline(
          startVersion,
          startTimeframe,
          startSource,
          startYear,
          startMemberIds,
        );
      }

      // Guided Tour deterministic resolution (?tour=0 | ?tour=1 | ?tour=reset | ?tour=<uuid> | next unseen guide)
      if (urlState.tour === "0" || urlState.tour === "false") {
        return;
      }
      if (urlState.tour === "reset") {
        await saveUserPrefsArtifact(
          core40SDK,
          { tourDismissed: false, resetDismissedGuides: true },
          artifactNamespace,
        );
      }
      const allGuides = getLookBaseGuides();
      const explicitGuide =
        urlState.tour && urlState.tour !== "1" && urlState.tour !== "reset"
          ? allGuides.find((g) => g.id === urlState.tour)
          : urlState.tour === "1" || urlState.tour === "reset"
            ? allGuides[0]
            : undefined;
      const nextGuide = explicitGuide || getNextUnseenGuide(prefs, allGuides);

      if (
        nextGuide &&
        (explicitGuide || (!prefs.tourDismissed && initCfg.show_tour_for_new_users !== false)) &&
        !tourAutoStartedRef.current
      ) {
        tourAutoStartedRef.current = true;
        setTimeout(() => {
          if (!cancelled) {
            startLookBaseTour({
              core40SDK,
              namespace: artifactNamespace,
              guide: nextGuide,
            });
          }
        }, 500);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeHost, core40SDK, artifactNamespace, hostRoute]);

  useEffect(() => {
    if (hostQueryResponse?.data?.length) {
      const firstRow = hostQueryResponse.data[0];
      if (firstRow && firstRow[pcConfig.memberIdField] !== undefined) {
        setOutlineRows(hostQueryResponse.data);
      }
    }
  }, [hostQueryResponse, pcConfig.memberIdField]);

  const updateAndPersistLeftMetrics = useCallback(
    (updater: (prev: AutocompleteItem[]) => AutocompleteItem[]) => {
      setLeftMetricRows((prev) => {
        const next = updater(prev);
        saveUserPrefsArtifact(
          core40SDK,
          { leftHandMetricIds: next.map((i) => i.id) },
          artifactNamespace,
        );
        return next;
      });
    },
    [core40SDK, artifactNamespace],
  );

  const handleSelectAutocompleteItem = useCallback(
    (item: AutocompleteItem) => {
      if (item.category === "member") {
        const memberId = item.id.replace(/^member:/, "");
        setSelectedOutlineMemberId(memberId);
        setFormulaText(item.formula || "");
      } else if (replacingRowId) {
        updateAndPersistLeftMetrics((prev) =>
          prev.map((row) => (row.id === replacingRowId ? item : row)),
        );
        setReplacingRowId(null);
        setActiveMetricRowId(item.id);
        setFormulaText(`=${item.formula || item.label}`);
      } else {
        updateAndPersistLeftMetrics((prev) => {
          if (prev.some((r) => r.id === item.id)) return prev;
          return [...prev, item];
        });
        setActiveMetricRowId(item.id);
        setFormulaText(`=${item.formula || item.label}`);
      }
      setLeftMetricQuery("");
      setIsAutocompleteOpen(false);
      setHighlightedIndex(0);
    },
    [replacingRowId, updateAndPersistLeftMetrics],
  );

  const handleAutocompleteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIsAutocompleteOpen(true);
        setHighlightedIndex((prev) =>
          autocompleteMatches.length > 0 ? (prev + 1) % autocompleteMatches.length : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIsAutocompleteOpen(true);
        setHighlightedIndex((prev) =>
          autocompleteMatches.length > 0
            ? (prev - 1 + autocompleteMatches.length) % autocompleteMatches.length
            : 0,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const chosen = autocompleteMatches[highlightedIndex] || autocompleteMatches[0];
        if (chosen) {
          handleSelectAutocompleteItem(chosen);
        }
      } else if (e.key === "Escape") {
        setIsAutocompleteOpen(false);
        setReplacingRowId(null);
      }
    },
    [autocompleteMatches, highlightedIndex, handleSelectAutocompleteItem],
  );

  const baseVisConfig = useMemo(
    () => ({
      ...LOOKBASE_DEFAULT_VIS_CONFIG,
      ...((activeVisData?.visConfig as VisConfig) || {}),
      expandSubtotals: expandedPaths.join(","),
    }),
    [activeVisData?.visConfig, expandedPaths],
  );

  const { artifactLoaded, effectiveVisConfig, handleUpdateConfig } = useUserArtifacts({
    extensionSDK: activeHost,
    activeHost,
    tileSDK,
    visualizationSDK,
    tileHostData,
    baseVisConfig,
    queryResponse: effectiveQueryResponse,
  });

  const reportTableConfig = useMemo(
    () => ({
      ...LOOKBASE_DEFAULT_VIS_CONFIG,
      ...effectiveVisConfig,
      theme: "custom",
      customTheme: "",
      expandSubtotals: expandedPaths.join(","),
      isExtension: true,
    }),
    [effectiveVisConfig, expandedPaths],
  );

  // Sync collapsed row visibility immediately after buildReportTable finishes so newly merged async child rows
  // never leave collapsed branches visible
  const syncCollapsedRowsDom = useCallback(() => {
    const el = gridWrapperRef.current;
    if (!el) return;
    const rows = Array.from(el.querySelectorAll("#reportTable tbody tr")) as HTMLElement[];
    const collapsedPaths = rows
      .filter((r) => r.classList.contains("subtotal") && r.classList.contains("collapsed"))
      .map((r) => r.getAttribute("data-subtotal-path") || "")
      .filter(Boolean);
    for (const tr of rows) {
      const trPath = tr.getAttribute("data-subtotal-path") || "";
      const isHidden =
        Boolean(trPath) &&
        collapsedPaths.some(
          (cp) =>
            trPath.startsWith(cp + "|") ||
            (trPath === cp && tr.classList.contains("line_item")),
        );
      tr.style.display = isHidden ? "none" : "";
    }
  }, []);

  // Intercept [+] / [-] subtotal expansion to fire live child query on unexpanded member_id
  // AND save the expanded member_ids to the Looker Artifacts API so all expanded branches load together on next load
  const handleLookBaseUpdateConfig = useCallback(
    async (partial: Partial<VisConfig>) => {
      handleUpdateConfig(partial);

      if (typeof partial.expandSubtotals === "string") {
        const nextExpanded = partial.expandSubtotals
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        setExpandedPaths(nextExpanded);

        if (isParentChildMode && projectedOutline) {
          const activeExpandedMemberIds = new Set<string>(["ROOT", "ALL"]);
          for (const pathStr of nextExpanded) {
            const n = projectedOutline.pathToNode[pathStr];
            if (n) activeExpandedMemberIds.add(n.memberId);
          }
          persistSavedExpansion(Array.from(activeExpandedMemberIds), nextExpanded);
        }

        if (!core40SDK) return;

        if (isParentChildMode && projectedOutline) {
          const newlyExpandedNodes: OutlineNodeMeta[] = [];
          for (const pathStr of nextExpanded) {
            const node: OutlineNodeMeta | undefined = projectedOutline.pathToNode[pathStr];
            if (node && !node.isLeaf && !fetchedMemberIdsRef.current.has(node.memberId)) {
              fetchedMemberIdsRef.current.add(node.memberId);
              newlyExpandedNodes.push(node);
            }
          }

          if (newlyExpandedNodes.length > 0) {
            setIsBusy(true);
            const parentIdsToFetch = newlyExpandedNodes.map((n) => n.memberId);
            const labelList = newlyExpandedNodes.map((n) => n.label).join(", ");
            const toastId = pushToast({
              message: `Expanding ${labelList}...`,
              variant: "info",
              timeoutMs: null,
            });
            try {
              const restored = await restoreSavedOutlineExpansion(
                core40SDK,
                {
                  model: calcConfig.model || "lookbase",
                  view: calcConfig.explore || "long_metrics",
                  fields: [
                    pcConfig.memberIdField,
                    pcConfig.parentIdField,
                    pcConfig.labelField,
                    pcConfig.pathField,
                    pcConfig.levelField,
                    pcConfig.isLeafField,
                    "long_metrics.current_period",
                    ...(calcConfig.initial_state?.grid_measures || [
                      "long_metrics.total_sale_price",
                      "long_metrics.total_gross_margin",
                      "long_metrics.gross_margin_percentage",
                    ]),
                  ],
                  pivots: ["long_metrics.current_period"],
                  filters: {
                    "long_metrics.timeframe": povTimeframe,
                    "long_metrics.source_parameter": povSource,
                    ...(povYear !== "ALL" ? { "long_metrics.year": povYear } : {}),
                  },
                },
                parentIdsToFetch,
                pcConfig,
                20,
              );
              if (restored.rows.length > 0) {
                setOutlineRows((prev) => mergeOutlineRows(prev, restored.rows, pcConfig));
              }
              updateToast(toastId, {
                message: `Expanded ${labelList}.`,
                variant: "success",
                timeoutMs: 3000,
              });
            } catch (err: any) {
              updateToast(toastId, {
                message: `Expanded ${labelList} (cached outline).`,
                variant: "success",
                timeoutMs: 3000,
              });
            } finally {
              setIsBusy(false);
            }
          }
        } else if (!isParentChildMode && calcConfig.hierarchy?.length) {
          for (const pathStr of nextExpanded) {
            if (!fetchedMemberIdsRef.current.has(pathStr)) {
              fetchedMemberIdsRef.current.add(pathStr);
              await fetchChildHierarchySlice(
                core40SDK,
                {
                  model: calcConfig.model || "lookbase",
                  view: calcConfig.explore || "long_metrics",
                  fields: ["long_metrics.total_sale_price", "long_metrics.total_gross_margin"],
                },
                calcConfig.hierarchy,
                pathStr,
              );
            }
          }
        }
      }
    },
    [
      handleUpdateConfig,
      core40SDK,
      isParentChildMode,
      projectedOutline,
      calcConfig,
      pcConfig,
      povTimeframe,
      povSource,
      povYear,
      persistSavedExpansion,
      pushToast,
      updateToast,
    ],
  );

  // Handle cell click for Formula Bar + active green border + syncing Left-Hand Metric Pane
  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const td = target.closest("td") as HTMLTableCellElement | null;
      const tr = target.closest("tr") as HTMLTableRowElement | null;
      if (!td || !tr || !gridWrapperRef.current) return;

      gridWrapperRef.current
        .querySelectorAll("td.lookbase-active-cell")
        .forEach((el) => el.classList.remove("lookbase-active-cell"));
      td.classList.add("lookbase-active-cell");

      const rowIdx = tr.rowIndex || 1;
      const colIdx = td.cellIndex || 0;
      const colLetter = String.fromCharCode(65 + Math.min(25, colIdx));
      setActiveCellCoord(`${colLetter}${rowIdx}`);

      const rowPath = tr.getAttribute("data-subtotal-path") || "All Products";
      const node = projectedOutline?.pathToNode?.[rowPath];
      const memberId = node?.memberId || "ALL";
      setSelectedOutlineMemberId(memberId);

      const rawText = (td.textContent || "").replace(/[^\d.-]/g, "");
      const numericVal = parseFloat(rawText);

      if (td.classList.contains("dimension")) {
        const parentNode = node?.parentId ? projectedOutline?.memberIdToNode?.[node.parentId] : undefined;
        const pctOfParent =
          node && parentNode
            ? evaluateLookBaseFormula(
                "MEMBER('Total Sale Price') / NULLIF(PARENTVAL('Total Sale Price'), 0)",
                {
                  memberValues: {
                    "Total Sale Price":
                      node.rawRow?.["long_metrics.total_sale_price"]?.Current?.value ??
                      node.rawRow?.["long_metrics.total_sale_price"]?.value ??
                      0,
                  },
                  parentValues: {
                    "Total Sale Price":
                      parentNode.rawRow?.["long_metrics.total_sale_price"]?.Current?.value ??
                      parentNode.rawRow?.["long_metrics.total_sale_price"]?.value ??
                      0,
                  },
                },
              )
            : null;
        const pctTag =
          pctOfParent !== null ? ` /* % of Parent: ${formatLookBaseValue(pctOfParent, "0.0%")} */` : "";
        setFormulaText(
          `[Member] id="${memberId}" parent="${node?.parentId || "ROOT"}" path="${rowPath}"${pctTag}`,
        );
        setSelectedCellMeta(null);
      } else {
        setFormulaText(
          `=GETVALUE("Total Sale Price", "Current", "${povTimeframe}", "${pcConfig.memberIdField}=${memberId}")`,
        );
        if (Number.isFinite(numericVal)) {
          setSelectedCellMeta({
            memberId,
            path: rowPath,
            metric: "Total Sale Price",
            period: "Current",
            currentValue: numericVal,
          });
          setEditValueInput(String(numericVal));
        }
      }
    },
    [projectedOutline, povTimeframe, pcConfig.memberIdField],
  );

  // Double-clicking a subtotal row toggles Zoom In / Zoom Out
  const handleGridDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const tr = target.closest("tr.subtotal") as HTMLTableRowElement | null;
    if (!tr) return;
    const collapseIcon = tr.querySelector(".row-collapse-icon") as HTMLElement | null;
    if (collapseIcon) {
      collapseIcon.click();
    }
  }, []);

  const handlePovChange = useCallback(
    (
      nextVersion: string,
      nextTimeframe: string,
      nextSource: string,
      nextYear: string,
      changedField?: "source" | "timeframe",
    ) => {
      const aligned = normalizeSourceAndTimeframe(nextSource, nextTimeframe, changedField);
      setPovVersion(nextVersion);
      setPovTimeframe(aligned.timeframe);
      setPovSource(aligned.source);
      setPovYear(nextYear);
      saveUserPrefsArtifact(
        core40SDK,
        {
          pov: {
            version: nextVersion,
            timeframe: aligned.timeframe,
            source: aligned.source,
            year: nextYear,
          },
        },
        artifactNamespace,
      );
      if (tileSDK?.updateFilters) {
        applyFiltersToHost(tileSDK, {
          "long_metrics.timeframe": aligned.timeframe,
          "long_metrics.source_parameter": aligned.source,
          "long_metrics.year": nextYear,
        });
      } else {
        loadStandaloneOutline(
          nextVersion,
          aligned.timeframe,
          aligned.source,
          nextYear,
          savedExpandedMemberIds,
        );
      }
    },
    [tileSDK, loadStandaloneOutline, savedExpandedMemberIds, core40SDK, artifactNamespace],
  );

  const refreshBiEngineTables = useCallback(async () => {
    setIsDiscoveringBiTables(true);
    try {
      const discovered = await discoverBIEngineCandidateTables(
        core40SDK,
        calcConfig.model || "lookbase",
      );
      setBiEngineProjectId(discovered.projectId);
      setBiEngineTables(discovered.tables);
    } finally {
      setIsDiscoveringBiTables(false);
    }
  }, [core40SDK, calcConfig.model]);

  // On-demand Cube Rebuild (Calc All / Calc Measure PDT) + BI Engine Pinning
  const handleRebuildCube = useCallback(
    async (viewToRebuild?: string) => {
      if (!core40SDK) return;
      if (!canRebuildCube) {
        pushToast({
          message: "You do not have permission to rebuild the cube.",
          variant: "error",
          timeoutMs: 4000,
        });
        return;
      }
      const targetView = viewToRebuild || calcConfig.base_pdt_view || "long_metrics_base";
      setIsBusy(true);
      const toastId = pushToast({
        message: `Rebuilding PDT '${targetView}' (rebuild_pdts=true) & pinning to BI Engine...`,
        variant: "info",
        timeoutMs: null,
      });
      try {
        await rebuildCubePdt(core40SDK, {
          model: calcConfig.model || "lookbase",
          view: targetView,
        });
        await refreshBiEngineTables();
        updateToast(toastId, {
          message: `Cube '${targetView}' rebuilt & pinned to BI Engine.`,
          variant: "success",
          timeoutMs: 4000,
        });
        await loadStandaloneOutline();
      } catch (err: any) {
        updateToast(toastId, {
          message: `Rebuild notice: ${err?.message || "Completed"}`,
          variant: "error",
          timeoutMs: 6000,
        });
      } finally {
        setIsBusy(false);
      }
    },
    [
      core40SDK,
      canRebuildCube,
      calcConfig,
      loadStandaloneOutline,
      refreshBiEngineTables,
      pushToast,
      updateToast,
    ],
  );

  const handleOpenSettings = useCallback(() => {
    if (!canUpdateSettings) return;
    setSettingsDraft(appSettings);
    setSettingsGroupIdsInput(appSettings.settings_group_ids.join(", "));
    setSettingsUserIdsInput(appSettings.settings_user_ids.join(", "));
    setRebuildCubeGroupIdsInput(appSettings.rebuild_cube_group_ids.join(", "));
    setRebuildCubeUserIdsInput(appSettings.rebuild_cube_user_ids.join(", "));
    setSettingsFormError("");
    setIsSettingsModalOpen(true);
    refreshBiEngineTables();
  }, [canUpdateSettings, appSettings, refreshBiEngineTables]);

  const handleSaveSettings = useCallback(async () => {
    const parseCsv = (val: string) =>
      val
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    const candidate = normalizeLookBaseSettings({
      ...settingsDraft,
      settings_group_ids: parseCsv(settingsGroupIdsInput),
      settings_user_ids: parseCsv(settingsUserIdsInput),
      rebuild_cube_group_ids: parseCsv(rebuildCubeGroupIdsInput),
      rebuild_cube_user_ids: parseCsv(rebuildCubeUserIdsInput),
    });

    const validation = validateLookBaseSettings(candidate, currentUser);
    if (validation.settings_access_error) {
      setSettingsFormError(validation.settings_access_error);
      return;
    }

    setSettingsFormError("");
    setIsSavingSettings(true);
    const toastId = pushToast({
      message: "Saving configuration settings...",
      variant: "info",
      timeoutMs: null,
    });
    try {
      const saved = await saveLookBaseSettings(
        activeHost,
        core40SDK,
        candidate,
        currentUser,
        appSettings,
        artifactNamespace,
      );
      setAppSettings(saved);
      setSettingsDraft(saved);
      setIsSettingsModalOpen(false);
      updateToast(toastId, {
        message: "Configuration settings saved.",
        variant: "success",
        timeoutMs: 3500,
      });
    } catch (err: any) {
      const msg = err?.message || "Failed to save settings";
      setSettingsFormError(msg);
      updateToast(toastId, {
        message: `Settings error: ${msg}`,
        variant: "error",
        timeoutMs: 5000,
      });
    } finally {
      setIsSavingSettings(false);
    }
  }, [
    settingsDraft,
    settingsGroupIdsInput,
    settingsUserIdsInput,
    rebuildCubeGroupIdsInput,
    rebuildCubeUserIdsInput,
    currentUser,
    activeHost,
    core40SDK,
    appSettings,
    artifactNamespace,
    pushToast,
    updateToast,
  ]);

  useEffect(() => {
    activeHost?.updateTitle?.("");
  }, [activeHost]);

  const activeOutlineNode: OutlineNodeMeta | undefined =
    projectedOutline?.memberIdToNode?.[selectedOutlineMemberId] ||
    projectedOutline?.memberIdToNode?.["ALL"] ||
    loadedOutlineNodes[0];

  const parentOutlineNode: OutlineNodeMeta | undefined = activeOutlineNode?.parentId
    ? projectedOutline?.memberIdToNode?.[activeOutlineNode.parentId]
    : undefined;

  const configuredQuickStarts =
    calcConfig.quick_start_actions?.length
      ? calcConfig.quick_start_actions
      : DEFAULT_QUICK_START_ACTIONS;

  const visibleQuickStartActions = useMemo(
    () =>
      [...configuredQuickStarts, ...customQuickStartActions].filter(
        (a) => !dismissedQuickStartIds.includes(a.id),
      ),
    [configuredQuickStarts, customQuickStartActions, dismissedQuickStartIds],
  );

  const handleDismissQuickStartPill = useCallback(
    (actionId: string) => {
      if (actionId.startsWith("custom_qs_")) {
        setCustomQuickStartActions((prev) => {
          const next = prev.filter((a) => a.id !== actionId);
          saveUserPrefsArtifact(
            core40SDK,
            { customQuickStartActions: next },
            artifactNamespace,
          );
          return next;
        });
      } else {
        setDismissedQuickStartIds((prev) => {
          const next = Array.from(new Set([...prev, actionId]));
          saveUserPrefsArtifact(
            core40SDK,
            { dismissedQuickStartIds: next },
            artifactNamespace,
          );
          return next;
        });
      }
    },
    [core40SDK, artifactNamespace],
  );

  const handleSaveCustomQuickStart = useCallback(() => {
    const label = newQuickStartLabel.trim();
    if (!label) return;
    const newAction: QuickStartActionConfig = {
      id: `custom_qs_${Date.now()}`,
      label,
      params: {
        version: povVersion,
        timeframe: povTimeframe,
        source: povSource,
        year: povYear,
        member: selectedOutlineMemberId,
        expanded: savedExpandedMemberIds,
        metrics: leftMetricRows.map((r) => r.id),
        pane: showLeftMetricsPane,
        ...(editValueInput ? { edit: editValueInput } : {}),
      },
    };
    setCustomQuickStartActions((prev) => {
      const next = [...prev, newAction];
      saveUserPrefsArtifact(
        core40SDK,
        { customQuickStartActions: next },
        artifactNamespace,
      );
      return next;
    });
    setNewQuickStartLabel("");
    setIsAddingCustomQuickStart(false);
    pushToast({
      message: `Saved custom Quick-Start pill "${label}".`,
      variant: "success",
      timeoutMs: 3500,
    });
  }, [
    newQuickStartLabel,
    povVersion,
    povTimeframe,
    povSource,
    povYear,
    selectedOutlineMemberId,
    savedExpandedMemberIds,
    leftMetricRows,
    showLeftMetricsPane,
    editValueInput,
    core40SDK,
    artifactNamespace,
    pushToast,
  ]);

  return (
    <div className="lookbase-shell">
      {/* Top Ribbon */}
      <div className="lookbase-ribbon">
        <div className="lookbase-ribbon-left">
          <span id="lookbase-tour-brand" className="lookbase-brand">
            LookBase
          </span>
          <button
            className="lookbase-btn tour-btn"
            onClick={() => {
              setShowLeftMetricsPane(true);
              startLookBaseTour({
                core40SDK,
                namespace: artifactNamespace,
              });
            }}
            title="Start 8-step interactive Driver.js spotlight tour"
          >
            ? Guided Tour
          </button>
          <button
            className={`lookbase-btn ${showLeftMetricsPane ? "active-toggle" : ""}`}
            onClick={() => setShowLeftMetricsPane((v) => !v)}
            title="Toggle Left-Hand Side Metrics & Calculation Autocomplete Dock"
          >
            Metrics on Left (Autocomplete)
          </button>
          <button
            id="lookbase-tour-hierarchy-btn"
            className="lookbase-btn"
            onClick={() => setIsHierarchyModalOpen(true)}
            title="Open Jagged Hierarchy Subtree Filter (BigQuery WITH RECURSIVE CTE)"
          >
            Jagged Hierarchy Filter ({savedExpandedMemberIds.length} Saved)
          </button>
          <span id="lookbase-tour-actions" style={{ display: "inline-flex", gap: 6 }}>
            {canRebuildCube && (
              <>
                <button
                  className="lookbase-btn"
                  disabled={isBusy}
                  onClick={() => handleRebuildCube()}
                  title="Rebuild combined long_metrics_base PDT via run_inline_query(rebuild_pdts=true)"
                >
                  Calc All (Rebuild Cube)
                </button>
                <button
                  className="lookbase-btn"
                  disabled={isBusy}
                  onClick={() => handleRebuildCube("stacked_total_sale_price")}
                  title="Rebuild only the modular stacked_total_sale_price PDT"
                >
                  Calc Sales PDT
                </button>
              </>
            )}
            {canUpdateSettings && (
              <button
                id="lookbase-settings-btn"
                className="lookbase-btn"
                onClick={handleOpenSettings}
                title="Open LookBase Configuration Settings (Settings & Rebuild Cube Access Control + BI Engine Table List)"
              >
                ⚙ Settings
              </button>
            )}
          </span>
        </div>

        {/* Inline Top-Right POV Bar (Row 1 Slice Cells) */}
        <div id="lookbase-tour-pov" className="lookbase-ribbon-right">
          <span className="lookbase-pov-label">POV:</span>
          <div className="lookbase-pov-cell" title="Stacked Timeframe Slice">
            <span>Timeframe:</span>
            <select
              value={povTimeframe}
              onChange={(e) =>
                handlePovChange(povVersion, e.target.value, povSource, povYear, "timeframe")
              }
            >
              <option value="ytd">YTD</option>
              <option value="current_view">Current View</option>
              <option value="r7d">Rolling 7D</option>
              <option value="r28d">Rolling 28D</option>
              <option value="r90d">Rolling 90D</option>
              <option value="r3m">Rolling 3M</option>
              <option value="r12m">Rolling 12M</option>
            </select>
          </div>
          <div className="lookbase-pov-cell" title="Aggregation Grain">
            <span>Grain:</span>
            <select
              value={povSource}
              onChange={(e) =>
                handlePovChange(povVersion, povTimeframe, e.target.value, povYear, "source")
              }
            >
              <option value="Daily Actual">Daily Actual</option>
              <option value="Monthly Actual">Monthly Actual</option>
              <option value="Quarterly Actual">Quarterly Actual</option>
            </select>
          </div>
          <div className="lookbase-pov-cell" title="Year Slice">
            <span>Year:</span>
            <select
              value={povYear}
              onChange={(e) => handlePovChange(povVersion, povTimeframe, povSource, e.target.value)}
            >
              <option value="ALL">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Configurable & Individually Dismissible Quick-Start Guide Strip */}
      {showQuickStartBar && (
        <div className="lookbase-quickstart-bar">
          <div className="lookbase-quickstart-steps">
            <strong style={{ color: "#1e3a8a" }}>Quick-Start Actions:</strong>
            {visibleQuickStartActions.map((action) => (
              <span key={action.id} className="lookbase-step-pill-wrap">
                <button
                  className="lookbase-step-pill"
                  onClick={() => applyUrlState(action.params)}
                  title={`Apply preset: ?${serializeLookBaseUrlState(action.params)}`}
                >
                  {action.label}
                </button>
                <button
                  className="lookbase-step-pill-dismiss"
                  onClick={() => handleDismissQuickStartPill(action.id)}
                  title="Dismiss this Quick-Start pill"
                >
                  ×
                </button>
              </span>
            ))}

            {isAddingCustomQuickStart ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <input
                  style={{
                    height: 20,
                    fontSize: 11,
                    padding: "0 6px",
                    border: "1px solid #2563eb",
                    borderRadius: 3,
                  }}
                  value={newQuickStartLabel}
                  onChange={(e) => setNewQuickStartLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveCustomQuickStart();
                    else if (e.key === "Escape") setIsAddingCustomQuickStart(false);
                  }}
                  placeholder="Label for current view..."
                  autoFocus
                />
                <button className="lookbase-btn primary" onClick={handleSaveCustomQuickStart}>
                  Save
                </button>
                <button
                  className="lookbase-btn"
                  onClick={() => setIsAddingCustomQuickStart(false)}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                className="lookbase-btn"
                onClick={() => setIsAddingCustomQuickStart(true)}
                title="Save current POV, expanded hierarchy branches, and left-hand metrics as a personal Quick-Start pill"
              >
                + Save Current View
              </button>
            )}

            {dismissedQuickStartIds.length > 0 && (
              <button
                className="lookbase-btn"
                onClick={() => applyUrlState({ quickstart: "reset" }, false)}
                title="Restore individually dismissed default Quick-Start pills"
              >
                Restore Pills ({dismissedQuickStartIds.length})
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              className="lookbase-btn tour-btn"
              onClick={() => {
                setShowLeftMetricsPane(true);
                startLookBaseTour({
                  core40SDK,
                  namespace: artifactNamespace,
                });
              }}
            >
              Launch Step-by-Step Tour
            </button>
            <button
              className="lookbase-btn"
              onClick={() => {
                setShowQuickStartBar(false);
                saveUserPrefsArtifact(
                  core40SDK,
                  { quickStartDismissed: true },
                  artifactNamespace,
                );
              }}
              title="Hide Quick-Start bar (re-open anytime with ?quickstart=1)"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Formula Bar */}
      <div id="lookbase-tour-formula-bar" className="lookbase-formula-bar">
        <div className="lookbase-cell-coord">{activeCellCoord}</div>
        <div className="lookbase-fx-badge">fx</div>
        <input
          className="lookbase-formula-input"
          value={formulaText}
          onChange={(e) => setFormulaText(e.target.value)}
          readOnly={false}
        />
      </div>

      {/* Main Split Workspace: Left-Hand Side Metrics/Calculation Autocomplete + Right Outline Grid */}
      <div className="lookbase-workspace">
        {showLeftMetricsPane && (
          <div className="lookbase-left-metrics-pane">
            <div className="lookbase-left-pane-header">
              <span>
                Metrics & Calculations ({activeOutlineNode?.label || "All Products"})
              </span>
              <span style={{ fontSize: 10, color: "#1e3a8a" }}>
                L{activeOutlineNode?.level ?? 0} · {selectedOutlineMemberId}
              </span>
            </div>

            {/* Inline Autocomplete Combobox for Measures, 2-Pass Calcs, Variances & Custom Formulas */}
            <div id="lookbase-tour-autocomplete" className="lookbase-autocomplete-wrap">
              <input
                ref={autocompleteInputRef}
                className="lookbase-autocomplete-input"
                value={leftMetricQuery}
                onFocus={() => setIsAutocompleteOpen(true)}
                onClick={() => setIsAutocompleteOpen(true)}
                onChange={(e) => {
                  setLeftMetricQuery(e.target.value);
                  setIsAutocompleteOpen(true);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleAutocompleteKeyDown}
                placeholder={
                  replacingRowId
                    ? "Type replacement measure, calc, or =formula..."
                    : "+ Type measure, 2-pass calc, member, or =formula..."
                }
                aria-label="Search or add LookML measure or LookBase calculation"
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginTop: 4,
                  fontSize: 11,
                  color: "#334155",
                }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#1e3a8a" }}>Include Members:</span>
                  {availableMemberLevels.map((lvl) => {
                    const isChecked = autocompleteMemberLevels.includes(lvl);
                    return (
                      <label
                        key={`ac-lvl-${lvl}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          cursor: "pointer",
                          fontWeight: isChecked ? 700 : 500,
                        }}
                      >
                        <input
                          type="checkbox"
                          data-testid={`autocomplete-level-L${lvl}`}
                          checked={isChecked}
                          onChange={() => {
                            setIsAutocompleteOpen(true);
                            setAutocompleteScrollTop(0);
                            setAutocompleteMemberLevels((prev) =>
                              prev.includes(lvl)
                                ? prev.filter((x) => x !== lvl)
                                : [...prev, lvl].sort((a, b) => a - b),
                            );
                          }}
                        />
                        <span>L{lvl}</span>
                      </label>
                    );
                  })}
                </div>
                <span style={{ fontSize: 10, color: "#64748b" }}>
                  {autocompleteMatches.length} item{autocompleteMatches.length === 1 ? "" : "s"}
                </span>
              </div>
              {isAutocompleteOpen && autocompleteMatches.length > 0 && (() => {
                const ROW_HEIGHT = 48;
                const vWin = getVirtualizedAutocompleteWindow(
                  autocompleteMatches.length,
                  autocompleteScrollTop,
                  320,
                  ROW_HEIGHT,
                  5,
                );
                const visibleSlice = autocompleteMatches.slice(vWin.startIndex, vWin.endIndex);
                return (
                  <div
                    className="lookbase-autocomplete-dropdown"
                    role="listbox"
                    data-testid="autocomplete-virtual-listbox"
                    onScroll={(e) => setAutocompleteScrollTop(e.currentTarget.scrollTop)}
                  >
                    <div
                      style={{
                        height: vWin.totalHeight,
                        position: "relative",
                      }}
                    >
                      {visibleSlice.map((item, sliceIdx) => {
                        const idx = vWin.startIndex + sliceIdx;
                        return (
                          <div
                            key={item.id}
                            role="option"
                            aria-selected={idx === highlightedIndex}
                            className={`lookbase-autocomplete-option ${idx === highlightedIndex ? "highlighted" : ""}`}
                            style={{
                              position: "absolute",
                              top: idx * ROW_HEIGHT,
                              left: 0,
                              right: 0,
                              height: ROW_HEIGHT,
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectAutocompleteItem(item);
                            }}
                          >
                            <div className="lookbase-autocomplete-option-top">
                              <span className="lookbase-autocomplete-option-label">{item.label}</span>
                              <span className={`lookbase-cat-badge ${item.category}`}>
                                {item.category.replace(/_/g, " ")}
                              </span>
                            </div>
                            {item.description && (
                              <div className="lookbase-autocomplete-option-desc">{item.description}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Left-Hand Side Metrics Down Rows Table */}
            <div
              id="lookbase-tour-left-table"
              className="lookbase-left-metrics-table-wrap"
              onClick={() => setIsAutocompleteOpen(false)}
            >
              <table className="lookbase-left-metrics-table">
                <thead>
                  <tr>
                    <th>Metric / Account (Col A)</th>
                    <th>Current</th>
                    <th>Last Year</th>
                    <th>YoY Var %</th>
                  </tr>
                </thead>
                <tbody>
                  {leftMetricRows.map((mRow, idx) => {
                    const curEval = evaluateLeftHandMetricRow(
                      mRow,
                      activeOutlineNode,
                      parentOutlineNode,
                      "Current",
                      calcConfig,
                    );
                    const lyEval = evaluateLeftHandMetricRow(
                      mRow,
                      activeOutlineNode,
                      parentOutlineNode,
                      "Last Year",
                      calcConfig,
                    );
                    const yoyPct =
                      curEval.value !== null && lyEval.value !== null && lyEval.value !== 0
                        ? (curEval.value - lyEval.value) / Math.abs(lyEval.value)
                        : null;
                    const isRowActive = activeMetricRowId === mRow.id;
                    return (
                      <tr
                        key={mRow.id}
                        className={isRowActive ? "active-metric-row" : ""}
                        onClick={() => {
                          setActiveMetricRowId(mRow.id);
                          setActiveCellCoord(`A${idx + 2}`);
                          setFormulaText(`=${mRow.formula || mRow.label}`);
                        }}
                      >
                        <td
                          className="metric-row-header"
                          title="Click to inspect formula, or click Swap to replace via autocomplete"
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 4,
                            }}
                          >
                            <span>{mRow.label}</span>
                            <span style={{ display: "inline-flex", gap: 3 }}>
                              <button
                                style={{
                                  border: "1px solid #94a3b8",
                                  background: "#f8fafc",
                                  fontSize: 9,
                                  cursor: "pointer",
                                  padding: "0 3px",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReplacingRowId(mRow.id);
                                  setIsAutocompleteOpen(true);
                                  autocompleteInputRef.current?.focus();
                                }}
                                title="Replace this metric row using autocomplete"
                              >
                                ⇄
                              </button>
                              <button
                                style={{
                                  border: "1px solid #cbd5e1",
                                  background: "#fff",
                                  fontSize: 9,
                                  cursor: "pointer",
                                  padding: "0 3px",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateAndPersistLeftMetrics((prev) =>
                                    prev.filter((r) => r.id !== mRow.id),
                                  );
                                }}
                                title="Remove metric row"
                              >
                                ×
                              </button>
                            </span>
                          </div>
                        </td>
                        <td>{curEval.formatted}</td>
                        <td>{lyEval.formatted}</td>
                        <td
                          style={{
                            color:
                              yoyPct === null ? "#64748b" : yoyPct >= 0 ? "#166534" : "#b91c1c",
                            fontWeight: 600,
                          }}
                        >
                          {yoyPct !== null ? formatLookBaseValue(yoyPct, "+0.0%;-0.0%;0.0%") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Core viz-report-table Grid Wrapper */}
        <div
          id="lookbase-tour-grid"
          ref={gridWrapperRef}
          className="lookbase-grid-area"
          onClick={handleGridClick}
          onDoubleClick={handleGridDoubleClick}
        >
          {effectiveQueryResponse && artifactLoaded ? (
            <ReportTable
              data={effectiveQueryResponse.data || []}
              queryResponse={effectiveQueryResponse}
              config={reportTableConfig}
              updateConfig={handleLookBaseUpdateConfig}
              onDone={() => {
                syncCollapsedRowsDom();
                activeHost?.rendered?.();
              }}
            />
          ) : (
            <div style={{ padding: 16, color: "#475569" }}>
              {isBusy
                ? "Loading LookBase OLAP Cube..."
                : "Select an Explore query or wait for cube initialization."}
            </div>
          )}
        </div>
      </div>

      {/* Jagged Hierarchy Subtree Filter Modal (BigQuery WITH RECURSIVE CTE + Saved Batch Expansion) */}
      {isHierarchyModalOpen && (
        <div
          className="lookbase-modal-backdrop"
          onClick={() => setIsHierarchyModalOpen(false)}
        >
          <div className="lookbase-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lookbase-modal-header">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                  Jagged Product / Organization Hierarchy (WITH RECURSIVE CTE)
                </div>
                <div style={{ fontSize: 11, color: "#475569" }}>
                  Full catalog loaded:{" "}
                  <strong>
                    {allHierarchyNodes.filter((n) => n.level === 2).length} Categories ·{" "}
                    {allHierarchyNodes.filter((n) => n.isLeaf).length} Brands
                  </strong>{" "}
                  ({allHierarchyNodes.length} total nodes)
                </div>
              </div>
              <button
                className="lookbase-btn"
                onClick={() => setIsHierarchyModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="lookbase-modal-body">
              <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                <input
                  className="lookbase-autocomplete-input"
                  value={hierarchyFilterSearch}
                  onChange={(e) => setHierarchyFilterSearch(e.target.value)}
                  placeholder="Filter all categories & brands (e.g. Men, Outerwear, Levi's, Nike)..."
                />
                <button
                  className="lookbase-btn"
                  title="Select all branches across the entire hierarchy"
                  onClick={() => {
                    const allNonLeafIds = allHierarchyNodes
                      .filter((n) => !n.isLeaf)
                      .map((n) => n.memberId);
                    const nextIds = Array.from(new Set(["ROOT", "ALL", ...allNonLeafIds]));
                    const nextPaths = deriveExpandedPathsFromMemberIds(
                      nextIds,
                      allHierarchyNodeMap,
                    );
                    persistSavedExpansion(nextIds, nextPaths);
                    setExpandedPaths(nextPaths);
                  }}
                >
                  Select All
                </button>
                <button
                  className="lookbase-btn"
                  title="Select default L0-L1 branches (Some)"
                  onClick={() => {
                    const initIds =
                      calcConfig.initial_state?.expanded_member_ids || [
                        "ROOT",
                        "ALL",
                        "DEPT:Men",
                        "DEPT:Women",
                      ];
                    const initPaths = deriveExpandedPathsFromMemberIds(
                      initIds,
                      allHierarchyNodeMap,
                      calcConfig.initial_state?.expanded_paths || ["All Products", "All Products|Men"],
                    );
                    persistSavedExpansion(initIds, initPaths);
                    setExpandedPaths(initPaths);
                  }}
                >
                  Select Some
                </button>
                <button
                  className="lookbase-btn"
                  title="Collapse all branches (Select None)"
                  onClick={() => {
                    const nextIds = ["ROOT"];
                    const nextPaths: string[] = [];
                    persistSavedExpansion(nextIds, nextPaths);
                    setExpandedPaths(nextPaths);
                  }}
                >
                  Select None
                </button>
              </div>
              <div
                data-testid="hierarchy-modal-scroll"
                style={{
                  maxHeight: 340,
                  overflowY: "auto",
                  border: "1px solid #cbd5e1",
                  position: "relative",
                }}
              >
                {(() => {
                  const visibleNodes = getVisibleHierarchyModalNodes(
                    allHierarchyNodes,
                    modalUnfoldedIds,
                    hierarchyFilterSearch,
                  );
                  const childrenByParent: Record<string, OutlineNodeMeta[]> = {};
                  const roots: OutlineNodeMeta[] = [];

                  for (const n of visibleNodes) {
                    if (n.level === 0 || n.parentId === "ROOT") {
                      roots.push(n);
                    } else {
                      if (!childrenByParent[n.parentId]) {
                        childrenByParent[n.parentId] = [];
                      }
                      childrenByParent[n.parentId].push(n);
                    }
                  }

                  const renderRow = (node: OutlineNodeMeta) => {
                    const triState = getHierarchyNodeTriState(
                      node,
                      allHierarchyNodes,
                      savedExpandedMemberIds,
                    );
                    const stickyStyle = getHierarchyRowStickyStyle(node.level, 30);
                    const isUnfolded =
                      Boolean(hierarchyFilterSearch.trim()) ||
                      modalUnfoldedIds.includes(node.memberId);
                    const isLoadingChildren = modalLoadingParentIds.includes(node.memberId);

                    return (
                      <div
                        key={`row:${node.memberId}`}
                        data-tree-row={node.memberId}
                        data-level={node.level}
                        style={{
                          ...stickyStyle,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0 8px",
                          paddingLeft: 8 + getOutlineIndentationPx(node.level, 16),
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {!node.isLeaf ? (
                            <button
                              type="button"
                              data-tree-chevron={node.memberId}
                              onClick={() => handleToggleModalUnfold(node)}
                              style={{
                                width: 18,
                                height: 18,
                                padding: 0,
                                border: "1px solid #cbd5e1",
                                borderRadius: 3,
                                background: isUnfolded ? "#eff6ff" : "#ffffff",
                                color: "#334155",
                                fontSize: 10,
                                lineHeight: "16px",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              title={isUnfolded ? `Collapse ${node.label}` : `Expand ${node.label}`}
                            >
                              {isLoadingChildren ? "…" : isUnfolded ? "▾" : "▸"}
                            </button>
                          ) : (
                            <span style={{ width: 18, display: "inline-block" }} />
                          )}
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              cursor: "pointer",
                            }}
                            title={
                              node.isLeaf
                                ? `Toggle ${node.label}`
                                : `Click to cycle selection for ${node.label}`
                            }
                          >
                            <input
                              type="checkbox"
                              data-tree-checkbox={node.memberId}
                              checked={triState === "all"}
                              ref={(el) => {
                                if (el) {
                                  el.indeterminate = triState === "some";
                                }
                              }}
                              onChange={() => {
                                const nextIds = toggleHierarchyNodeTriState(
                                  node,
                                  allHierarchyNodes,
                                  savedExpandedMemberIds,
                                );
                                const nextPaths = deriveExpandedPathsFromMemberIds(
                                  nextIds,
                                  allHierarchyNodeMap,
                                );
                                persistSavedExpansion(nextIds, nextPaths);
                                setExpandedPaths(nextPaths);
                              }}
                            />
                            <span style={{ fontWeight: node.isLeaf ? 400 : 600 }}>
                              {node.label}
                            </span>
                          </label>
                        </div>
                        <span style={{ fontSize: 10, color: "#64748b" }}>{node.memberId}</span>
                      </div>
                    );
                  };

                  const renderBranch = (node: OutlineNodeMeta): React.ReactNode => {
                    const visibleChildren = childrenByParent[node.memberId] || [];
                    if (node.isLeaf || visibleChildren.length === 0) {
                      return renderRow(node);
                    }
                    return (
                      <div
                        key={`branch:${node.memberId}`}
                        data-tree-branch={node.memberId}
                        data-level={node.level}
                      >
                        {renderRow(node)}
                        <div data-tree-children={node.memberId}>
                          {visibleChildren.map((child) => renderBranch(child))}
                        </div>
                      </div>
                    );
                  };

                  return roots.length > 0
                    ? roots.map((r) => renderBranch(r))
                    : visibleNodes.map((n) => renderRow(n));
                })()}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 10,
                }}
              >
                <span style={{ fontSize: 11, color: "#475569" }}>
                  Saved expanded parent IDs: <strong>{savedExpandedMemberIds.join(", ")}</strong>
                </span>
                <button
                  className="lookbase-btn primary"
                  onClick={() => {
                    setIsHierarchyModalOpen(false);
                    loadStandaloneOutline(
                      povVersion,
                      povTimeframe,
                      povSource,
                      povYear,
                      savedExpandedMemberIds,
                    );
                  }}
                >
                  Run Consolidated Batch Query Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Settings Modal (lkrdev/explore-blending pattern: Settings Access + Rebuild Cube Access) */}
      {isSettingsModalOpen && canUpdateSettings && (
        <div
          className="lookbase-modal-backdrop"
          onClick={() => setIsSettingsModalOpen(false)}
        >
          <div
            className="lookbase-modal"
            style={{ maxWidth: 620 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lookbase-modal-header">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                  Configuration Settings
                </div>
                <div style={{ fontSize: 11, color: "#475569" }}>
                  Manage who can edit LookBase Configuration Settings and who can trigger Rebuild Cube.
                </div>
              </div>
              <button
                className="lookbase-btn"
                onClick={() => setIsSettingsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="lookbase-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Current User Identity & Group Membership Helper Banner */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  padding: "8px 10px",
                  fontSize: 11,
                  color: "#334155",
                }}
              >
                <div>
                  <strong>Current User:</strong>{" "}
                  {currentUser?.display_name || currentUser?.email || "Authenticated User"}{" "}
                  (ID: <code>{currentUser?.id != null ? String(currentUser.id) : "N/A"}</code>
                  {currentUser?.email ? `, Email: ${currentUser.email}` : ""})
                </div>
                <div style={{ marginTop: 3 }}>
                  <strong>Role:</strong>{" "}
                  <span
                    style={{
                      fontWeight: 600,
                      color: isCurrentUserAdmin ? "#15803d" : "#475569",
                    }}
                  >
                    {isCurrentUserAdmin ? "Looker Admin (Role ID 2)" : "Standard User"}
                  </span>{" "}
                  · <strong>Your Group IDs:</strong>{" "}
                  <code>
                    {currentUser?.group_ids?.length
                      ? currentUser.group_ids.join(", ")
                      : "None"}
                  </code>
                </div>
              </div>

              {/* Section 1: Who Can Edit Settings */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 4,
                  padding: 12,
                  background: "#ffffff",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a", marginBottom: 6 }}>
                  1. Settings Access Control (Who Can Edit Settings)
                </div>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={settingsDraft.restrict_settings}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        restrict_settings: e.target.checked,
                      }))
                    }
                  />
                  <span>Restrict Settings Access</span>
                </label>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  When enabled, only Looker Admins (Role ID 2), users in the specified Group IDs, or
                  specified User IDs / Emails can access and save Configuration Settings.
                </div>

                {settingsDraft.restrict_settings && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#334155",
                          marginBottom: 3,
                        }}
                      >
                        Allowed Group IDs (comma-separated)
                      </label>
                      <input
                        className="lookbase-autocomplete-input"
                        value={settingsGroupIdsInput}
                        onChange={(e) => setSettingsGroupIdsInput(e.target.value)}
                        placeholder="e.g., 1, 2, 3"
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#334155",
                          marginBottom: 3,
                        }}
                      >
                        Allowed User IDs or Emails (comma-separated)
                      </label>
                      <input
                        className="lookbase-autocomplete-input"
                        value={settingsUserIdsInput}
                        onChange={(e) => setSettingsUserIdsInput(e.target.value)}
                        placeholder="e.g., 42, planner@company.com"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Who Can Rebuild Cube */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 4,
                  padding: 12,
                  background: "#ffffff",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a", marginBottom: 6 }}>
                  2. Rebuild Cube Access Control (Who Can Rebuild Cube)
                </div>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={settingsDraft.restrict_rebuild_cube}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        restrict_rebuild_cube: e.target.checked,
                      }))
                    }
                  />
                  <span>Restrict Rebuild Cube Access</span>
                </label>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  When enabled, only Looker Admins (Role ID 2), users in the specified Group IDs, or
                  specified User IDs / Emails can see and trigger <strong>Calc All (Rebuild Cube)</strong>{" "}
                  and <strong>Calc Sales PDT</strong>.
                </div>

                {settingsDraft.restrict_rebuild_cube && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#334155",
                          marginBottom: 3,
                        }}
                      >
                        Allowed Group IDs for Rebuild Cube (comma-separated)
                      </label>
                      <input
                        className="lookbase-autocomplete-input"
                        value={rebuildCubeGroupIdsInput}
                        onChange={(e) => setRebuildCubeGroupIdsInput(e.target.value)}
                        placeholder="e.g., 1, 2, 3"
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#334155",
                          marginBottom: 3,
                        }}
                      >
                        Allowed User IDs or Emails for Rebuild Cube (comma-separated)
                      </label>
                      <input
                        className="lookbase-autocomplete-input"
                        value={rebuildCubeUserIdsInput}
                        onChange={(e) => setRebuildCubeUserIdsInput(e.target.value)}
                        placeholder="e.g., 42, fpa-lead@company.com"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: BigQuery BI Engine Pinning — List All Candidate Shared Tables */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 4,
                  padding: 12,
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>
                      3. BigQuery BI Engine Pinning (<code>ALTER BI_CAPACITY</code>)
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      All shared LookBase PDT tables listed below are pinned to BigQuery BI Engine
                      memory when the base cube is built or rebuilt.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="lookbase-btn"
                    disabled={isDiscoveringBiTables}
                    onClick={refreshBiEngineTables}
                  >
                    {isDiscoveringBiTables ? "Refreshing..." : "Refresh Table List"}
                  </button>
                </div>

                <div
                  style={{
                    maxHeight: 150,
                    overflowY: "auto",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#f8fafc",
                    padding: 6,
                    fontSize: 11,
                  }}
                >
                  {biEngineTables.map((tbl, idx) => (
                    <div
                      key={tbl.viewName}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "3px 4px",
                        borderBottom:
                          idx < biEngineTables.length - 1 ? "1px solid #e2e8f0" : "none",
                      }}
                    >
                      <span>
                        <strong>{tbl.viewName}</strong>{" "}
                        <span style={{ color: "#64748b" }}>({tbl.label})</span>
                      </span>
                      <code style={{ fontSize: 10, color: "#0f172a" }}>{tbl.datasetTable}</code>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 3,
                    }}
                  >
                    Generated BigQuery DDL (<code>preferred_tables</code>):
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: "6px 8px",
                      fontSize: 10,
                      background: "#0f172a",
                      color: "#f8fafc",
                      borderRadius: 4,
                      overflowX: "auto",
                      maxHeight: 110,
                    }}
                  >
                    {buildAlterBiCapacitySql(biEngineProjectId, biEngineTables, "us")}
                  </pre>
                </div>

                {canRebuildCube && (
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="lookbase-btn"
                      disabled={isBusy}
                      onClick={() => handleRebuildCube("long_metrics_base")}
                    >
                      Rebuild Base Cube &amp; Pin All Listed Tables to BI Engine
                    </button>
                  </div>
                )}
              </div>

              {settingsFormError && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    borderRadius: 4,
                    padding: "8px 10px",
                    fontSize: 11,
                  }}
                >
                  {settingsFormError}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <button
                  className="lookbase-btn"
                  disabled={isSavingSettings}
                  onClick={() => setIsSettingsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="lookbase-btn primary"
                  disabled={isSavingSettings}
                  onClick={handleSaveSettings}
                >
                  {isSavingSettings ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stacked Bottom-Right Stateful Toast Container (lookbase-toasts skill) */}
      {toasts.length > 0 && (
        <div
          id="lookbase-toast-stack"
          className="lookbase-toast-stack"
          role="status"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div key={t.id} className={`lookbase-toast ${t.variant}`}>
              <span className="lookbase-toast-left">
                {t.variant === "info" && <span className="lookbase-toast-spinner" />}
                {t.variant === "success" && <span aria-hidden="true">✓</span>}
                {t.variant === "error" && <span aria-hidden="true">⚠</span>}
                <span>{t.message}</span>
              </span>
              <button
                type="button"
                className="lookbase-toast-close"
                onClick={() => dismissToast(t.id)}
                title="Dismiss notification"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
