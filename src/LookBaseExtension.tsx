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
  BUILTIN_HIERARCHY_CATALOG,
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
  discoverHierarchiesFromExplore,
  escapeLookerFilterValue,
  evaluateLookBaseFormula,
  evaluateLeftHandMetricRow,
  fetchChildHierarchySlice,
  fetchFullHierarchyCatalog,
  fetchHierarchiesFromLookmlOutline,
  fetchHierarchyModalChildren,
  formatLookBaseValue,
  formatMonthYearLabel,
  formatTimeframeLabel,
  formatTimeframeShortLabel,
  getHierarchyNodeTriState,
  getHierarchyRowStickyStyle,
  getOutlineIndentationPx,
  getStarterHierarchyNodesForId,
  getStarterOutlineForConfig,
  getVirtualizedAutocompleteWindow,
  getVisibleHierarchyModalNodes,
  isCustomCalculationsConfig,
  isLookerAdminUser,
  loadProjectCalculations,
  LOOKBASE_SHARED_PDT_CATALOG,
  LOOKBASE_TIMEFRAME_OPTIONS,
  LookBaseCurrentUser,
  LookBaseHierarchyDef,
  LookBaseMeasureDef,
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
  resolveHierarchyDiscoverySource,
  resolveInitialLeftHandMetrics,
  restoreSavedOutlineExpansion,
  searchAutocompleteItems,
  serializeLookBaseUrlState,
  sortOutlineNodesTreeOrder,
  STARTER_HIERARCHY_CATALOG_NODES,
  STARTER_OUTLINE_QUERY_RESPONSE,
  toggleHierarchyNodeTriState,
  validateLookBaseSettings,
  withSdkTimeout,
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
import { LookBaseHeaderBars } from "./LookBaseHeaderBars";
import { LookBaseHierarchyModal } from "./LookBaseHierarchyModal";
import { LookBaseLeftMetricsPane } from "./LookBaseLeftMetricsPane";
import { LookBaseSettingsModal } from "./LookBaseSettingsModal";
import {
  LookBaseToast,
  LookBaseToastStack,
  ToastVariant,
  useLookBaseToasts,
} from "./lookbaseToasts";

export type { LookBaseToast, ToastVariant };

const SAVED_EXPANSION_STORAGE_KEY = "lookbase_saved_expanded_member_ids";
const SAVED_PATHS_STORAGE_KEY = "lookbase_saved_expanded_paths";
const MAX_PERSISTED_EXPANDED_MEMBER_IDS = 60;

const LOOKBASE_DEFAULT_VIS_CONFIG: VisConfig = {
  theme: "custom",
  customTheme: "",
  exposeDownloadLink: true,
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
  allowUserEdits: false,
  allowUserFilters: false,
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

  // Initialize immediately with STARTER_OUTLINE_QUERY_RESPONSE only when running in standalone/test mode (`host` provided);
  // when running inside a live Looker iframe (`!host`), wait for `loadProjectCalculations` so customer projects never flash default eCommerce nodes
  const [outlineRows, setOutlineRows] = useState<Record<string, any>[]>(() =>
    host ? STARTER_OUTLINE_QUERY_RESPONSE.data : [],
  );
  const [standaloneQueryResponse, setStandaloneQueryResponse] = useState<QueryResponse | undefined>(
    () => (host ? (STARTER_OUTLINE_QUERY_RESPONSE as QueryResponse) : undefined),
  );
  const [initialQueryResolved, setInitialQueryResolved] = useState<boolean>(() =>
    Boolean(host && typeof (host as any).invokeCoreSdk !== "function"),
  );
  const [savedExpandedMemberIds, setSavedExpandedMemberIds] = useState<string[]>(
    initialUrlState.expanded?.length
      ? initialUrlState.expanded
      : host
        ? defaultInit.expanded_member_ids || ["ROOT", "ALL", "DEPT:Men", "DEPT:Women"]
        : ["ROOT", "ALL"],
  );
  const [expandedPaths, setExpandedPaths] = useState<string[]>(
    host ? defaultInit.expanded_paths || ["All Products", "All Products|Men"] : [],
  );
  const fetchedMemberIdsRef = useRef<Set<string>>(
    new Set(
      host
        ? [
            "ROOT",
            "ALL",
            "DEPT:Men",
            "DEPT:Women",
            "CAT:Men|Jeans",
            "CAT:Men|Outerwear & Coats",
            "CAT:Women|Dresses",
            "CAT:Women|Active",
          ]
        : ["ROOT", "ALL"],
    ),
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
    initialUrlState.year || defaultInit.available_years?.[0] || defaultInit.year || "2026-09",
  );
  const [availableYears, setAvailableYears] = useState<string[]>(
    defaultInit.available_years || [
      "2026-09",
      "2026-08",
      "2026-07",
      "2026-06",
      "2026-05",
      "2026-04",
      "2026-03",
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
      "2025-10",
      "2025-09",
      "2025-08",
      "2025-07",
      "2025-06",
      "2025-05",
      "2025-04",
      "2025-03",
      "2025-02",
      "2025-01",
      "2024-12",
      "2024-11",
      "2024-10",
      "2024-09",
      "2024-08",
      "2024-07",
      "2024-06",
      "2024-05",
      "2024-04",
    ],
  );

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
    host
      ? resolveInitialLeftHandMetrics(
          DEFAULT_CALCULATIONS_CONFIG,
          buildAutocompleteCatalog(DEFAULT_CALCULATIONS_CONFIG),
          initialUrlState.metrics,
        )
      : [],
  );

  // Hierarchy Selector & Multi-Timeframe POV state
  const [availableHierarchies, setAvailableHierarchies] = useState<LookBaseHierarchyDef[]>(() =>
    host ? BUILTIN_HIERARCHY_CATALOG : [],
  );
  const [enabledHierarchyIds, setEnabledHierarchyIds] = useState<string[]>(() =>
    host
      ? defaultInit.enabled_hierarchies || [
          BUILTIN_HIERARCHY_CATALOG[0]?.id || "product",
        ]
      : [],
  );
  const [activeHierarchyId, setActiveHierarchyId] = useState<string>(
    initialUrlState.hierarchy ||
      defaultInit.default_hierarchy ||
      BUILTIN_HIERARCHY_CATALOG[0]?.id ||
      "product",
  );
  const [exploreHierarchyToAdd, setExploreHierarchyToAdd] = useState<string>(
    BUILTIN_HIERARCHY_CATALOG[1]?.id || "department",
  );
  const [isTimeframeDropdownOpen, setIsTimeframeDropdownOpen] = useState<boolean>(false);
  const [isMeasuresDropdownOpen, setIsMeasuresDropdownOpen] = useState<boolean>(false);
  const [selectedGridMeasureIds, setSelectedGridMeasureIds] = useState<string[]>(() =>
    host
      ? defaultInit.grid_measures || [
          "long_metrics.total_sale_price",
          "long_metrics.total_gross_margin",
          "long_metrics.gross_margin_percentage",
        ]
      : [],
  );
  const [leftPaneTimeframe, setLeftPaneTimeframe] = useState<string>("");

  // Jagged Hierarchy Subtree Modal state (defaults to folded L1: only "ALL" unfolded so L1 branches are visible)
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState<boolean>(
    initialUrlState.modal === "hierarchy",
  );
  const [hierarchyFilterSearch, setHierarchyFilterSearch] = useState<string>("");
  const [hierarchyCatalogNodes, setHierarchyCatalogNodes] = useState<OutlineNodeMeta[]>(() =>
    host
      ? getStarterHierarchyNodesForId(
          initialUrlState.hierarchy ||
            defaultInit.default_hierarchy ||
            BUILTIN_HIERARCHY_CATALOG[0]?.id ||
            "product",
        )
      : [],
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

  // Formula bar state
  const [activeCellCoord, setActiveCellCoord] = useState<string>("A1");
  const [formulaText, setFormulaText] = useState<string>(
    '=GETVALUE("Total Sale Price", "Current", "ytd", "ALL")',
  );
  const [editValueInput, setEditValueInput] = useState<string>(initialUrlState.edit || "");
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Stacked Bottom-Right Stateful Toasts (lookbase-toasts skill)
  const { toasts, pushToast, updateToast, dismissToast } = useLookBaseToasts();

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
      chattyTimeout: 30000,
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
  const hostProjectId = useMemo(
    () =>
      activeHost?.lookerHostData?.extensionId?.split("::")?.[0] ||
      DEFAULT_CALCULATIONS_CONFIG.model ||
      "lookbase",
    [activeHost],
  );
  const resolveEffectiveModel = useCallback(
    (cfg: CalculationsConfig) =>
      isCustomCalculationsConfig(cfg)
        ? cfg.model || hostProjectId
        : hostProjectId !== "lookbase"
          ? hostProjectId
          : cfg.model || "lookbase",
    [hostProjectId],
  );
  const effectiveModelName = useMemo(
    () => resolveEffectiveModel(calcConfig),
    [calcConfig, resolveEffectiveModel],
  );
  const calcConfigRef = useRef<CalculationsConfig>(calcConfig);
  calcConfigRef.current = calcConfig;
  const effectiveModelRef = useRef<string>(effectiveModelName);
  effectiveModelRef.current = effectiveModelName;
  const configLoadedRef = useRef<boolean>(Boolean(host));

  const effectiveAvailableHierarchies = useMemo(() => {
    if (availableHierarchies.length > 0) return availableHierarchies;
    const fromCfg = discoverHierarchiesFromExplore(null, calcConfig);
    if (fromCfg.length > 0) return fromCfg;
    return hostProjectId === "lookbase" ? BUILTIN_HIERARCHY_CATALOG : [];
  }, [availableHierarchies, calcConfig, hostProjectId]);

  const effectiveEnabledHierarchyIds = useMemo(() => {
    const validEnabled = enabledHierarchyIds.filter((id) =>
      effectiveAvailableHierarchies.some((h) => h.id === id),
    );
    if (validEnabled.length > 0) return validEnabled;
    if (effectiveAvailableHierarchies.length > 0) {
      const defH =
        calcConfig.initial_state?.default_hierarchy || effectiveAvailableHierarchies[0].id;
      const fromInit = calcConfig.initial_state?.enabled_hierarchies?.filter((id) =>
        effectiveAvailableHierarchies.some((h) => h.id === id),
      );
      return fromInit?.length
        ? Array.from(new Set([...fromInit, defH]))
        : resolveHierarchyDiscoverySource(calcConfig) === "lookml"
          ? effectiveAvailableHierarchies.map((h) => h.id)
          : effectiveAvailableHierarchies.slice(0, 2).map((h) => h.id);
    }
    return enabledHierarchyIds;
  }, [enabledHierarchyIds, effectiveAvailableHierarchies, calcConfig]);

  const effectiveActiveHierarchyId = useMemo(() => {
    if (effectiveAvailableHierarchies.some((h) => h.id === activeHierarchyId)) {
      return activeHierarchyId;
    }
    return (
      calcConfig.initial_state?.default_hierarchy ||
      effectiveAvailableHierarchies[0]?.id ||
      activeHierarchyId
    );
  }, [effectiveAvailableHierarchies, activeHierarchyId, calcConfig]);

  const activeHierarchyDef = useMemo(
    () =>
      effectiveAvailableHierarchies.find((h) => h.id === effectiveActiveHierarchyId) ||
      effectiveAvailableHierarchies[0] ||
      BUILTIN_HIERARCHY_CATALOG[0],
    [effectiveAvailableHierarchies, effectiveActiveHierarchyId],
  );

  const availableGridMeasures = useMemo<LookBaseMeasureDef[]>(() => {
    if (Array.isArray(calcConfig.measures) && calcConfig.measures.length > 0) {
      return calcConfig.measures;
    }
    if (hostProjectId !== "lookbase") {
      return [];
    }
    return [
      {
        id: "long_metrics.total_sale_price",
        label: "Total Sale Price",
        fieldName: "long_metrics.total_sale_price",
        format: "$#,##0",
      },
      {
        id: "long_metrics.total_gross_margin",
        label: "Total Gross Margin",
        fieldName: "long_metrics.total_gross_margin",
        format: "$#,##0",
      },
      {
        id: "long_metrics.gross_margin_percentage",
        label: "Gross Margin % (LookML)",
        fieldName: "long_metrics.gross_margin_percentage",
        format: "0.0%",
      },
    ];
  }, [calcConfig.measures, hostProjectId]);

  const effectiveSelectedGridMeasureIds = useMemo(() => {
    const validSelected = selectedGridMeasureIds.filter(
      (id) =>
        availableGridMeasures.length === 0 ||
        availableGridMeasures.some((m) => (m.fieldName || m.id) === id || m.id === id),
    );
    if (validSelected.length > 0) return validSelected;
    if (calcConfig.initial_state?.grid_measures?.length) {
      return calcConfig.initial_state.grid_measures;
    }
    if (availableGridMeasures.length > 0) {
      return availableGridMeasures.slice(0, 4).map((m) => m.fieldName || m.id);
    }
    return hostProjectId === "lookbase"
      ? [
          "long_metrics.total_sale_price",
          "long_metrics.total_gross_margin",
          "long_metrics.gross_margin_percentage",
        ]
      : [];
  }, [selectedGridMeasureIds, availableGridMeasures, calcConfig.initial_state, hostProjectId]);
  const selectedGridMeasureIdsRef = useRef<string[]>(effectiveSelectedGridMeasureIds);
  selectedGridMeasureIdsRef.current = effectiveSelectedGridMeasureIds;

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
      savedExpandedMemberIds.filter(
        (id) => id.startsWith("BRAND:") || id.startsWith("HOTEL:"),
      ),
    );
    const categoriesWithExplicitBrands = new Set(
      Array.from(explicitBrandIds)
        .map((id) => {
          if (id.startsWith("BRAND:")) {
            const parts = id.slice("BRAND:".length).split("|");
            return `CAT:${parts[0]}|${parts[1]}`;
          }
          return "";
        })
        .filter(Boolean),
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
    const totalDepth = Math.max(4, activeHierarchyDef?.levelLabels?.length || 7);
    return projectOutlineRowsToReportTable(
      rowsToProject,
      rawQueryResponse,
      pcConfig,
      totalDepth,
    );
  }, [
    isParentChildMode,
    outlineRows,
    rawQueryResponse,
    pcConfig,
    savedExpandedMemberIds,
    activeHierarchyDef,
  ]);

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

  const selectedTimeframes = useMemo(() => {
    const parts = String(povTimeframe || "ytd")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : ["ytd"];
  }, [povTimeframe]);

  const activeLeftTimeframe = useMemo(() => {
    if (leftPaneTimeframe && selectedTimeframes.includes(leftPaneTimeframe)) {
      return leftPaneTimeframe;
    }
    return selectedTimeframes[0] || "ytd";
  }, [leftPaneTimeframe, selectedTimeframes]);

  // Sync deterministic URL query string whenever state changes
  const lastSyncedQueryRef = useRef<string>("");
  useEffect(() => {
    if (!configLoadedRef.current) return;
    const defaultHierarchyId =
      calcConfig.initial_state?.default_hierarchy ||
      availableHierarchies[0]?.id ||
      "product";
    const qs = serializeLookBaseUrlState({
      version: povVersion,
      timeframe: povTimeframe,
      source: povSource,
      year: povYear,
      hierarchy: activeHierarchyId !== defaultHierarchyId ? activeHierarchyId : undefined,
      member: selectedOutlineMemberId,
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
    activeHierarchyId,
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
      if (memberIds.length > MAX_PERSISTED_EXPANDED_MEMBER_IDS) {
        return;
      }
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
            effectiveModelRef.current,
            [node.memberId],
            pcConfig,
            5000,
            activeHierarchyId,
            calcConfigRef.current,
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
    [modalUnfoldedIds, allHierarchyNodeMap, core40SDK, pcConfig, activeHierarchyId],
  );

  // Load initial parent-child outline AND restore all saved expanded branches together on load
  const loadStandaloneOutline = useCallback(
    async (
      versionOverride = povVersion,
      timeframeOverride = povTimeframe,
      sourceOverride = povSource,
      yearOverride = povYear,
      expandedMemberIdsOverride = savedExpandedMemberIds,
      hierarchyOverride = activeHierarchyId,
      configOverride?: CalculationsConfig,
      gridMeasuresOverride?: string[],
    ) => {
      if (!core40SDK) return;
      let activeCfg = configOverride || calcConfigRef.current;
      if (
        !configOverride &&
        !isCustomCalculationsConfig(activeCfg) &&
        hostProjectId !== "lookbase"
      ) {
        const loaded = await loadProjectCalculations(
          activeHost,
          hostProjectId,
          "calculations.strings.json",
          core40SDK,
          artifactNamespace,
        );
        if (isCustomCalculationsConfig(loaded)) {
          activeCfg = loaded;
          calcConfigRef.current = loaded;
          effectiveModelRef.current = loaded.model || hostProjectId;
          setCalcConfig(loaded);
          const discovered = discoverHierarchiesFromExplore(null, loaded);
          if (discovered.length > 0) {
            setAvailableHierarchies(discovered);
            const defH = loaded.initial_state?.default_hierarchy || discovered[0].id;
            const enabledH = loaded.initial_state?.enabled_hierarchies?.length
              ? Array.from(new Set([...loaded.initial_state.enabled_hierarchies, defH]))
              : discovered.slice(0, 2).map((h) => h.id);
            setActiveHierarchyId((prev) =>
              discovered.some((h) => h.id === prev) ? prev : defH,
            );
            setEnabledHierarchyIds((prev) =>
              prev.some((id) => discovered.some((h) => h.id === id)) ? prev : enabledH,
            );
            setHierarchyCatalogNodes((prev) =>
              prev.length > 0 ? prev : getStarterHierarchyNodesForId(defH, loaded),
            );
            fetchFullHierarchyCatalog(
              core40SDK,
              loaded.model || hostProjectId,
              loaded.parent_child_hierarchy || pcConfig,
              defH,
              loaded,
            ).then((fullNodes) => {
              if (fullNodes.length > 0) {
                setHierarchyCatalogNodes(fullNodes);
              }
            });
          }
        }
      }
      const isCustom = isCustomCalculationsConfig(activeCfg);
      const activeModel = resolveEffectiveModel(activeCfg);
      const activeExplore = activeCfg.explore || "long_metrics";
      const activePcConfig = activeCfg.parent_child_hierarchy || pcConfig;
      const resolvedHierarchyId =
        isCustom &&
        activeCfg.hierarchies?.length &&
        !activeCfg.hierarchies.some((h) => h.id === hierarchyOverride)
          ? activeCfg.initial_state?.default_hierarchy || activeCfg.hierarchies[0].id
          : hierarchyOverride;
      setIsBusy(true);
      const tfParts = String(timeframeOverride || "ytd")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const isMultiTimeframe = tfParts.length > 1;
      const aligned = isMultiTimeframe
        ? { timeframe: tfParts.join(","), source: sourceOverride }
        : normalizeSourceAndTimeframe(sourceOverride, tfParts[0] || "ytd");

      const ecommerceLegacyIds = new Set([
        "DEPT:Men",
        "DEPT:Women",
        "CAT:Men|Jeans",
        "CAT:Men|Outerwear & Coats",
        "CAT:Men|Active",
        "CAT:Women|Dresses",
        "CAT:Women|Outerwear & Coats",
        "CAT:Women|Sweaters",
        "CAT:Women|Active",
      ]);
      const sanitizedExpandedIds = isCustom
        ? expandedMemberIdsOverride.filter((id) => !ecommerceLegacyIds.has(id))
        : expandedMemberIdsOverride;

      const explicitBrandIds = sanitizedExpandedIds.filter(
        (id) => id.startsWith("BRAND:") || id.startsWith("HOTEL:"),
      );
      const nonLeafParentIds = sanitizedExpandedIds.flatMap((id) => {
        if (id.startsWith("BRAND:")) {
          const parts = id.slice("BRAND:".length).split("|");
          if (parts.length >= 2) {
            return [`DEPT:${parts[0]}`, `CAT:${parts[0]}|${parts[1]}`];
          }
          return [];
        }
        if (id.startsWith("HOTEL:")) {
          return [];
        }
        return [id];
      });
      const parentSet = Array.from(new Set(["ROOT", "ALL", ...nonLeafParentIds]));

      const toastId = pushToast({
        message: `Syncing live cube (${resolvedHierarchyId} · ${aligned.timeframe} · ${parentSet.length} branch${parentSet.length === 1 ? "" : "es"})...`,
        variant: "info",
        timeoutMs: null,
      });
      const applyStarterFallback = () => {
        const fallbackOutline = getStarterOutlineForConfig(activeCfg, resolvedHierarchyId);
        setOutlineRows((prev) => (prev.length === 0 ? fallbackOutline.data : prev));
        setStandaloneQueryResponse((prev: QueryResponse | undefined) =>
          !prev ? (fallbackOutline as QueryResponse) : prev,
        );
      };

      try {
        const baseFilters: Record<string, string> = {
          "long_metrics.timeframe": aligned.timeframe,
          "long_metrics.source_parameter": aligned.source,
        };
        if (resolvedHierarchyId) {
          baseFilters["dim_product_hierarchy.hierarchy_id"] =
            escapeLookerFilterValue(resolvedHierarchyId);
        }
        if (yearOverride && yearOverride !== "ALL") {
          if (yearOverride.includes("-")) {
            baseFilters["long_metrics.month"] = escapeLookerFilterValue(yearOverride);
          } else {
            baseFilters["long_metrics.year"] = escapeLookerFilterValue(yearOverride);
          }
        }

        const configuredMeasureSet = new Set(
          (activeCfg.measures || []).map((m) => m.fieldName || m.id),
        );
        const candidateMeasures =
          gridMeasuresOverride && gridMeasuresOverride.length > 0
            ? gridMeasuresOverride
            : selectedGridMeasureIdsRef.current;
        const validSelectedMeasures = candidateMeasures.filter(
          (id) => configuredMeasureSet.size === 0 || configuredMeasureSet.has(id),
        );
        const gridMeasures =
          validSelectedMeasures.length > 0
            ? validSelectedMeasures
            : activeCfg.initial_state?.grid_measures?.length
              ? activeCfg.initial_state.grid_measures
              : activeCfg.measures?.length
                ? activeCfg.measures.slice(0, 4).map((m) => m.fieldName || m.id)
                : [
                    "long_metrics.total_sale_price",
                    "long_metrics.total_gross_margin",
                    "long_metrics.gross_margin_percentage",
                  ];

        const queryPivots = isMultiTimeframe
          ? ["long_metrics.timeframe", "long_metrics.current_period"]
          : ["long_metrics.current_period"];

        const fields = [
          activePcConfig.memberIdField,
          activePcConfig.parentIdField,
          activePcConfig.labelField,
          activePcConfig.pathField,
          activePcConfig.levelField,
          activePcConfig.isLeafField,
          ...(isMultiTimeframe ? ["long_metrics.timeframe"] : []),
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
              cache: !isMultiTimeframe,
              body: {
                model: activeModel,
                view: activeExplore,
                fields,
                pivots: queryPivots,
                filters: {
                  ...baseFilters,
                  [activePcConfig.parentIdField]: firstChunk,
                },
                sorts: [activePcConfig.levelField, activePcConfig.labelField],
                limit: "500",
              },
            }),
          ),
          parentSet.length > 20
            ? restoreSavedOutlineExpansion(
                core40SDK,
                {
                  model: activeModel,
                  view: activeExplore,
                  fields,
                  pivots: queryPivots,
                  filters: baseFilters,
                  sorts: [activePcConfig.levelField, activePcConfig.labelField],
                },
                parentSet.slice(20),
                activePcConfig,
                20,
              )
            : Promise.resolve({ rows: [], fetchedParentIds: parentSet, batchCount: 1 }),
          explicitBrandsFilter
            ? core40SDK
                .ok(
                  core40SDK.run_inline_query({
                    result_format: "json_detail",
                    body: {
                      model: activeModel,
                      view: activeExplore,
                      fields,
                      pivots: queryPivots,
                      filters: {
                        ...baseFilters,
                        [activePcConfig.memberIdField]: explicitBrandsFilter,
                      },
                      sorts: [activePcConfig.levelField, activePcConfig.labelField],
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
            ? mergeOutlineRows(primaryRows, restored.rows, activePcConfig)
            : primaryRows;

        if (rawExplicitBrandsResp) {
          const parsedBrandsResp = parseSdkJson(rawExplicitBrandsResp);
          const brandRows = Array.isArray((parsedBrandsResp as any)?.data)
            ? (parsedBrandsResp as any).data
            : [];
          if (brandRows.length > 0) {
            allMergedRows = mergeOutlineRows(allMergedRows, brandRows, activePcConfig);
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
        } else {
          applyStarterFallback();
        }
        updateToast(toastId, {
          message: `Cube synced (${allMergedRows.length} rows · ${resolvedHierarchyId} · ${aligned.timeframe}).`,
          variant: "success",
          timeoutMs: 3500,
        });
      } catch {
        applyStarterFallback();
        updateToast(toastId, {
          message: "Interactive Cube Ready (using cached outline snapshot).",
          variant: "success",
          timeoutMs: 3500,
        });
      } finally {
        setInitialQueryResolved(true);
        setIsBusy(false);
      }
    },
    [
      core40SDK,
      activeHost,
      hostProjectId,
      artifactNamespace,
      resolveEffectiveModel,
      pcConfig,
      povVersion,
      povTimeframe,
      povSource,
      povYear,
      savedExpandedMemberIds,
      activeHierarchyId,
      pushToast,
      updateToast,
    ],
  );

  // Switch active dimensional hierarchy
  const handleSwitchHierarchy = useCallback(
    async (nextHierarchyId: string) => {
      const activeCfg = calcConfigRef.current;
      const activeModel = resolveEffectiveModel(activeCfg);
      const targetDef =
        effectiveAvailableHierarchies.find((h) => h.id === nextHierarchyId) ||
        effectiveAvailableHierarchies[0] ||
        BUILTIN_HIERARCHY_CATALOG[0];
      setActiveHierarchyId(nextHierarchyId);
      setEnabledHierarchyIds((prev) => {
        const base = prev.length > 0 ? prev : effectiveEnabledHierarchyIds;
        return base.includes(nextHierarchyId) ? base : [...base, nextHierarchyId];
      });
      setModalUnfoldedIds(["ALL"]);
      modalFetchedParentsRef.current = new Set(["ROOT", "ALL"]);
      setSelectedOutlineMemberId("ALL");

      const nextExpandedIds = targetDef.defaultExpandedIds || ["ROOT", "ALL"];
      const nextExpandedPaths = targetDef.defaultExpandedPaths || [targetDef.rootLabel];
      setSavedExpandedMemberIds(nextExpandedIds);
      setExpandedPaths(nextExpandedPaths);
      persistSavedExpansion(nextExpandedIds, nextExpandedPaths);

      setHierarchyCatalogNodes(getStarterHierarchyNodesForId(nextHierarchyId, activeCfg));
      if (core40SDK) {
        fetchFullHierarchyCatalog(
          core40SDK,
          activeModel,
          pcConfig,
          nextHierarchyId,
          activeCfg,
        ).then((nodes) => {
          if (nodes.length > 0) {
            setHierarchyCatalogNodes(nodes);
          }
        });
      }

      await loadStandaloneOutline(
        povVersion,
        povTimeframe,
        povSource,
        povYear,
        nextExpandedIds,
        nextHierarchyId,
        activeCfg,
      );
    },
    [
      effectiveAvailableHierarchies,
      effectiveEnabledHierarchyIds,
      resolveEffectiveModel,
      persistSavedExpansion,
      core40SDK,
      pcConfig,
      loadStandaloneOutline,
      povVersion,
      povTimeframe,
      povSource,
      povYear,
    ],
  );

  // Unified deterministic URL state applier (used by URL query params AND Quick-Start Action pills)
  const applyUrlState = useCallback(
    (urlPatch: LookBaseUrlState, triggerLiveSync = true) => {
      const nextVersion = urlPatch.version ?? povVersion;
      const nextTimeframe = urlPatch.timeframe ?? povTimeframe;
      const nextSource = urlPatch.source ?? povSource;
      const nextYear = urlPatch.year ?? povYear;
      const nextHierarchy = urlPatch.hierarchy ?? activeHierarchyId;

      if (urlPatch.version !== undefined) setPovVersion(urlPatch.version);
      if (urlPatch.timeframe !== undefined) setPovTimeframe(urlPatch.timeframe);
      if (urlPatch.source !== undefined) setPovSource(urlPatch.source);
      if (urlPatch.year !== undefined) setPovYear(urlPatch.year);
      if (urlPatch.hierarchy !== undefined && urlPatch.hierarchy !== activeHierarchyId) {
        handleSwitchHierarchy(urlPatch.hierarchy);
        return;
      }

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
      const primaryMeasureLabel =
        calcConfig.measures?.[0]?.label || "Total Sale Price";

      if (urlPatch.member !== undefined) {
        setSelectedOutlineMemberId(urlPatch.member);
        setFormulaText(
          `=GETVALUE("${primaryMeasureLabel}", "Current", "${nextTimeframe}", "${pcConfig.memberIdField}=${urlPatch.member}")`,
        );
      }
      if (urlPatch.edit !== undefined) {
        setEditValueInput(urlPatch.edit);
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
          nextHierarchy,
        );
      }
    },
    [
      povVersion,
      povTimeframe,
      povSource,
      povYear,
      activeHierarchyId,
      handleSwitchHierarchy,
      projectedOutline,
      pcConfig.memberIdField,
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
      const activeProjectId =
        activeHost?.lookerHostData?.extensionId?.split("::")?.[0] ||
        DEFAULT_CALCULATIONS_CONFIG.model ||
        "lookbase";
      const [rawCfg, userArtifact] = await Promise.all([
        loadProjectCalculations(
          activeHost,
          activeProjectId,
          "calculations.strings.json",
          core40SDK,
          artifactNamespace,
        ),
        loadUserPrefsArtifact(core40SDK, artifactNamespace),
      ]);
      if (cancelled) return;

      const hierarchySource = resolveHierarchyDiscoverySource(rawCfg);
      const exploreMeta =
        (!isCustomCalculationsConfig(rawCfg) ||
          hierarchySource === "lookml" ||
          !rawCfg.measures?.length ||
          !rawCfg.hierarchies?.length) &&
        core40SDK &&
        typeof core40SDK.lookml_model_explore === "function"
          ? await withSdkTimeout(
              Promise.resolve()
                .then(() =>
                  core40SDK.ok(
                    (core40SDK.lookml_model_explore as any)({
                      lookml_model_name: activeProjectId,
                      explore_name: "long_metrics",
                      fields: "id,name,fields",
                    }),
                  ),
                )
                .catch(() => null),
              4000,
              null,
            )
          : null;
      if (cancelled) return;

      let loadedCfg = exploreMeta
        ? discoverFieldsFromExplore(exploreMeta, rawCfg)
        : rawCfg;
      const discoveredHierarchies = await fetchHierarchiesFromLookmlOutline(
        core40SDK,
        activeProjectId,
        exploreMeta,
        loadedCfg,
      );
      if (cancelled) return;
      if (resolveHierarchyDiscoverySource(loadedCfg) === "lookml") {
        loadedCfg = {
          ...loadedCfg,
          hierarchies: discoveredHierarchies,
        };
      }
      calcConfigRef.current = loadedCfg;
      effectiveModelRef.current = resolveEffectiveModel(loadedCfg);
      setCalcConfig(loadedCfg);
      const isCustomConfig = isCustomCalculationsConfig(loadedCfg);
      setAvailableHierarchies(discoveredHierarchies);

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

      // Deterministic Precedence: 1. URL Query Parameter -> 2. User Artifact -> 3. calculations.strings.json / lookbase.config.json
      const startVersion = urlState.version || prefs.pov?.version || initCfg.version || "base";
      const rawTimeframe =
        urlState.timeframe || prefs.pov?.timeframe || initCfg.timeframe || "ytd";
      const rawSource =
        urlState.source || prefs.pov?.source || initCfg.source || "Daily Actual";
      const rawTfList = String(rawTimeframe)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const alignedPov =
        rawTfList.length > 1
          ? { timeframe: rawTfList.join(","), source: rawSource }
          : normalizeSourceAndTimeframe(rawSource, rawTimeframe);
      const startTimeframe = alignedPov.timeframe;
      const startSource = alignedPov.source;
      const savedYear = prefs.pov?.year;
      const startYear =
        urlState.year ||
        initCfg.available_years?.[0] ||
        initCfg.year ||
        (savedYear && savedYear.includes("-") ? savedYear : undefined) ||
        "2026-09";
      const defaultHierarchyId =
        initCfg.default_hierarchy || discoveredHierarchies[0]?.id || "product";
      const startHierarchy =
        urlState.hierarchy &&
        discoveredHierarchies.some((h) => h.id === urlState.hierarchy)
          ? urlState.hierarchy
          : defaultHierarchyId;
      const startEnabledHierarchies =
        initCfg.enabled_hierarchies?.length
          ? Array.from(new Set([...initCfg.enabled_hierarchies, startHierarchy]))
          : resolveHierarchyDiscoverySource(loadedCfg) === "lookml"
            ? discoveredHierarchies.map((h) => h.id)
            : discoveredHierarchies.slice(0, 2).map((h) => h.id);
      if (initCfg.available_years?.length) {
        setAvailableYears(initCfg.available_years);
      }
      setPovVersion(startVersion);
      setPovTimeframe(startTimeframe);
      setPovSource(startSource);
      setPovYear(startYear);
      setActiveHierarchyId(startHierarchy);
      setEnabledHierarchyIds(startEnabledHierarchies);

      const startMember =
        urlState.member || initCfg.selected_outline_member_id || "ALL";
      setSelectedOutlineMemberId(startMember);
      const primaryMeasureLabel =
        loadedCfg.measures?.[0]?.label ||
        (isCustomConfig ? "Primary Measure" : "Total Sale Price");
      setFormulaText(
        `=GETVALUE("${primaryMeasureLabel}", "Current", "${startTimeframe}", "${startMember}")`,
      );

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

      // Apply starting expanded hierarchy nodes (URL -> User Artifact -> Project Config),
      // sanitizing any stale e-commerce IDs/paths when `isCustomConfig` is true
      const startHierarchyDef =
        discoveredHierarchies.find((h) => h.id === startHierarchy) ||
        discoveredHierarchies[0] ||
        BUILTIN_HIERARCHY_CATALOG[0];
      const ecommerceLegacyIds = new Set([
        "DEPT:Men",
        "DEPT:Women",
        "CAT:Men|Jeans",
        "CAT:Men|Outerwear & Coats",
        "CAT:Men|Active",
        "CAT:Women|Dresses",
        "CAT:Women|Outerwear & Coats",
        "CAT:Women|Sweaters",
        "CAT:Women|Active",
      ]);
      const sanitizedUrlExpanded = isCustomConfig
        ? (urlState.expanded || []).filter((id: string) => !ecommerceLegacyIds.has(id))
        : urlState.expanded || [];
      const sanitizedPrefMemberIds = isCustomConfig
        ? (prefs.savedExpandedMemberIds || []).filter((id: string) => !ecommerceLegacyIds.has(id))
        : prefs.savedExpandedMemberIds || [];
      const sanitizedPrefPaths = isCustomConfig
        ? (prefs.savedExpandedPaths || []).filter(
            (p: string) => !p.startsWith("All Products"),
          )
        : prefs.savedExpandedPaths || [];

      const useUrlExpansion = sanitizedUrlExpanded.length > (isCustomConfig ? 2 : 0);
      const usePrefExpansion =
        !useUrlExpansion &&
        startHierarchy === defaultHierarchyId &&
        sanitizedPrefMemberIds.length > (isCustomConfig ? 2 : 0) &&
        sanitizedPrefMemberIds.length <= MAX_PERSISTED_EXPANDED_MEMBER_IDS &&
        sanitizedPrefPaths.length > (isCustomConfig ? 1 : 0);

      const startMemberIds = useUrlExpansion
        ? sanitizedUrlExpanded
        : startHierarchy !== defaultHierarchyId
          ? startHierarchyDef.defaultExpandedIds
          : usePrefExpansion
            ? sanitizedPrefMemberIds
            : initCfg.expanded_member_ids || startHierarchyDef.defaultExpandedIds;
      const startPaths =
        startHierarchy !== defaultHierarchyId
          ? startHierarchyDef.defaultExpandedPaths
          : usePrefExpansion
            ? sanitizedPrefPaths
            : initCfg.expanded_paths || startHierarchyDef.defaultExpandedPaths;
      if (sanitizedPrefMemberIds.length > MAX_PERSISTED_EXPANDED_MEMBER_IDS) {
        saveUserPrefsArtifact(
          core40SDK,
          { savedExpandedMemberIds: startMemberIds, savedExpandedPaths: startPaths },
          artifactNamespace,
        );
      }
      setSavedExpandedMemberIds(startMemberIds);
      setExpandedPaths(startPaths);
      setHierarchyCatalogNodes(getStarterHierarchyNodesForId(startHierarchy, loadedCfg));

      // Only seed starter outline rows immediately when running offline without core40SDK;
      // when core40SDK is connected, wait for loadStandaloneOutline so we show the skeleton instead of fake $0 rows
      if (!hostQueryResponse && !core40SDK) {
        const starterOutline = getStarterOutlineForConfig(loadedCfg, startHierarchy);
        setOutlineRows((prev) =>
          prev.length === 0 || isCustomConfig ? starterOutline.data : prev,
        );
        setStandaloneQueryResponse((prev) =>
          !prev || isCustomConfig ? (starterOutline as QueryResponse) : prev,
        );
        setInitialQueryResolved(true);
      }

      // Apply starting Left-Hand Metrics (URL -> User Artifact -> Project Config),
      // filtering out any stale e-commerce metric IDs when `isCustomConfig` is true
      const ecommerceMetricIds = new Set([
        "long_metrics.total_sale_price",
        "long_metrics.total_gross_margin",
        "long_metrics.gross_margin_percentage",
        "calc:implied_cogs",
        "calc:margin_to_sales_ratio",
      ]);
      const sanitizedUrlMetrics = isCustomConfig
        ? (urlState.metrics || []).filter((id: string) => !ecommerceMetricIds.has(id))
        : urlState.metrics;
      const sanitizedPrefMetrics = isCustomConfig
        ? (prefs.leftHandMetricIds || []).filter((id: string) => !ecommerceMetricIds.has(id))
        : prefs.leftHandMetricIds;
      const validMeasureFieldSet = new Set(
        (loadedCfg.measures || []).map((m) => m.fieldName || m.id),
      );
      const savedGridMeasures = (prefs.gridMeasureIds || []).filter(
        (id: string) =>
          !ecommerceMetricIds.has(id) &&
          (validMeasureFieldSet.size === 0 || validMeasureFieldSet.has(id)),
      );
      const startGridMeasures =
        savedGridMeasures.length > 0
          ? savedGridMeasures
          : initCfg.grid_measures?.length
            ? initCfg.grid_measures
            : (loadedCfg.measures || []).slice(0, 4).map((m) => m.fieldName || m.id);
      if (startGridMeasures.length > 0) {
        selectedGridMeasureIdsRef.current = startGridMeasures;
        setSelectedGridMeasureIds(startGridMeasures);
      }

      const catalog = buildAutocompleteCatalog(loadedCfg);
      const resolvedMetrics = resolveInitialLeftHandMetrics(
        loadedCfg,
        catalog,
        sanitizedUrlMetrics?.length
          ? sanitizedUrlMetrics
          : sanitizedPrefMetrics?.length
            ? sanitizedPrefMetrics
            : undefined,
      );
      setLeftMetricRows(resolvedMetrics);
      if (resolvedMetrics[0]?.id) {
        setActiveMetricRowId(resolvedMetrics[0].id);
      }
      configLoadedRef.current = true;

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
          resolveEffectiveModel(loadedCfg),
          loadedCfg.parent_child_hierarchy || pcConfig,
          startHierarchy,
          loadedCfg,
        ).then((fullNodes) => {
          if (!cancelled && fullNodes.length > 0) {
            setHierarchyCatalogNodes(fullNodes);
          }
        });

        // Dynamically discover all available months (YYYY-MM) in long_metrics, newest first
        core40SDK
          .ok(
            core40SDK.run_inline_query({
              result_format: "json",
              cache: false,
              body: {
                model: resolveEffectiveModel(loadedCfg),
                view: loadedCfg.explore || "long_metrics",
                fields: ["long_metrics.month"],
                filters: {
                  "long_metrics.timeframe": "ytd",
                  "long_metrics.source_parameter": "Daily Actual",
                },
                sorts: ["long_metrics.month desc"],
                limit: "200",
              },
            }),
          )
          .then((rawYr) => {
            const parsedYr = parseSdkJson(rawYr);
            if (!cancelled && Array.isArray(parsedYr) && parsedYr.length > 0) {
              const months = Array.from(
                new Set(
                  parsedYr
                    .map((r: any) => String(r?.["long_metrics.month"] ?? ""))
                    .filter(Boolean),
                ),
              );
              if (months.length > 0) {
                setAvailableYears(months);
                if (!urlState.year && months[0] !== startYear) {
                  setPovYear(months[0]);
                  if (!hostQueryResponse && core40SDK) {
                    loadStandaloneOutline(
                      startVersion,
                      startTimeframe,
                      startSource,
                      months[0],
                      startMemberIds,
                      startHierarchy,
                      loadedCfg,
                      startGridMeasures,
                    );
                  }
                }
              }
            }
          })
          .catch(() => {
            // keep configured available_years list
          });
      }

      if (!hostQueryResponse && core40SDK) {
        loadStandaloneOutline(
          startVersion,
          startTimeframe,
          startSource,
          startYear,
          startMemberIds,
          startHierarchy,
          loadedCfg,
          startGridMeasures,
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
  }, [activeHost, core40SDK, artifactNamespace]);

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
      exposeDownloadLink: true,
      excludeHiddenRowsOnDownload: true,
      allowUserEdits: false,
      allowUserFilters: false,
      hasUserEdits: false,
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
              const activeCfg = calcConfigRef.current;
              const activeModel = resolveEffectiveModel(activeCfg);
              const activeExplore = activeCfg.explore || "long_metrics";
              const tfParts = String(povTimeframe || "ytd")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              const isMultiTf = tfParts.length > 1;
              const restored = await restoreSavedOutlineExpansion(
                core40SDK,
                {
                  model: activeModel,
                  view: activeExplore,
                  fields: [
                    pcConfig.memberIdField,
                    pcConfig.parentIdField,
                    pcConfig.labelField,
                    pcConfig.pathField,
                    pcConfig.levelField,
                    pcConfig.isLeafField,
                    ...(isMultiTf ? ["long_metrics.timeframe"] : []),
                    "long_metrics.current_period",
                    ...(selectedGridMeasureIdsRef.current.length > 0
                      ? selectedGridMeasureIdsRef.current
                      : activeCfg.initial_state?.grid_measures ||
                        (activeCfg.measures?.length
                          ? activeCfg.measures.slice(0, 4).map((m) => m.fieldName || m.id)
                          : [
                              "long_metrics.total_sale_price",
                              "long_metrics.total_gross_margin",
                              "long_metrics.gross_margin_percentage",
                            ])),
                  ],
                  pivots: isMultiTf
                    ? ["long_metrics.timeframe", "long_metrics.current_period"]
                    : ["long_metrics.current_period"],
                  filters: {
                    "long_metrics.timeframe": povTimeframe,
                    "long_metrics.source_parameter": povSource,
                    ...(activeHierarchyId
                      ? { "dim_product_hierarchy.hierarchy_id": activeHierarchyId }
                      : {}),
                    ...(povYear !== "ALL"
                      ? povYear.includes("-")
                        ? { "long_metrics.month": povYear }
                        : { "long_metrics.year": povYear }
                      : {}),
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
        } else if (!isParentChildMode && calcConfigRef.current.hierarchy?.length) {
          const activeCfg = calcConfigRef.current;
          const activeModel = resolveEffectiveModel(activeCfg);
          const activeExplore = activeCfg.explore || "long_metrics";
          for (const pathStr of nextExpanded) {
            if (!fetchedMemberIdsRef.current.has(pathStr)) {
              fetchedMemberIdsRef.current.add(pathStr);
              await fetchChildHierarchySlice(
                core40SDK,
                {
                  model: activeModel,
                  view: activeExplore,
                  fields: activeCfg.initial_state?.grid_measures?.slice(0, 2) || [
                    "long_metrics.total_sale_price",
                    "long_metrics.total_gross_margin",
                  ],
                },
                activeCfg.hierarchy || [],
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
      resolveEffectiveModel,
      isParentChildMode,
      projectedOutline,
      pcConfig,
      povTimeframe,
      povSource,
      povYear,
      activeHierarchyId,
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

      const rowPath =
        tr.getAttribute("data-subtotal-path") ||
        activeHierarchyDef?.rootLabel ||
        "All Products";
      const node = projectedOutline?.pathToNode?.[rowPath];
      const memberId = node?.memberId || "ALL";
      setSelectedOutlineMemberId(memberId);

      const rawText = (td.textContent || "").replace(/[^\d.-]/g, "");
      const numericVal = parseFloat(rawText);

      const primaryMeasureField =
        calcConfig.measures?.[0]?.fieldName ||
        calcConfig.measures?.[0]?.id ||
        "long_metrics.total_sale_price";
      const primaryMeasureLabel =
        calcConfig.measures?.[0]?.label || "Total Sale Price";

      if (td.classList.contains("dimension")) {
        const parentNode = node?.parentId ? projectedOutline?.memberIdToNode?.[node.parentId] : undefined;
        const pctOfParent =
          node && parentNode
            ? evaluateLookBaseFormula(
                `MEMBER('${primaryMeasureLabel}') / NULLIF(PARENTVAL('${primaryMeasureLabel}'), 0)`,
                {
                  memberValues: {
                    [primaryMeasureLabel]:
                      node.rawRow?.[primaryMeasureField]?.Current?.value ??
                      node.rawRow?.[primaryMeasureField]?.value ??
                      0,
                  },
                  parentValues: {
                    [primaryMeasureLabel]:
                      parentNode.rawRow?.[primaryMeasureField]?.Current?.value ??
                      parentNode.rawRow?.[primaryMeasureField]?.value ??
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
      } else {
        setFormulaText(
          `=GETVALUE("${primaryMeasureLabel}", "Current", "${povTimeframe}", "${pcConfig.memberIdField}=${memberId}")`,
        );
        if (Number.isFinite(numericVal)) {
          setEditValueInput(String(numericVal));
        }
      }
    },
    [
      projectedOutline,
      povTimeframe,
      pcConfig.memberIdField,
      activeHierarchyDef?.rootLabel,
      calcConfig.measures,
    ],
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
      const tfParts = String(nextTimeframe || "ytd")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const isMultiTf = tfParts.length > 1;
      let aligned: { source: string; timeframe: string };
      if (isMultiTf) {
        const grainSpecificTf =
          [...tfParts]
            .reverse()
            .find((tf) => tf !== "ytd" && tf !== "current_view") || tfParts[0];
        const firstAligned = normalizeSourceAndTimeframe(
          nextSource,
          grainSpecificTf,
          "timeframe",
        );
        aligned = {
          timeframe: tfParts.join(","),
          source: changedField === "source" ? nextSource : firstAligned.source,
        };
      } else {
        aligned = normalizeSourceAndTimeframe(nextSource, nextTimeframe, changedField);
      }

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
      if (tileHostData?.isDashboardTile && tileSDK?.updateFilters) {
        applyFiltersToHost(tileSDK, {
          "long_metrics.timeframe": aligned.timeframe,
          "long_metrics.source_parameter": aligned.source,
          ...(nextYear.includes("-")
            ? { "long_metrics.month": nextYear }
            : { "long_metrics.year": nextYear }),
        });
      }
      if (!hostQueryResponse) {
        loadStandaloneOutline(
          nextVersion,
          aligned.timeframe,
          aligned.source,
          nextYear,
          savedExpandedMemberIds,
          activeHierarchyId,
        );
      }
    },
    [
      tileHostData?.isDashboardTile,
      tileSDK,
      hostQueryResponse,
      loadStandaloneOutline,
      savedExpandedMemberIds,
      activeHierarchyId,
      core40SDK,
      artifactNamespace,
    ],
  );

  const refreshBiEngineTables = useCallback(async () => {
    setIsDiscoveringBiTables(true);
    try {
      const discovered = await discoverBIEngineCandidateTables(
        core40SDK,
        effectiveModelRef.current,
        calcConfigRef.current,
      );
      setBiEngineProjectId(discovered.projectId);
      setBiEngineTables(discovered.tables);
    } finally {
      setIsDiscoveringBiTables(false);
    }
  }, [core40SDK]);

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
      const activeCfg = calcConfigRef.current;
      const isCustom = isCustomCalculationsConfig(activeCfg);
      const targetView = isCustom
        ? activeCfg.explore || "long_metrics"
        : viewToRebuild || activeCfg.base_pdt_view || "long_metrics_base";
      const rebuildFields = isCustom
        ? [
            activeCfg.measures?.[0]?.fieldName ||
              activeCfg.measures?.[0]?.id ||
              `${targetView}.count`,
          ]
        : undefined;
      setIsBusy(true);
      const toastId = pushToast({
        message: `Rebuilding PDT '${targetView}' (rebuild_pdts=true) & pinning to BI Engine...`,
        variant: "info",
        timeoutMs: null,
      });
      try {
        await rebuildCubePdt(core40SDK, {
          model: resolveEffectiveModel(activeCfg),
          view: targetView,
          fields: rebuildFields,
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
      resolveEffectiveModel,
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
    const matchedH =
      effectiveAvailableHierarchies.find((h) => h.id === effectiveActiveHierarchyId) ||
      effectiveAvailableHierarchies[0];
    const friendlyLabel =
      matchedH?.shortLabel || matchedH?.label || matchedH?.rootLabel || "";
    const pageTitle = friendlyLabel ? `${friendlyLabel} - LookBase` : "LookBase";
    activeHost?.updateTitle?.(pageTitle);
  }, [activeHost, effectiveAvailableHierarchies, effectiveActiveHierarchyId]);

  const activeOutlineNode: OutlineNodeMeta | undefined =
    projectedOutline?.memberIdToNode?.[selectedOutlineMemberId] ||
    projectedOutline?.memberIdToNode?.["ALL"] ||
    loadedOutlineNodes[0];

  const parentOutlineNode: OutlineNodeMeta | undefined = activeOutlineNode?.parentId
    ? projectedOutline?.memberIdToNode?.[activeOutlineNode.parentId]
    : undefined;

  const configuredQuickStarts =
    !host && !configLoadedRef.current && hostProjectId !== "lookbase"
      ? []
      : calcConfig.quick_start_actions?.length
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
      <LookBaseHeaderBars
        core40SDK={core40SDK}
        artifactNamespace={artifactNamespace}
        calcConfig={calcConfig}
        showLeftMetricsPane={showLeftMetricsPane}
        setShowLeftMetricsPane={setShowLeftMetricsPane}
        setIsHierarchyModalOpen={setIsHierarchyModalOpen}
        activeHierarchyDef={activeHierarchyDef}
        savedExpandedMemberIds={savedExpandedMemberIds}
        effectiveActiveHierarchyId={effectiveActiveHierarchyId}
        effectiveAvailableHierarchies={effectiveAvailableHierarchies}
        effectiveEnabledHierarchyIds={effectiveEnabledHierarchyIds}
        handleSwitchHierarchy={handleSwitchHierarchy}
        isMeasuresDropdownOpen={isMeasuresDropdownOpen}
        setIsMeasuresDropdownOpen={setIsMeasuresDropdownOpen}
        effectiveSelectedGridMeasureIds={effectiveSelectedGridMeasureIds}
        availableGridMeasures={availableGridMeasures}
        selectedGridMeasureIdsRef={selectedGridMeasureIdsRef}
        setSelectedGridMeasureIds={setSelectedGridMeasureIds}
        loadStandaloneOutline={loadStandaloneOutline}
        povVersion={povVersion}
        povTimeframe={povTimeframe}
        povSource={povSource}
        povYear={povYear}
        availableYears={availableYears}
        selectedTimeframes={selectedTimeframes}
        isTimeframeDropdownOpen={isTimeframeDropdownOpen}
        setIsTimeframeDropdownOpen={setIsTimeframeDropdownOpen}
        handlePovChange={handlePovChange}
        canRebuildCube={canRebuildCube}
        canUpdateSettings={canUpdateSettings}
        isBusy={isBusy}
        handleRebuildCube={handleRebuildCube}
        handleOpenSettings={handleOpenSettings}
        activeHierarchyId={activeHierarchyId}
        showQuickStartBar={showQuickStartBar}
        setShowQuickStartBar={setShowQuickStartBar}
        visibleQuickStartActions={visibleQuickStartActions}
        applyUrlState={applyUrlState}
        handleDismissQuickStartPill={handleDismissQuickStartPill}
        isAddingCustomQuickStart={isAddingCustomQuickStart}
        setIsAddingCustomQuickStart={setIsAddingCustomQuickStart}
        newQuickStartLabel={newQuickStartLabel}
        setNewQuickStartLabel={setNewQuickStartLabel}
        handleSaveCustomQuickStart={handleSaveCustomQuickStart}
        dismissedQuickStartIds={dismissedQuickStartIds}
        activeCellCoord={activeCellCoord}
        formulaText={formulaText}
        setFormulaText={setFormulaText}
      />

      {/* Main Split Workspace: Left-Hand Side Metrics/Calculation Autocomplete + Right Outline Grid */}
      <div className="lookbase-workspace">
        <LookBaseLeftMetricsPane
          showLeftMetricsPane={showLeftMetricsPane}
          isSkeletonLoading={Boolean(core40SDK && !hostQueryResponse && !initialQueryResolved)}
          activeOutlineNode={activeOutlineNode}
          parentOutlineNode={parentOutlineNode}
          activeHierarchyDef={activeHierarchyDef}
          selectedOutlineMemberId={selectedOutlineMemberId}
          autocompleteInputRef={autocompleteInputRef}
          leftMetricQuery={leftMetricQuery}
          setLeftMetricQuery={setLeftMetricQuery}
          isAutocompleteOpen={isAutocompleteOpen}
          setIsAutocompleteOpen={setIsAutocompleteOpen}
          highlightedIndex={highlightedIndex}
          setHighlightedIndex={setHighlightedIndex}
          handleAutocompleteKeyDown={handleAutocompleteKeyDown}
          replacingRowId={replacingRowId}
          setReplacingRowId={setReplacingRowId}
          availableMemberLevels={availableMemberLevels}
          autocompleteMemberLevels={autocompleteMemberLevels}
          setAutocompleteMemberLevels={setAutocompleteMemberLevels}
          autocompleteScrollTop={autocompleteScrollTop}
          setAutocompleteScrollTop={setAutocompleteScrollTop}
          autocompleteMatches={autocompleteMatches}
          handleSelectAutocompleteItem={handleSelectAutocompleteItem}
          selectedTimeframes={selectedTimeframes}
          activeLeftTimeframe={activeLeftTimeframe}
          setLeftPaneTimeframe={setLeftPaneTimeframe}
          leftMetricRows={leftMetricRows}
          calcConfig={calcConfig}
          activeMetricRowId={activeMetricRowId}
          setActiveMetricRowId={setActiveMetricRowId}
          setActiveCellCoord={setActiveCellCoord}
          setFormulaText={setFormulaText}
          updateAndPersistLeftMetrics={updateAndPersistLeftMetrics}
        />

        {/* Core viz-report-table Grid Wrapper */}
        <div
          id="lookbase-tour-grid"
          ref={gridWrapperRef}
          className="lookbase-grid-area"
          onClick={handleGridClick}
          onDoubleClick={handleGridDoubleClick}
        >
          {effectiveQueryResponse &&
          artifactLoaded &&
          !(core40SDK && !hostQueryResponse && !initialQueryResolved) ? (
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
            <div className="lookbase-skeleton-grid" data-testid="lookbase-skeleton-grid">
              <table className="lookbase-skeleton-table">
                <thead>
                  <tr>
                    <th>{activeHierarchyDef?.shortLabel || "Outline Hierarchy"}</th>
                    {Array.from({ length: 6 }, (_, cIdx) => (
                      <th key={`skel-th-${cIdx}`}>
                        <span
                          className="lookbase-skeleton-bar"
                          style={{
                            width: cIdx % 2 === 0 ? 78 : 64,
                            background:
                              "linear-gradient(90deg, rgba(255,255,255,0.22) 25%, rgba(255,255,255,0.42) 50%, rgba(255,255,255,0.22) 75%)",
                            backgroundSize: "200% 100%",
                          }}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }, (_, rIdx) => {
                    const isRoot = rIdx === 0;
                    const indent = rIdx === 0 ? 0 : rIdx <= 3 ? 16 : rIdx <= 7 ? 32 : 48;
                    return (
                      <tr
                        key={`skel-tr-${rIdx}`}
                        className={isRoot ? "skeleton-root" : ""}
                      >
                        <td style={{ paddingLeft: 10 + indent }}>
                          <span
                            className="lookbase-skeleton-bar"
                            style={{ width: isRoot ? 110 : rIdx % 2 === 0 ? 128 : 96 }}
                          />
                        </td>
                        {Array.from({ length: 6 }, (_, cIdx) => (
                          <td key={`skel-td-${rIdx}-${cIdx}`}>
                            <span
                              className="lookbase-skeleton-bar"
                              style={{ width: (rIdx + cIdx) % 2 === 0 ? 68 : 54 }}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <LookBaseHierarchyModal
        isOpen={isHierarchyModalOpen}
        onClose={() => setIsHierarchyModalOpen(false)}
        activeHierarchyDef={activeHierarchyDef}
        allHierarchyNodes={allHierarchyNodes}
        allHierarchyNodeMap={allHierarchyNodeMap}
        effectiveAvailableHierarchies={effectiveAvailableHierarchies}
        effectiveEnabledHierarchyIds={effectiveEnabledHierarchyIds}
        effectiveActiveHierarchyId={effectiveActiveHierarchyId}
        setEnabledHierarchyIds={setEnabledHierarchyIds}
        handleSwitchHierarchy={handleSwitchHierarchy}
        exploreHierarchyToAdd={exploreHierarchyToAdd}
        setExploreHierarchyToAdd={setExploreHierarchyToAdd}
        persistSavedExpansion={persistSavedExpansion}
        setExpandedPaths={setExpandedPaths}
        modalUnfoldedIds={modalUnfoldedIds}
        setModalUnfoldedIds={setModalUnfoldedIds}
        modalLoadingParentIds={modalLoadingParentIds}
        handleToggleModalUnfold={handleToggleModalUnfold}
        core40SDK={core40SDK}
        effectiveModelRef={effectiveModelRef}
        pcConfig={pcConfig}
        activeHierarchyId={activeHierarchyId}
        calcConfigRef={calcConfigRef}
        setHierarchyCatalogNodes={setHierarchyCatalogNodes}
        loadStandaloneOutline={loadStandaloneOutline}
        povVersion={povVersion}
        povTimeframe={povTimeframe}
        povSource={povSource}
        povYear={povYear}
        hierarchyFilterSearch={hierarchyFilterSearch}
        setHierarchyFilterSearch={setHierarchyFilterSearch}
        savedExpandedMemberIds={savedExpandedMemberIds}
      />

      <LookBaseSettingsModal
        isOpen={isSettingsModalOpen}
        canUpdateSettings={canUpdateSettings}
        onClose={() => setIsSettingsModalOpen(false)}
        currentUser={currentUser}
        isCurrentUserAdmin={isCurrentUserAdmin}
        settingsDraft={settingsDraft}
        setSettingsDraft={setSettingsDraft}
        settingsGroupIdsInput={settingsGroupIdsInput}
        setSettingsGroupIdsInput={setSettingsGroupIdsInput}
        settingsUserIdsInput={settingsUserIdsInput}
        setSettingsUserIdsInput={setSettingsUserIdsInput}
        rebuildCubeGroupIdsInput={rebuildCubeGroupIdsInput}
        setRebuildCubeGroupIdsInput={setRebuildCubeGroupIdsInput}
        rebuildCubeUserIdsInput={rebuildCubeUserIdsInput}
        setRebuildCubeUserIdsInput={setRebuildCubeUserIdsInput}
        isDiscoveringBiTables={isDiscoveringBiTables}
        refreshBiEngineTables={refreshBiEngineTables}
        biEngineTables={biEngineTables}
        biEngineProjectId={biEngineProjectId}
        canRebuildCube={canRebuildCube}
        isBusy={isBusy}
        handleRebuildCube={handleRebuildCube}
        settingsFormError={settingsFormError}
        isSavingSettings={isSavingSettings}
        handleSaveSettings={handleSaveSettings}
      />

      <LookBaseToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
