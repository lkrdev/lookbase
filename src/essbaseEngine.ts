import SSF from "ssf";

export interface ParentChildHierarchyConfig {
  memberIdField: string;
  parentIdField: string;
  labelField: string;
  pathField: string;
  levelField: string;
  isLeafField: string;
  rootParentIds?: string[];
}

export interface TwoPassMetricConfig {
  id: string;
  label: string;
  solve_order?: number;
  formula: string;
  format?: string;
}

export interface ColumnCalcConfig {
  id: string;
  label: string;
  solve_order?: number;
  formula: string;
  format?: string;
}

export interface PinnedRowConfig {
  id: string;
  label: string;
  formula: string;
  format?: string;
}

export interface FieldDiscoveryConfig {
  /**
   * "all_except_excluded" (default): automatically includes all non-hidden measures and dimensions
   * from the LookML Explore except those carrying `exclude_tag` (default "lookbase:exclude").
   * "include_tagged": only includes fields carrying `include_tag` (default "lookbase:include").
   */
  mode?: "all_except_excluded" | "include_tagged";
  exclude_tag?: string;
  include_tag?: string;
}

export interface LookBaseSettingsConfig {
  restrict_settings?: boolean;
  settings_group_ids?: string[];
  settings_user_ids?: string[];
  restrict_rebuild_cube?: boolean;
  rebuild_cube_group_ids?: string[];
  rebuild_cube_user_ids?: string[];
}

export interface LookBaseCurrentUser {
  id?: string | number;
  email?: string;
  display_name?: string;
  role_ids?: Array<string | number>;
  group_ids?: Array<string | number>;
}

export const DEFAULT_LOOKBASE_SETTINGS: Required<LookBaseSettingsConfig> = {
  restrict_settings: false,
  settings_group_ids: [],
  settings_user_ids: [],
  restrict_rebuild_cube: false,
  rebuild_cube_group_ids: [],
  rebuild_cube_user_ids: [],
};

export interface LookBaseHierarchyDef {
  id: string;
  label: string;
  shortLabel: string;
  rootLabel: string;
  description?: string;
  levelLabels: string[];
  defaultExpandedIds: string[];
  defaultExpandedPaths: string[];
  sourceType: "cube" | "explore";
  exploreView?: string;
  exploreDimensions?: string[];
  preloadedByDefault?: boolean;
}

export interface LookBaseMeasureDef {
  id: string;
  label: string;
  fieldName?: string;
  format?: string;
  description?: string;
}

export const BUILTIN_HIERARCHY_CATALOG: LookBaseHierarchyDef[] = [
  {
    id: "product",
    label: "Product Hierarchy (Department → Category → Brand)",
    shortLabel: "Product",
    rootLabel: "All Products",
    description: "Default LookBase Product Hierarchy (Department → Category → Brand)",
    levelLabels: ["All Products", "Department", "Category", "Brand"],
    defaultExpandedIds: ["ROOT", "ALL", "DEPT:Men", "DEPT:Women"],
    defaultExpandedPaths: ["All Products", "All Products|Men"],
    sourceType: "cube",
    exploreView: "dim_product_hierarchy",
    exploreDimensions: [
      "dim_products.department",
      "dim_products.category",
      "dim_products.brand",
    ],
    preloadedByDefault: true,
  },
];

export const LOOKBASE_TIMEFRAME_OPTIONS: Array<{
  value: string;
  label: string;
  shortLabel: string;
  grain: string;
}> = [
  { value: "ytd", label: "YTD (Year-to-Date)", shortLabel: "YTD", grain: "All" },
  { value: "current_view", label: "Current View", shortLabel: "Current View", grain: "All" },
  { value: "r3m", label: "Rolling 3M (R3M)", shortLabel: "R3M", grain: "Monthly Actual" },
  { value: "r6m", label: "Rolling 6M (R6M)", shortLabel: "R6M", grain: "Monthly Actual" },
  { value: "r12m", label: "Rolling 12M (R12M)", shortLabel: "R12M", grain: "Monthly Actual" },
  { value: "r7d", label: "Rolling 7D (R7D)", shortLabel: "R7D", grain: "Daily Actual" },
  { value: "r28d", label: "Rolling 28D (R28D)", shortLabel: "R28D", grain: "Daily Actual" },
  { value: "r90d", label: "Rolling 90D (R90D)", shortLabel: "R90D", grain: "Daily Actual" },
  { value: "r3q", label: "Rolling 3Q (R3Q)", shortLabel: "R3Q", grain: "Quarterly Actual" },
  { value: "r6q", label: "Rolling 6Q (R6Q)", shortLabel: "R6Q", grain: "Quarterly Actual" },
  { value: "r12q", label: "Rolling 12Q (R12Q)", shortLabel: "R12Q", grain: "Quarterly Actual" },
];

export function formatTimeframeLabel(tf: string): string {
  const found = LOOKBASE_TIMEFRAME_OPTIONS.find(
    (o) => o.value.toLowerCase() === String(tf || "").toLowerCase(),
  );
  return found ? found.label : String(tf || "").toUpperCase();
}

export function formatTimeframeShortLabel(tf: string): string {
  const found = LOOKBASE_TIMEFRAME_OPTIONS.find(
    (o) => o.value.toLowerCase() === String(tf || "").toLowerCase(),
  );
  return found ? found.shortLabel : String(tf || "").toUpperCase();
}

const MONTH_ABBR_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Formats a `YYYY-MM` reporting month string (e.g. `"2025-03"`) into a human-friendly
 * Month + Year label (`"Mar 2025"`).
 */
export function formatMonthYearLabel(ym: string): string {
  const raw = String(ym || "").trim();
  if (!raw || raw.toUpperCase() === "ALL") return "All Months";
  const match = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    const yr = match[1];
    const mIdx = parseInt(match[2], 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${MONTH_ABBR_NAMES[mIdx]} ${yr}`;
    }
  }
  return raw;
}

/**
 * Returns `true` when `calcConfig` represents a customer-specific `calculations.strings.json`
 * (or custom Looker Extension Context Data), indicating that none of the default e-commerce
 * demo fallbacks (`All Products`, `DEPT:Men`, `DEPT:Women`, `Total Sale Price`, `Total Gross Margin`,
 * `calc:implied_cogs`) should be displayed or injected.
 */
export function isCustomCalculationsConfig(calcConfig?: CalculationsConfig | null): boolean {
  if (!calcConfig) return false;
  if (calcConfig._isCustomProjectConfig) return true;
  if (calcConfig.model && calcConfig.model !== "lookbase") return true;
  if (Array.isArray(calcConfig.hierarchies) && calcConfig.hierarchies.length > 0) return true;
  if (Array.isArray(calcConfig.measures) && calcConfig.measures.length > 0) return true;
  const gridMeasures = calcConfig.initial_state?.grid_measures || [];
  if (
    gridMeasures.length > 0 &&
    !gridMeasures.includes("long_metrics.total_sale_price")
  ) {
    return true;
  }
  return false;
}

/**
 * Discovers all available dimensional hierarchies from LookML Explore metadata.
 * When a customer-specific `calculations.strings.json` is present (`isCustomCalculationsConfig(calcConfig)`
 * or `calcConfig?.hierarchies?.length`), completely replaces `BUILTIN_HIERARCHY_CATALOG` so default
 * e-commerce hierarchies never appear in the UI.
 */
export function discoverHierarchiesFromExplore(
  exploreMeta: any,
  calcConfig?: CalculationsConfig | null,
): LookBaseHierarchyDef[] {
  const isCustom = isCustomCalculationsConfig(calcConfig);
  const catalog: LookBaseHierarchyDef[] =
    Array.isArray(calcConfig?.hierarchies) && calcConfig!.hierarchies!.length > 0
      ? [...calcConfig!.hierarchies!]
      : isCustom
        ? []
        : [...BUILTIN_HIERARCHY_CATALOG];
  const seenIds = new Set(catalog.map((h) => h.id));
  const rawDims: any[] = Array.isArray(exploreMeta?.fields?.dimensions)
    ? exploreMeta.fields.dimensions
    : [];
  const byGroup = new Map<string, any[]>();
  for (const d of rawDims) {
    if (!d || d.hidden) continue;
    const grp = String(d.field_group_label || d.group_label || "");
    if (!grp) continue;
    if (!byGroup.has(grp)) byGroup.set(grp, []);
    byGroup.get(grp)!.push(d);
  }
  for (const [grpLabel, dims] of byGroup.entries()) {
    if (dims.length < 2) continue;
    const viewPrefix = String(dims[0]?.name || "").split(".")[0] || "";
    const alreadyCovered = catalog.some(
      (h) => h.exploreView === viewPrefix || h.label.toLowerCase().includes(grpLabel.toLowerCase()),
    );
    if (alreadyCovered) continue;
    const id =
      viewPrefix.replace(/^dim_/, "").replace(/_hierarchy$/, "") ||
      grpLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const sortedDims = [...dims].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    catalog.push({
      id,
      label: `${grpLabel} (${sortedDims.length} Levels)`,
      shortLabel: grpLabel.replace(/\s*\(.*\)$/, ""),
      rootLabel: grpLabel.replace(/\s*\(.*\)$/, ""),
      description: `Discovered from LookML Explore (${viewPrefix})`,
      levelLabels: sortedDims.map(
        (d, idx) => d?.label_short || d?.label || (idx === 0 ? "Root" : `Level ${idx}`),
      ),
      defaultExpandedIds: ["ROOT", "ALL"],
      defaultExpandedPaths: [grpLabel.replace(/\s*\(.*\)$/, "")],
      sourceType: "explore",
      exploreView: viewPrefix,
      exploreDimensions: sortedDims.map((d) => String(d.name)),
      preloadedByDefault: false,
    });
  }
  return catalog;
}

export interface LookBaseUrlState {
  version?: string;
  timeframe?: string;
  source?: string;
  year?: string;
  hierarchy?: string;
  member?: string;
  expanded?: string[];
  metrics?: string[];
  pane?: boolean;
  quickstart?: "1" | "0" | "reset";
  modal?: "hierarchy" | "settings" | null;
  q?: string;
  edit?: string;
  tour?: string;
}

export interface QuickStartActionConfig {
  id: string;
  label: string;
  params: LookBaseUrlState;
}

export interface InitialUserStateConfig {
  version?: string;
  timeframe?: string;
  source?: string;
  year?: string;
  default_hierarchy?: string;
  enabled_hierarchies?: string[];
  available_years?: string[];
  selected_outline_member_id?: string;
  expanded_member_ids?: string[];
  expanded_paths?: string[];
  grid_measures?: string[];
  left_hand_metrics?: string[];
  show_left_metrics_pane?: boolean;
  show_tour_for_new_users?: boolean;
}

export interface CalculationsConfig {
  model?: string;
  explore?: string;
  writeback_explore?: string;
  base_pdt_view?: string;
  field_discovery?: FieldDiscoveryConfig;
  measure_pdt_views?: Record<string, string>;
  settings?: LookBaseSettingsConfig;
  hierarchies?: LookBaseHierarchyDef[];
  measures?: LookBaseMeasureDef[];
  starter_outline?: any;
  _isCustomProjectConfig?: boolean;
  initial_state?: InitialUserStateConfig;
  quick_start_actions?: QuickStartActionConfig[];
  parent_child_hierarchy?: ParentChildHierarchyConfig;
  hierarchy?: string[];
  accounts?: Record<string, { sign: number; format?: string }>;
  two_pass_metrics: TwoPassMetricConfig[];
  column_calcs: ColumnCalcConfig[];
  pinned_rows?: PinnedRowConfig[];
}

export const DEFAULT_QUICK_START_ACTIONS: QuickStartActionConfig[] = [
  {
    id: "qs_search_margin",
    label: '1. Search Left-Hand Metric Autocomplete ("margin")',
    params: {
      pane: true,
      q: "margin",
    },
  },
  {
    id: "qs_expand_men_women",
    label: "2. Expand Men & Women Hierarchy Branches",
    params: {
      expanded: ["ROOT", "ALL", "DEPT:Men", "DEPT:Women"],
    },
  },
  {
    id: "qs_open_hierarchy_modal",
    label: "3. Open Recursive CTE Hierarchy Filter",
    params: {
      modal: "hierarchy",
    },
  },
  {
    id: "qs_preview_sandbox_delta",
    label: "4. Preview +10% Sandbox Writeback on Men",
    params: {
      version: "sandbox",
      member: "DEPT:Men",
      edit: "+10%",
    },
  },
];

export const DEFAULT_CALCULATIONS_CONFIG: CalculationsConfig = {
  model: "lookbase",
  explore: "long_metrics",
  writeback_explore: "lookbase_writeback",
  base_pdt_view: "long_metrics_base",
  field_discovery: {
    mode: "all_except_excluded",
    exclude_tag: "lookbase:exclude",
    include_tag: "lookbase:include",
  },
  measure_pdt_views: {
    "Total Sale Price": "stacked_total_sale_price",
    "Total Gross Margin": "stacked_total_gross_margin",
  },
  initial_state: {
    version: "base",
    timeframe: "ytd",
    source: "Daily Actual",
    year: "2025-03",
    default_hierarchy: "product",
    enabled_hierarchies: ["product"],
    selected_outline_member_id: "ALL",
    expanded_member_ids: ["ROOT", "ALL", "DEPT:Men", "DEPT:Women"],
    expanded_paths: ["All Products", "All Products|Men"],
    grid_measures: [
      "long_metrics.total_sale_price",
      "long_metrics.total_gross_margin",
      "long_metrics.gross_margin_percentage",
    ],
    left_hand_metrics: [
      "long_metrics.total_sale_price",
      "long_metrics.total_gross_margin",
      "calc:gm_pct",
      "calc:pct_of_parent",
      "calc:implied_cogs",
    ],
    show_left_metrics_pane: true,
    show_tour_for_new_users: true,
  },
  quick_start_actions: DEFAULT_QUICK_START_ACTIONS,
  parent_child_hierarchy: {
    memberIdField: "dim_product_hierarchy.member_id",
    parentIdField: "dim_product_hierarchy.parent_id",
    labelField: "dim_product_hierarchy.member_label",
    pathField: "dim_product_hierarchy.member_path",
    levelField: "dim_product_hierarchy.level_num",
    isLeafField: "dim_product_hierarchy.is_leaf",
    rootParentIds: ["ROOT", "ALL"],
  },
  hierarchy: [
    "dim_products.department",
    "dim_products.category",
    "dim_products.brand",
    "dim_products.item_name",
  ],
  accounts: {
    "Total Sale Price": { sign: 1, format: "$#,##0" },
    "Total Gross Margin": { sign: 1, format: "$#,##0" },
  },
  two_pass_metrics: [
    {
      id: "gm_pct",
      label: "Gross Margin %",
      solve_order: 2,
      formula: "MEMBER('Total Gross Margin') / NULLIF(MEMBER('Total Sale Price'), 0)",
      format: "0.0%",
    },
    {
      id: "pct_of_parent",
      label: "% of Parent Sales",
      solve_order: 2,
      formula: "MEMBER('Total Sale Price') / NULLIF(PARENTVAL('Total Sale Price'), 0)",
      format: "0.0%",
    },
  ],
  column_calcs: [
    {
      id: "yoy_var",
      label: "YoY Var $",
      solve_order: 3,
      formula: "VAR('Current', 'Last Year')",
      format: "+$#,##0;($#,##0);$0",
    },
    {
      id: "yoy_var_pct",
      label: "YoY Var %",
      solve_order: 3,
      formula: "VARPER('Current', 'Last Year')",
      format: "+0.0%;-0.0%;0.0%",
    },
  ],
  pinned_rows: [],
};

/**
 * Discovers measures, hierarchy dimensions, parent-child columns, and account sign/format metadata
 * directly from Looker's `lookml_model_explore` response using tag-based inclusion/exclusion.
 * Default mode ("all_except_excluded") includes all non-hidden fields except those tagged with
 * `exclude_tag` (default `"lookbase:exclude"`).
 */
export function discoverFieldsFromExplore(
  exploreMeta: any,
  baseConfig: CalculationsConfig = DEFAULT_CALCULATIONS_CONFIG,
): CalculationsConfig {
  if (!exploreMeta || !exploreMeta.fields) return baseConfig;
  const discovery = baseConfig.field_discovery || {
    mode: "all_except_excluded",
    exclude_tag: "lookbase:exclude",
    include_tag: "lookbase:include",
  };
  const mode = discovery.mode || "all_except_excluded";
  const excludeTag = (discovery.exclude_tag || "lookbase:exclude").toLowerCase();
  const includeTag = (discovery.include_tag || "lookbase:include").toLowerCase();

  const shouldIncludeField = (field: any): boolean => {
    if (!field || field.hidden) return false;
    const tags: string[] = Array.isArray(field.tags)
      ? field.tags.map((t: any) => String(t).toLowerCase())
      : [];
    if (tags.includes(excludeTag)) return false;
    if (mode === "include_tagged") {
      return tags.includes(includeTag);
    }
    return true;
  };

  const rawMeasures: any[] = Array.isArray(exploreMeta.fields.measures)
    ? exploreMeta.fields.measures
    : [];
  const rawDimensions: any[] = Array.isArray(exploreMeta.fields.dimensions)
    ? exploreMeta.fields.dimensions
    : [];

  const discoveredMeasures = rawMeasures.filter(shouldIncludeField);
  const discoveredMeasureNames = discoveredMeasures.map((m) => String(m.name));

  // Auto-build accounts map and LookBaseMeasureDef list from discovered measures
  const discoveredAccounts: Record<string, { sign: number; format?: string }> = {
    ...(baseConfig.accounts || {}),
  };
  const existingMeasureMap = new Map<string, LookBaseMeasureDef>();
  for (const existingM of baseConfig.measures || []) {
    existingMeasureMap.set(existingM.id, existingM);
  }
  for (const m of discoveredMeasures) {
    const mName = String(m.name);
    const label = String(m.label_short || m.label || mName);
    const tags: string[] = Array.isArray(m.tags)
      ? m.tags.map((t: any) => String(t).toLowerCase())
      : [];
    const isNegative = tags.includes("lookbase:sign:-1") || tags.includes("sign:-1");
    const fmt =
      m.value_format ||
      (mName.includes("percentage") || label.includes("%") ? "0.0%" : "$#,##0");
    if (!discoveredAccounts[label]) {
      discoveredAccounts[label] = {
        sign: isNegative ? -1 : 1,
        format: fmt,
      };
    }
    if (!existingMeasureMap.has(mName)) {
      existingMeasureMap.set(mName, {
        id: mName,
        label,
        fieldName: mName,
        format: fmt,
        description: m.description ? String(m.description) : `LookML Measure · ${mName}`,
      });
    }
  }

  // Auto-detect parent-child hierarchy columns by tag or suffix convention
  const pc: ParentChildHierarchyConfig = {
    ...(DEFAULT_CALCULATIONS_CONFIG.parent_child_hierarchy as ParentChildHierarchyConfig),
    ...(baseConfig.parent_child_hierarchy || {}),
  };
  const findDimByTagOrSuffix = (tag: string, suffix: string, fallback: string): string => {
    const byTag = rawDimensions.find(
      (d) =>
        Array.isArray(d.tags) &&
        d.tags.some((t: any) => String(t).toLowerCase() === tag.toLowerCase()),
    );
    if (byTag?.name) return String(byTag.name);
    const bySuffix = rawDimensions.find(
      (d) => !d.hidden && String(d.name).endsWith(`.${suffix}`),
    );
    return bySuffix?.name ? String(bySuffix.name) : fallback;
  };

  pc.memberIdField = findDimByTagOrSuffix("lookbase:member_id", "member_id", pc.memberIdField);
  pc.parentIdField = findDimByTagOrSuffix("lookbase:parent_id", "parent_id", pc.parentIdField);
  pc.labelField = findDimByTagOrSuffix("lookbase:member_label", "member_label", pc.labelField);
  pc.pathField = findDimByTagOrSuffix("lookbase:member_path", "member_path", pc.pathField);
  pc.levelField = findDimByTagOrSuffix("lookbase:level_num", "level_num", pc.levelField);
  pc.isLeafField = findDimByTagOrSuffix("lookbase:is_leaf", "is_leaf", pc.isLeafField);

  // Auto-discover standard drill hierarchy dimensions (excluding parent-child & internal time/pivot fields)
  const pcFieldsSet = new Set([
    pc.memberIdField,
    pc.parentIdField,
    pc.labelField,
    pc.pathField,
    pc.levelField,
    pc.isLeafField,
  ]);
  const discoveredHierarchyDims = rawDimensions
    .filter(
      (d) =>
        shouldIncludeField(d) &&
        !pcFieldsSet.has(String(d.name)) &&
        String(d.name).startsWith("dim_products."),
    )
    .map((d) => String(d.name));

  const isCustom =
    isCustomCalculationsConfig(baseConfig) ||
    (discoveredMeasureNames.length > 0 &&
      !discoveredMeasureNames.includes("long_metrics.total_sale_price"));

  const gridMeasures =
    baseConfig.initial_state?.grid_measures?.length
      ? baseConfig.initial_state.grid_measures
      : discoveredMeasureNames.length > 0
        ? discoveredMeasureNames
        : isCustom
          ? []
          : DEFAULT_CALCULATIONS_CONFIG.initial_state?.grid_measures || [];

  const defaultCalcIds = [
    ...(baseConfig.two_pass_metrics || []).map((tp) => `calc:${tp.id}`),
    ...(isCustom ? [] : ["calc:implied_cogs"]),
  ];
  const leftHandMetrics =
    baseConfig.initial_state?.left_hand_metrics?.length
      ? baseConfig.initial_state.left_hand_metrics
      : Array.from(
          new Set([
            ...gridMeasures.filter((m) => !m.includes("percentage")),
            ...defaultCalcIds,
          ]),
        );

  return {
    ...baseConfig,
    _isCustomProjectConfig: isCustom,
    measures: Array.from(existingMeasureMap.values()),
    parent_child_hierarchy: pc,
    hierarchy:
      baseConfig.hierarchy?.length
        ? baseConfig.hierarchy
        : discoveredHierarchyDims.length > 0
          ? discoveredHierarchyDims
          : isCustom
            ? []
            : DEFAULT_CALCULATIONS_CONFIG.hierarchy,
    accounts: discoveredAccounts,
    initial_state: {
      ...(isCustom ? {} : DEFAULT_CALCULATIONS_CONFIG.initial_state),
      ...(baseConfig.initial_state || {}),
      grid_measures: gridMeasures,
      left_hand_metrics: leftHandMetrics,
    },
  };
}

/**
 * Parses URL query parameters from a search string or Looker extension route (e.g. `/?version=sandbox&expanded=ROOT,ALL,DEPT:Men`)
 * into a deterministic `LookBaseUrlState` object.
 */
export function parseLookBaseUrlState(searchOrRoute: string | undefined | null): LookBaseUrlState {
  if (!searchOrRoute || typeof searchOrRoute !== "string") return {};
  const qIndex = searchOrRoute.indexOf("?");
  const rawQuery =
    qIndex >= 0
      ? searchOrRoute.slice(qIndex + 1)
      : searchOrRoute.includes("=")
        ? searchOrRoute.replace(/^\/+/, "")
        : "";
  if (!rawQuery) return {};

  const params = new URLSearchParams(rawQuery);
  const state: LookBaseUrlState = {};

  const version = params.get("version");
  if (version) state.version = version;

  const timeframe = params.get("timeframe");
  if (timeframe) state.timeframe = timeframe;

  const source = params.get("source");
  if (source) state.source = source;

  const year = params.get("year");
  if (year) state.year = year;

  const hierarchy = params.get("hierarchy");
  if (hierarchy) state.hierarchy = hierarchy;

  const member = params.get("member");
  if (member) state.member = member;

  const expanded = params.get("expanded");
  if (expanded !== null) {
    state.expanded = expanded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const metrics = params.get("metrics");
  if (metrics !== null) {
    state.metrics = metrics
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const pane = params.get("pane");
  if (pane === "1" || pane === "true") state.pane = true;
  else if (pane === "0" || pane === "false") state.pane = false;

  const quickstart = params.get("quickstart");
  if (quickstart === "1" || quickstart === "true") state.quickstart = "1";
  else if (quickstart === "0" || quickstart === "false") state.quickstart = "0";
  else if (quickstart === "reset") state.quickstart = "reset";

  const modal = params.get("modal");
  if (modal === "hierarchy" || modal === "settings") state.modal = modal;
  else if (modal === "" || modal === "none" || modal === "0") state.modal = null;

  const q = params.get("q");
  if (q !== null) state.q = q;

  const edit = params.get("edit");
  if (edit !== null) state.edit = edit;

  const tour = params.get("tour");
  if (tour !== null && tour !== "") state.tour = tour;

  return state;
}

/**
 * Serializes a `LookBaseUrlState` into a deterministic, canonical query string (without leading `?`).
 */
export function serializeLookBaseUrlState(state: LookBaseUrlState): string {
  const params = new URLSearchParams();
  if (state.version) params.set("version", state.version);
  if (state.timeframe) params.set("timeframe", state.timeframe);
  if (state.source) params.set("source", state.source);
  if (state.year) params.set("year", state.year);
  if (state.hierarchy) params.set("hierarchy", state.hierarchy);
  if (state.member) params.set("member", state.member);
  if (state.expanded && state.expanded.length > 0) {
    params.set("expanded", state.expanded.join(","));
  }
  if (state.metrics && state.metrics.length > 0) {
    params.set("metrics", state.metrics.join(","));
  }
  if (state.pane !== undefined) {
    params.set("pane", state.pane ? "1" : "0");
  }
  if (state.quickstart) {
    params.set("quickstart", state.quickstart);
  }
  if (state.modal === "hierarchy" || state.modal === "settings") {
    params.set("modal", state.modal);
  }
  if (state.q) {
    params.set("q", state.q);
  }
  if (state.edit) {
    params.set("edit", state.edit);
  }
  if (state.tour) {
    params.set("tour", state.tour);
  }
  return params.toString();
}

function normalizeIdList(raw?: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((v) => String(v ?? "").trim())
        .filter((v) => v.length > 0),
    ),
  );
}

/**
 * Normalizes a partial `LookBaseSettingsConfig` with safe defaults.
 */
export function normalizeLookBaseSettings(
  raw?: Partial<LookBaseSettingsConfig> | null,
): Required<LookBaseSettingsConfig> {
  return {
    restrict_settings: Boolean(raw?.restrict_settings ?? false),
    settings_group_ids: normalizeIdList(raw?.settings_group_ids),
    settings_user_ids: normalizeIdList(raw?.settings_user_ids),
    restrict_rebuild_cube: Boolean(raw?.restrict_rebuild_cube ?? false),
    rebuild_cube_group_ids: normalizeIdList(raw?.rebuild_cube_group_ids),
    rebuild_cube_user_ids: normalizeIdList(raw?.rebuild_cube_user_ids),
  };
}

/**
 * Checks whether the current Looker user has the built-in Looker Admin role (`role_id === "2"`),
 * matching `lkrdev/explore-blending`'s `me?.data?.role_ids?.includes('2')`.
 */
export function isLookerAdminUser(user?: LookBaseCurrentUser | null): boolean {
  if (!user || !Array.isArray(user.role_ids)) return false;
  return user.role_ids.some((r) => String(r).trim() === "2");
}

/**
 * Checks whether `user` matches any of the allowed Looker Group IDs or allowed User IDs / Emails.
 */
export function checkUserMatchesAccessGrant(
  user: LookBaseCurrentUser | null | undefined,
  allowedGroupIds: string[] = [],
  allowedUserIds: string[] = [],
): boolean {
  if (!user) return false;
  const userGroups = new Set(
    (user.group_ids || []).map((g) => String(g).trim()).filter(Boolean),
  );
  for (const gid of allowedGroupIds || []) {
    if (userGroups.has(String(gid).trim())) return true;
  }

  const uid = user.id != null ? String(user.id).trim().toLowerCase() : "";
  const email = user.email ? String(user.email).trim().toLowerCase() : "";
  for (const rawAllowed of allowedUserIds || []) {
    const allowed = String(rawAllowed).trim().toLowerCase();
    if (!allowed) continue;
    if ((uid && allowed === uid) || (email && allowed === email)) {
      return true;
    }
  }
  return false;
}

/**
 * Determines whether the current user can view and edit Configuration Settings
 * (`lkrdev/explore-blending` `can_update_settings` pattern).
 */
export function canUserUpdateSettings(
  user: LookBaseCurrentUser | null | undefined,
  settings?: LookBaseSettingsConfig | null,
): boolean {
  const norm = normalizeLookBaseSettings(settings);
  if (!norm.restrict_settings) return true;
  if (isLookerAdminUser(user)) return true;
  return checkUserMatchesAccessGrant(
    user,
    norm.settings_group_ids,
    norm.settings_user_ids,
  );
}

/**
 * Determines whether the current user can view and trigger `Rebuild Cube` (`Calc All` / `Calc Sales PDT`).
 */
export function canUserRebuildCube(
  user: LookBaseCurrentUser | null | undefined,
  settings?: LookBaseSettingsConfig | null,
): boolean {
  const norm = normalizeLookBaseSettings(settings);
  if (!norm.restrict_rebuild_cube) return true;
  if (isLookerAdminUser(user)) return true;
  return checkUserMatchesAccessGrant(
    user,
    norm.rebuild_cube_group_ids,
    norm.rebuild_cube_user_ids,
  );
}

/**
 * Validates `LookBaseSettingsConfig` before saving (preventing non-admin self-lockout when enabling `restrict_settings`).
 */
export function validateLookBaseSettings(
  values: LookBaseSettingsConfig,
  user?: LookBaseCurrentUser | null,
): { settings_access_error?: string } {
  const norm = normalizeLookBaseSettings(values);
  if (norm.restrict_settings && !isLookerAdminUser(user)) {
    const canStillEdit = checkUserMatchesAccessGrant(
      user,
      norm.settings_group_ids,
      norm.settings_user_ids,
    );
    if (!canStillEdit) {
      const uidInfo = user?.id != null ? String(user.id) : "unknown";
      const groupsInfo =
        Array.isArray(user?.group_ids) && user!.group_ids!.length > 0
          ? user!.group_ids!.join(", ")
          : "none";
      return {
        settings_access_error: `Unable to update Restrict Settings Access because your user is not in the Allowed Group IDs / User IDs and is not an Admin. Your User ID is ${uidInfo} and your current Group IDs are: ${groupsInfo}`,
      };
    }
  }
  return {};
}

export interface BIEngineCandidateTable {
  viewName: string;
  label: string;
  category: "base_pdt" | "hierarchy_pdt" | "measure_pdt" | "shared_version";
  fullTableName: string;
  datasetTable: string;
}

export const LOOKBASE_SHARED_PDT_CATALOG: Array<{
  viewName: string;
  label: string;
  category: BIEngineCandidateTable["category"];
}> = [
  { viewName: "long_metrics_base", label: "Combined Base Cube PDT", category: "base_pdt" },
  { viewName: "dim_product_hierarchy", label: "Recursive Product Hierarchy PDT", category: "hierarchy_pdt" },
  { viewName: "stacked_total_sale_price", label: "Total Sale Price Stacked PDT", category: "measure_pdt" },
  { viewName: "stacked_total_gross_margin", label: "Total Gross Margin Stacked PDT", category: "measure_pdt" },
  { viewName: "metric_total_sale_price", label: "Sale Price Daily Window PDT", category: "measure_pdt" },
  { viewName: "metric_total_sale_price_month_aggregated", label: "Sale Price Monthly Window PDT", category: "measure_pdt" },
  { viewName: "metric_total_sale_price_quarter_aggregated", label: "Sale Price Quarterly Window PDT", category: "measure_pdt" },
  { viewName: "metric_total_gross_margin", label: "Gross Margin Daily Window PDT", category: "measure_pdt" },
  { viewName: "metric_total_gross_margin_month_aggregated", label: "Gross Margin Monthly Window PDT", category: "measure_pdt" },
  { viewName: "metric_total_gross_margin_quarter_aggregated", label: "Gross Margin Quarterly Window PDT", category: "measure_pdt" },
];

/**
 * Parses Looker-generated SQL comments (`-- use existing <view> in \`project.dataset.table\``)
 * and `FROM \`project.dataset.table\`` clauses to extract physical BigQuery PDT table names,
 * strictly excluding any non-shared personal sandbox tables (`*sandbox*`).
 */
export function parseBiEngineTablesFromGeneratedSql(
  sqlTexts: string[],
): { projectId: string; byView: Record<string, { fullTableName: string; datasetTable: string }> } {
  let projectId = "looker-private-demo";
  const byView: Record<string, { fullTableName: string; datasetTable: string }> = {};

  const commentRegex = /--\s*use existing\s+([a-zA-Z0-9_]+)\s+in\s+`?([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_$]+)`?/g;
  const backtickTableRegex = /`([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_]+)\.(LR[_$][a-zA-Z0-9_$]+)`/g;

  for (const sql of sqlTexts) {
    if (!sql || typeof sql !== "string") continue;
    let m: RegExpExecArray | null;
    commentRegex.lastIndex = 0;
    while ((m = commentRegex.exec(sql)) !== null) {
      const viewName = m[1];
      const proj = m[2];
      const dataset = m[3];
      const table = m[4];
      if (viewName.includes("sandbox") || table.includes("sandbox") || viewName === "long_metrics_overrides") {
        continue;
      }
      projectId = proj;
      byView[viewName] = {
        fullTableName: `${proj}.${dataset}.${table}`,
        datasetTable: `${dataset}.${table}`,
      };
    }

    backtickTableRegex.lastIndex = 0;
    while ((m = backtickTableRegex.exec(sql)) !== null) {
      const proj = m[1];
      const dataset = m[2];
      const table = m[3];
      if (table.includes("sandbox") || table.includes("long_metrics_overrides")) continue;
      projectId = proj;
      for (const item of LOOKBASE_SHARED_PDT_CATALOG) {
        if (table.endsWith(`_${item.viewName}`) && !byView[item.viewName]) {
          byView[item.viewName] = {
            fullTableName: `${proj}.${dataset}.${table}`,
            datasetTable: `${dataset}.${table}`,
          };
        }
      }
    }
  }

  return { projectId, byView };
}

/**
 * Builds the exact BigQuery `ALTER BI_CAPACITY ... SET OPTIONS (preferred_tables = [...])` DDL statement
 * for all shared LookBase PDT tables (excluding any non-shared personal sandboxes).
 */
export function buildAlterBiCapacitySql(
  projectId: string,
  tables: Array<Pick<BIEngineCandidateTable, "datasetTable" | "viewName">>,
  region = "us",
): string {
  const safeProject = (projectId || "looker-private-demo").trim();
  const safeRegion = (region || "us").trim().toLowerCase();
  const preferredTables = Array.from(
    new Set(
      tables
        .filter(
          (t) =>
            t.datasetTable &&
            !t.datasetTable.toLowerCase().includes("sandbox") &&
            !t.viewName.toLowerCase().includes("sandbox") &&
            t.viewName !== "long_metrics_overrides",
        )
        .map((t) => t.datasetTable.replace(/`/g, "").trim()),
    ),
  );

  const listLiteral = preferredTables.map((t) => `    '${t}'`).join(",\n");
  return [
    `ALTER BI_CAPACITY \`${safeProject}.region-${safeRegion}.default\``,
    `SET OPTIONS (`,
    `  preferred_tables = [`,
    listLiteral,
    `  ]`,
    `);`,
  ].join("\n");
}

/**
 * Discovers all LookBase shared PDT tables (`long_metrics_base`, `dim_product_hierarchy`,
 * `stacked_*`, and `metric_*`) via zero-cost `run_inline_query(result_format="sql")` calls
 * so the Settings screen can list all candidate tables before pinning them to BI Engine.
 */
export async function discoverBIEngineCandidateTables(
  core40SDK: any,
  model = "lookbase",
  calcConfig?: CalculationsConfig | null,
): Promise<{
  projectId: string;
  tables: BIEngineCandidateTable[];
  alterSql: string;
}> {
  const isCustom = isCustomCalculationsConfig(calcConfig);
  const customExplore = calcConfig?.explore || "long_metrics";
  const customMeasure =
    calcConfig?.measures?.[0]?.fieldName ||
    calcConfig?.measures?.[0]?.id ||
    `${customExplore}.count`;
  const probes: Array<{ view: string; field: string }> = isCustom
    ? [{ view: customExplore, field: customMeasure }]
    : [
        { view: "long_metrics", field: "long_metrics.total_sale_price" },
        { view: "stacked_total_sale_price", field: "stacked_total_sale_price.sum_value" },
        { view: "stacked_total_gross_margin", field: "stacked_total_gross_margin.sum_value" },
        { view: "metric_total_sale_price", field: "metric_total_sale_price.sum_value" },
        { view: "metric_total_gross_margin", field: "metric_total_gross_margin.sum_value" },
      ];

  const sqlOutputs: string[] = [];
  if (core40SDK && typeof core40SDK.run_inline_query === "function") {
    const settled = await Promise.all(
      probes.map(async (p) => {
        try {
          const res = await core40SDK.ok(
            core40SDK.run_inline_query({
              result_format: "sql",
              body: {
                model,
                view: p.view,
                fields: [p.field],
                limit: "1",
              },
            }),
          );
          return typeof res === "string" ? res : "";
        } catch {
          return "";
        }
      }),
    );
    sqlOutputs.push(...settled.filter(Boolean));
  }

  const { projectId, byView } = parseBiEngineTablesFromGeneratedSql(sqlOutputs);
  const defaultDataset = "lookerdemo_scratch";

  const tables: BIEngineCandidateTable[] = LOOKBASE_SHARED_PDT_CATALOG.map((entry) => {
    const resolved = byView[entry.viewName];
    const datasetTable = resolved?.datasetTable || `${defaultDataset}.${entry.viewName}`;
    const fullTableName = resolved?.fullTableName || `${projectId}.${datasetTable}`;
    return {
      viewName: entry.viewName,
      label: entry.label,
      category: entry.category,
      fullTableName,
      datasetTable,
    };
  });

  return {
    projectId,
    tables,
    alterSql: buildAlterBiCapacitySql(projectId, tables, "us"),
  };
}

/**
 * Deterministically maps a list of expanded `member_id`s (e.g. `["ROOT", "ALL", "DEPT:Men", "CAT:Men|Jeans"]`)
 * to their corresponding `ReportTable` subtotal paths (`["All Products", "All Products|Men", "All Products|Men|Jeans"]`),
 * including all ancestor paths so parent branches are unfolded too.
 */
export function deriveExpandedPathsFromMemberIds(
  expandedMemberIds: string[],
  memberIdToNode: Record<string, OutlineNodeMeta>,
  fallbackPaths: string[] = [],
  defaultRootLabel = "All Products",
): string[] {
  const paths = new Set<string>();
  const hasExplicitRootOnly =
    Array.isArray(expandedMemberIds) &&
    expandedMemberIds.length > 0 &&
    expandedMemberIds.every((id) => id === "ROOT");
  const inferredRoot =
    memberIdToNode["ALL"]?.label ||
    (fallbackPaths[0] ? String(fallbackPaths[0]).split("|")[0] : "") ||
    defaultRootLabel;
  for (const id of expandedMemberIds || []) {
    if (id === "ROOT") continue;
    const node = memberIdToNode[id];
    if (node && node.path) {
      const parts = node.path.split("|");
      for (let i = 1; i <= parts.length; i++) {
        paths.add(parts.slice(0, i).join("|"));
      }
    } else if (id === "ALL") {
      paths.add(inferredRoot);
    } else if (id.startsWith("DEPT:")) {
      const dept = id.slice("DEPT:".length);
      paths.add(inferredRoot);
      paths.add(`${inferredRoot}|${dept}`);
    } else if (
      id.startsWith("CAT:") ||
      id.startsWith("L3:") ||
      id.startsWith("L4:") ||
      id.startsWith("L5:")
    ) {
      const colonIdx = id.indexOf(":");
      const rest = id.slice(colonIdx + 1);
      const parts = [inferredRoot, ...rest.split("|")];
      for (let i = 1; i <= parts.length; i++) {
        paths.add(parts.slice(0, i).join("|"));
      }
    } else if (id.startsWith("BRAND:") || id.startsWith("HOTEL:")) {
      const colonIdx = id.indexOf(":");
      const rest = id.slice(colonIdx + 1);
      const brandParts = rest.split("|");
      if (brandParts.length > 1) {
        const catParts = [inferredRoot, ...brandParts.slice(0, -1)];
        for (let i = 1; i <= catParts.length; i++) {
          paths.add(catParts.slice(0, i).join("|"));
        }
      }
    }
  }
  if (paths.size === 0 && !hasExplicitRootOnly) {
    for (const fp of fallbackPaths) paths.add(fp);
  }
  return Array.from(paths);
}

/**
 * Escapes special characters in a single Looker string filter value so `run_inline_query`
 * compiles the filter to an exact SQL equality (`=`) / `IN (...)` predicate instead of a
 * wildcard `LIKE` or split OR clause.
 *
 * Looker string filter escape rules:
 * - Caret (`^`) is Looker's escape character -> `^^`
 * - Comma (`,`) separates multiple OR filter values -> `^,`
 * - Percent (`%`) is a multi-character wildcard -> `^%`
 * - Underscore (`_`) is a single-character wildcard (e.g. `Scarf_tradinginc`) -> `^_`
 * - Double quote (`"`) -> `^"`
 * - Leading hyphen (`-`) negates the filter (`NOT`) -> `^-`
 * - Reserved keywords `EMPTY` / `NULL` -> wrapped in double quotes (`"EMPTY"`, `"NULL"`)
 * - Single quotes (`'`, e.g. `Levi's`, `O'Neill`, `Arc'teryx`) and slashes (`/`, `\`, e.g. `F/X FUSION`)
 *   are literal in Looker filter expressions and escaped as `\'` / `\\` by Looker's SQL generator.
 */
export function escapeLookerFilterValue(value: string): string {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (!raw) return "";

  const upper = raw.trim().toUpperCase();
  if (upper === "EMPTY" || upper === "NULL") {
    return `"${raw}"`;
  }

  let escaped = raw
    .replace(/\^/g, "^^")
    .replace(/,/g, "^,")
    .replace(/%/g, "^%")
    .replace(/_/g, "^_")
    .replace(/"/g, '^"');

  if (escaped.startsWith("-")) {
    escaped = `^-${escaped.slice(1)}`;
  }
  if (escaped.startsWith(" ")) {
    escaped = `^ ${escaped.slice(1)}`;
  }
  if (escaped.endsWith(" ")) {
    escaped = `${escaped.slice(0, -1)}^ `;
  }
  return escaped;
}

/**
 * Builds a comma-separated Looker filter expression from an array of raw member IDs or dimension values,
 * escaping each individual value via `escapeLookerFilterValue`.
 */
export function buildLookerFilterExpression(values: string[]): string {
  const unique = Array.from(
    new Set(
      (values || [])
        .map((v) => (v === null || v === undefined ? "" : String(v)))
        .filter((v) => v.length > 0),
    ),
  );
  return unique.map(escapeLookerFilterValue).join(",");
}

export const DEFAULT_MODAL_UNFOLDED_IDS: string[] = ["ALL"];

export interface HierarchyStickyRowStyle {
  position: "relative" | "sticky";
  top?: number;
  zIndex?: number;
  height: number;
  boxSizing: "border-box";
  background: string;
}

/**
 * Computes deterministic sticky positioning styles for each level in the Hierarchy Modal:
 * - `L0` (`level === 0`): `position: "relative"` (not sticky; scrolls out of view)
 * - `L1` (`level === 1`): `position: "sticky", top: 0`
 * - `L2` (`level === 2`): `position: "sticky", top: rowHeight` (30px)
 * - `L3` (`level === 3`): `position: "sticky", top: rowHeight * 2` (60px)
 */
export function getHierarchyRowStickyStyle(
  level: number,
  rowHeight = 30,
): HierarchyStickyRowStyle {
  if (level <= 0) {
    return {
      position: "relative",
      height: rowHeight,
      boxSizing: "border-box",
      background: "#ffffff",
    };
  }
  return {
    position: "sticky",
    top: (level - 1) * rowHeight,
    zIndex: Math.max(5, 40 - level * 5),
    height: rowHeight,
    boxSizing: "border-box",
    background: level === 1 ? "#f1f5f9" : level === 2 ? "#f8fafc" : "#ffffff",
  };
}

/**
 * Computes `padding-left` in pixels as a strict multiple of `8px` (`stepPx = 16` by default)
 * for any hierarchy level `0..N`.
 */
export function getOutlineIndentationPx(level: number, stepPx = 16): number {
  const normalizedStep = Math.max(8, Math.round(stepPx / 8) * 8);
  return Math.max(0, level) * normalizedStep;
}

/**
 * Returns the visible hierarchy nodes in tree pre-order for the foldable Hierarchy Modal:
 * - By default (`unfoldedIds = ["ALL"]`), only `L0` (`All Products`) and `L1` (`Men`, `Women`) are visible.
 * - Unfolding `L1` (`DEPT:Men`) reveals its `L2` categories; unfolding `L2` (`CAT:Men|Jeans`) reveals its `L3` brands.
 * - When `searchQuery` is non-empty, returns all matching nodes plus their ancestor chain so context levels remain visible.
 */
export function getVisibleHierarchyModalNodes(
  allNodes: OutlineNodeMeta[],
  unfoldedIds: string[] = DEFAULT_MODAL_UNFOLDED_IDS,
  searchQuery = "",
): OutlineNodeMeta[] {
  const sorted = sortOutlineNodesTreeOrder(allNodes);
  const byId = new Map<string, OutlineNodeMeta>();
  for (const n of sorted) {
    byId.set(n.memberId, n);
  }

  const q = (searchQuery || "").trim().toLowerCase();
  if (q) {
    const matchedAndAncestors = new Set<string>();
    for (const n of sorted) {
      if (`${n.label} ${n.memberId} ${n.path}`.toLowerCase().includes(q)) {
        matchedAndAncestors.add(n.memberId);
        let currParent = n.parentId;
        while (currParent && currParent !== "ROOT") {
          matchedAndAncestors.add(currParent);
          const pNode = byId.get(currParent);
          currParent = pNode ? pNode.parentId : "";
        }
      }
    }
    return sorted.filter((n) => matchedAndAncestors.has(n.memberId));
  }

  const unfoldedSet = new Set(unfoldedIds);
  const isNodeVisible = (node: OutlineNodeMeta): boolean => {
    if (node.level <= 0 || node.parentId === "ROOT") return true;
    let currParentId = node.parentId;
    while (currParentId && currParentId !== "ROOT") {
      if (!unfoldedSet.has(currParentId)) return false;
      const parentNode = byId.get(currParentId);
      if (!parentNode) break;
      currParentId = parentNode.parentId;
    }
    return true;
  };

  return sorted.filter(isNodeVisible);
}

export type HierarchyTriState = "all" | "some" | "none";

const DAILY_ONLY_TIMEFRAMES = new Set(["ytd", "r7d", "r28d", "r90d", "rest_of_year"]);
const MONTHLY_ONLY_TIMEFRAMES = new Set(["r3m", "r6m", "r12m"]);
const QUARTERLY_ONLY_TIMEFRAMES = new Set(["r3q", "r6q", "r12q"]);

/**
 * Ensures `source` (Grain) and `timeframe` are always compatible so `long_metrics`
 * never returns 0 rows due to an invalid grain/timeframe combination (e.g. Monthly Actual + YTD).
 */
export function normalizeSourceAndTimeframe(
  source = "Daily Actual",
  timeframe = "ytd",
  changedField?: "source" | "timeframe",
): { source: string; timeframe: string } {
  if (changedField === "source") {
    if (source === "Monthly Actual" && DAILY_ONLY_TIMEFRAMES.has(timeframe)) {
      return { source, timeframe: "r12m" };
    }
    if (
      source === "Quarterly Actual" &&
      (DAILY_ONLY_TIMEFRAMES.has(timeframe) || MONTHLY_ONLY_TIMEFRAMES.has(timeframe))
    ) {
      return { source, timeframe: "current_view" };
    }
    if (
      source === "Daily Actual" &&
      (MONTHLY_ONLY_TIMEFRAMES.has(timeframe) || QUARTERLY_ONLY_TIMEFRAMES.has(timeframe))
    ) {
      return { source, timeframe: "ytd" };
    }
    return { source, timeframe };
  }

  if (DAILY_ONLY_TIMEFRAMES.has(timeframe) && source !== "Daily Actual") {
    return { source: "Daily Actual", timeframe };
  }
  if (MONTHLY_ONLY_TIMEFRAMES.has(timeframe) && source !== "Monthly Actual") {
    return { source: "Monthly Actual", timeframe };
  }
  if (QUARTERLY_ONLY_TIMEFRAMES.has(timeframe) && source !== "Quarterly Actual") {
    return { source: "Quarterly Actual", timeframe };
  }
  return { source, timeframe };
}

export function parseSdkJson(raw: any): any {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Sorts outline nodes in hierarchical pre-order (DFS by path) so every child and leaf
 * appears directly underneath its parent branch in the hierarchy modal.
 */
export function sortOutlineNodesTreeOrder(nodes: OutlineNodeMeta[]): OutlineNodeMeta[] {
  return [...nodes].sort((a, b) => {
    if (a.path === b.path) return a.level - b.level;
    const aParts = a.path.split("|");
    const bParts = b.path.split("|");
    const minLen = Math.min(aParts.length, bParts.length);
    for (let i = 0; i < minLen; i++) {
      if (aParts[i] !== bParts[i]) {
        return aParts[i].localeCompare(bParts[i]);
      }
    }
    return aParts.length - bParts.length;
  });
}

/**
 * Computes the triple-state ("all" | "some" | "none") for a node in the hierarchy tree:
 * - "all": this node AND all of its descendants (categories & brands) are selected/expanded
 * - "some": this node (or a subset of its descendants/brands) is selected/expanded
 * - "none": neither this node nor any of its descendants are selected/expanded
 */
export function getHierarchyNodeTriState(
  node: OutlineNodeMeta,
  allNodes: OutlineNodeMeta[],
  expandedMemberIds: string[],
): HierarchyTriState {
  const expandedSet = new Set((expandedMemberIds || []).filter((id) => id !== "ROOT"));

  if (node.isLeaf) {
    const siblings = allNodes.filter((n) => n.isLeaf && n.parentId === node.parentId);
    const hasExplicitSibling = siblings.some((s) => expandedSet.has(s.memberId));
    if (hasExplicitSibling) {
      return expandedSet.has(node.memberId) ? "all" : "none";
    }
    const ancestors = allNodes.filter(
      (n) => !n.isLeaf && (n.memberId === node.parentId || node.path.startsWith(n.path + "|")),
    );
    if (ancestors.length === 0) {
      return expandedSet.has(node.parentId) ? "all" : "none";
    }
    return ancestors.every((a) => expandedSet.has(a.memberId)) ? "all" : "none";
  }

  const subtreeNonLeaf = allNodes.filter(
    (n) => !n.isLeaf && (n.memberId === node.memberId || n.path.startsWith(node.path + "|")),
  );
  const subtreeLeaves = allNodes.filter(
    (n) => n.isLeaf && (n.parentId === node.memberId || n.path.startsWith(node.path + "|")),
  );
  const explicitSelectedLeaves = subtreeLeaves.filter((l) => expandedSet.has(l.memberId));

  if (subtreeNonLeaf.length <= 1) {
    // Leaf-parent category (e.g. L2 Category with L3 Brand children)
    if (explicitSelectedLeaves.length > 0) {
      return explicitSelectedLeaves.length >= subtreeLeaves.length ? "all" : "some";
    }
    return expandedSet.has(node.memberId) ? "all" : "none";
  }

  // Multi-level branch (e.g. L0 All Products or L1 Department)
  if (explicitSelectedLeaves.length > 0 && explicitSelectedLeaves.length < subtreeLeaves.length) {
    return "some";
  }

  const selectedCount = subtreeNonLeaf.filter((n) => expandedSet.has(n.memberId)).length;
  if (selectedCount === 0 || !expandedSet.has(node.memberId)) {
    return selectedCount > 0 || explicitSelectedLeaves.length > 0 ? "some" : "none";
  }
  if (selectedCount === subtreeNonLeaf.length) {
    return "all";
  }
  return "some";
}

/**
 * Transitions a hierarchy node across the triple-state cycle:
 * - For parent branches (L0, L1, or L2 categories with brand children):
 *   "none" -> "some" -> "all" -> "none"
 * - For individual L3 leaf brand nodes: toggles that brand and updates parent category to "some" / "all" / "none"
 * Or applies an explicit `targetState` ("all" | "some" | "none") when provided.
 */
export function toggleHierarchyNodeTriState(
  node: OutlineNodeMeta,
  allNodes: OutlineNodeMeta[],
  expandedMemberIds: string[],
  targetState?: HierarchyTriState,
): string[] {
  const expandedSet = new Set<string>(["ROOT", ...(expandedMemberIds || [])]);

  if (node.isLeaf) {
    const siblings = allNodes.filter((n) => n.isLeaf && n.parentId === node.parentId);
    const ancestors = allNodes.filter(
      (n) => !n.isLeaf && (n.memberId === node.parentId || node.path.startsWith(n.path + "|")),
    );
    const currentState = getHierarchyNodeTriState(node, allNodes, expandedMemberIds);
    const nextState: HierarchyTriState = targetState
      ? targetState
      : currentState === "all"
        ? "none"
        : "all";
    const hasExplicitSibling = siblings.some((s) => expandedSet.has(s.memberId));

    if (nextState === "none") {
      if (!hasExplicitSibling && currentState === "all") {
        for (const a of ancestors) expandedSet.add(a.memberId);
        for (const s of siblings) {
          if (s.memberId !== node.memberId) expandedSet.add(s.memberId);
        }
        if (siblings.length <= 1) {
          expandedSet.delete(node.parentId);
        }
      } else {
        expandedSet.delete(node.memberId);
        if (!siblings.some((s) => expandedSet.has(s.memberId))) {
          expandedSet.delete(node.parentId);
        }
      }
    } else {
      for (const a of ancestors) expandedSet.add(a.memberId);
      expandedSet.add(node.memberId);
      if (siblings.length > 0 && siblings.every((s) => expandedSet.has(s.memberId))) {
        for (const s of siblings) expandedSet.delete(s.memberId);
      }
    }
    return Array.from(expandedSet);
  }

  const subtreeNonLeaf = allNodes.filter(
    (n) => !n.isLeaf && (n.memberId === node.memberId || n.path.startsWith(node.path + "|")),
  );
  const subtreeLeaves = allNodes.filter(
    (n) => n.isLeaf && (n.parentId === node.memberId || n.path.startsWith(node.path + "|")),
  );
  const ancestors = allNodes.filter((n) => !n.isLeaf && node.path.startsWith(n.path + "|"));
  const currentState = getHierarchyNodeTriState(node, allNodes, expandedMemberIds);
  const canCycleSome = subtreeNonLeaf.length > 1 || subtreeLeaves.length > 1;

  let nextState: HierarchyTriState;
  if (targetState) {
    nextState = targetState;
  } else if (canCycleSome) {
    nextState = currentState === "none" ? "some" : currentState === "some" ? "all" : "none";
  } else {
    nextState = currentState === "all" ? "none" : "all";
  }

  for (const l of subtreeLeaves) {
    expandedSet.delete(l.memberId);
  }

  if (nextState === "none") {
    for (const s of subtreeNonLeaf) {
      expandedSet.delete(s.memberId);
    }
  } else if (nextState === "some") {
    for (const a of ancestors) {
      expandedSet.add(a.memberId);
    }
    expandedSet.add(node.memberId);
    if (subtreeNonLeaf.length > 1) {
      for (const s of subtreeNonLeaf) {
        if (s.memberId !== node.memberId) {
          expandedSet.delete(s.memberId);
        }
      }
    } else if (subtreeLeaves.length > 1) {
      const someCount = Math.min(2, Math.max(1, Math.floor(subtreeLeaves.length / 2)));
      for (const l of subtreeLeaves.slice(0, someCount)) {
        expandedSet.add(l.memberId);
      }
    }
  } else {
    for (const a of ancestors) {
      expandedSet.add(a.memberId);
    }
    for (const s of subtreeNonLeaf) {
      expandedSet.add(s.memberId);
    }
  }

  return Array.from(expandedSet);
}

export const PROJECT_CALCULATIONS_ARTIFACT_KEY = "lookbase_project_calculations";

/**
 * Wraps any Promise/thenable with a bounded timeout so unanswered Chatty/Extension Host calls
 * can never hang startup or UI operations indefinitely.
 */
export function withSdkTimeout<T>(
  promiseOrVal: Promise<T> | T,
  timeoutMs = 3000,
  fallbackValue: T,
): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallbackValue);
      }
    }, timeoutMs);

    Promise.resolve(promiseOrVal)
      .then((val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallbackValue);
        }
      });
  });
}

function normalizeParsedProjectCalculations(
  rawInput: any,
  projectId: string,
): CalculationsConfig | null {
  let parsed: any = parseSdkJson(rawInput);
  if (Array.isArray(parsed)) {
    parsed = parsed[0];
  }
  if (parsed && typeof parsed === "object" && parsed.value !== undefined && !parsed.lookbase_config_json && !parsed.hierarchies && !parsed.measures) {
    parsed = parseSdkJson(parsed.value);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  let embedded: Record<string, any> = {};
  if (typeof parsed.lookbase_config_json === "string") {
    try {
      embedded = JSON.parse(parsed.lookbase_config_json);
    } catch {
      embedded = {};
    }
  } else if (parsed.lookbase_config_json && typeof parsed.lookbase_config_json === "object") {
    embedded = parsed.lookbase_config_json;
  }
  const combined: Partial<CalculationsConfig> = {
    ...parsed,
    ...embedded,
  };
  const hasValidConfigContent = Boolean(
    (typeof parsed.lookbase_config_json === "string" && parsed.lookbase_config_json.length > 2) ||
      (parsed.lookbase_config_json && typeof parsed.lookbase_config_json === "object") ||
      (Array.isArray(combined.hierarchies) && combined.hierarchies.length > 0) ||
      (Array.isArray(combined.hierarchy) && combined.hierarchy.length > 0) ||
      (Array.isArray(combined.measures) && combined.measures.length > 0) ||
      (Array.isArray(combined.two_pass_metrics) && combined.two_pass_metrics.length > 0) ||
      (combined.accounts &&
        typeof combined.accounts === "object" &&
        Object.keys(combined.accounts).length > 0),
  );
  if (!hasValidConfigContent) return null;

  const isCustom =
    isCustomCalculationsConfig(combined as CalculationsConfig) ||
    Boolean(projectId && projectId !== "lookbase");
  if (isCustom) {
    return {
      model: combined.model || projectId,
      explore: combined.explore || "long_metrics",
      writeback_explore: combined.writeback_explore || "lookbase_writeback",
      base_pdt_view: combined.base_pdt_view || "long_metrics",
      field_discovery:
        combined.field_discovery || DEFAULT_CALCULATIONS_CONFIG.field_discovery,
      measure_pdt_views: combined.measure_pdt_views || {},
      settings: combined.settings || DEFAULT_LOOKBASE_SETTINGS,
      hierarchies: combined.hierarchies || [],
      measures: combined.measures || [],
      starter_outline: combined.starter_outline,
      _isCustomProjectConfig: true,
      initial_state: combined.initial_state || {},
      quick_start_actions: combined.quick_start_actions || [],
      parent_child_hierarchy:
        combined.parent_child_hierarchy ||
        DEFAULT_CALCULATIONS_CONFIG.parent_child_hierarchy,
      hierarchy: combined.hierarchy || [],
      accounts: combined.accounts || {},
      two_pass_metrics: combined.two_pass_metrics || [],
      column_calcs:
        combined.column_calcs || DEFAULT_CALCULATIONS_CONFIG.column_calcs,
      pinned_rows: combined.pinned_rows || [],
    };
  }
  return {
    ...DEFAULT_CALCULATIONS_CONFIG,
    ...combined,
  };
}

function extractCalculationConfigFromArtifactResponse(
  rawResp: any,
  projectId: string,
): CalculationsConfig | null {
  const unwrapped = parseSdkJson(rawResp);
  const items = Array.isArray(unwrapped)
    ? unwrapped
    : Array.isArray(unwrapped?.value)
      ? unwrapped.value
      : unwrapped
        ? [unwrapped]
        : [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    if (item.key && item.key !== PROJECT_CALCULATIONS_ARTIFACT_KEY) continue;
    const candidate = item.value !== undefined ? item.value : item;
    const resolved = normalizeParsedProjectCalculations(candidate, projectId);
    if (resolved) return resolved;
  }
  return null;
}

/**
 * Loads `calculations.strings.json` for the LookML project:
 * 1. First checks Looker's Artifact API (`core40SDK.artifact` / `core40SDK.search_artifacts`)
 *    and Extension Context Data (`extensionSDK.getContextData()`), which work in Production Mode across all users.
 * 2. Falls back to `GET /projects/:project_id/file/content?file_path=calculations.strings.json` via `invokeCoreSdk`.
 * 3. When a customer-specific `calculations.strings.json` is present (or `projectId !== "lookbase"`), returns the
 *    customer configuration without merging default e-commerce measures, accounts, or hierarchies.
 */
export async function loadProjectCalculations(
  extensionSDK: any,
  projectId = "lookbase",
  filePath = "calculations.strings.json",
  core40SDK?: any,
  artifactNamespace?: string,
): Promise<CalculationsConfig> {
  // 1. Try Looker Artifact API (works in Production Mode in Looker Extension Host without calling /projects/:id/file/content)
  if (core40SDK) {
    const nsToTry = Array.from(
      new Set(
        [artifactNamespace, `${projectId}::lookbase`, projectId].filter(Boolean) as string[],
      ),
    );
    for (const ns of nsToTry) {
      if (typeof core40SDK.artifact === "function") {
        try {
          const list = await withSdkTimeout(
            core40SDK.ok(
              core40SDK.artifact({ namespace: ns, key: PROJECT_CALCULATIONS_ARTIFACT_KEY }),
            ),
            8000,
            null,
          );
          const resolved = extractCalculationConfigFromArtifactResponse(list, projectId);
          if (resolved) return resolved;
        } catch {
          // continue to next source
        }
      }
      if (typeof core40SDK.search_artifacts === "function") {
        try {
          const list = await withSdkTimeout(
            core40SDK.ok(
              core40SDK.search_artifacts({ namespace: ns, key: PROJECT_CALCULATIONS_ARTIFACT_KEY }),
            ),
            4000,
            null,
          );
          const resolved = extractCalculationConfigFromArtifactResponse(list, projectId);
          if (resolved) return resolved;
        } catch {
          // continue to next source
        }
      }
    }
  }

  // 2. Try Extension Context Data
  if (extensionSDK) {
    try {
      const rawCtx =
        typeof extensionSDK.getContextData === "function"
          ? await withSdkTimeout(extensionSDK.getContextData(), 1500, null)
          : extensionSDK.lookerHostData?.contextData
            ? parseSdkJson(extensionSDK.lookerHostData.contextData)
            : null;
      const resolved = normalizeParsedProjectCalculations(rawCtx, projectId);
      if (resolved) return resolved;
    } catch {
      // continue to next source
    }
  }

  // 3. Try /projects/:project_id/file/content
  if (extensionSDK && typeof extensionSDK.invokeCoreSdk === "function") {
    try {
      const raw: any = await withSdkTimeout(
        extensionSDK.invokeCoreSdk(
          "GET",
          `/projects/${encodeURIComponent(projectId)}/file/content`,
          { file_path: filePath },
        ),
        3000,
        null,
      );
      if (raw && raw.ok !== false) {
        const body = raw?.ok !== undefined ? raw.value : raw;
        const resolved = normalizeParsedProjectCalculations(body, projectId);
        if (resolved) return resolved;
      }
    } catch {
      // ponytail: fallback when project file endpoint is unavailable in production extension host
    }
  }

  // 4. If running inside a non-`lookbase` project, never fall back to e-commerce model/measures
  if (projectId && projectId !== "lookbase") {
    return {
      model: projectId,
      explore: "long_metrics",
      writeback_explore: "lookbase_writeback",
      base_pdt_view: "long_metrics",
      field_discovery: DEFAULT_CALCULATIONS_CONFIG.field_discovery,
      measure_pdt_views: {},
      settings: DEFAULT_LOOKBASE_SETTINGS,
      hierarchies: [],
      measures: [],
      _isCustomProjectConfig: true,
      initial_state: {
        version: "base",
        timeframe: "ytd",
        source: "Daily Actual",
        year: "2025-03",
        grid_measures: [],
        left_hand_metrics: [],
      },
      quick_start_actions: [],
      parent_child_hierarchy: DEFAULT_CALCULATIONS_CONFIG.parent_child_hierarchy,
      hierarchy: [],
      accounts: {},
      two_pass_metrics: [],
      column_calcs: DEFAULT_CALCULATIONS_CONFIG.column_calcs,
      pinned_rows: [],
    };
  }

  return DEFAULT_CALCULATIONS_CONFIG;
}

export function formatEssbaseValue(value: number | null | undefined, formatStr = "$#,##0"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  try {
    return SSF.format(formatStr || "$#,##0", value);
  } catch {
    return value.toFixed(2);
  }
}

export const formatLookBaseValue = formatEssbaseValue;

export interface EvalContext {
  memberValues: Record<string, number>;
  parentValues?: Record<string, number>;
  totalValues?: Record<string, number>;
  pivotValues?: Record<string, number>;
  priorRowValues?: Record<string, number>[];
  hsCache?: Record<string, number>;
  accounts?: Record<string, { sign: number; format?: string }>;
}

/**
 * Zero-dependency multidimensional formula evaluator supporting:
 * - MEMBER('Account Name') (with unary account sign multiplier)
 * - PARENTVAL('Account Name') (looks up parent member's value via parent_id or parent path)
 * - TOTALVAL('Account Name')
 * - VAR('ColA', 'ColB') -> ColA - ColB
 * - VARPER('ColA', 'ColB') -> (ColA - ColB) / |ColB|
 * - PRIOR(n, 'Account Name')
 * - NULLIF(a, b)
 * - GETVALUE('measure', 'period', 'timeframe', 'dim=val', ...) (and legacy HSGETVALUE alias)
 */
export function evaluateEssbaseFormula(formula: string, ctx: EvalContext): number | null {
  if (!formula || typeof formula !== "string") return null;

  const getAccountSign = (name: string): number => ctx.accounts?.[name]?.sign ?? 1;

  const resolveMember = (name: string, bag?: Record<string, number>): number => {
    const raw = bag?.[name] ?? 0;
    return raw * getAccountSign(name);
  };

  // Handle direct VAR / VARPER expressions first
  const varPerMatch = formula.trim().match(/^VARPER\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)$/i);
  if (varPerMatch) {
    const a = ctx.pivotValues?.[varPerMatch[1]] ?? ctx.memberValues[varPerMatch[1]] ?? 0;
    const b = ctx.pivotValues?.[varPerMatch[2]] ?? ctx.memberValues[varPerMatch[2]] ?? 0;
    if (b === 0) return null;
    return (a - b) / Math.abs(b);
  }

  const varMatch = formula.trim().match(/^VAR\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)$/i);
  if (varMatch) {
    const a = ctx.pivotValues?.[varMatch[1]] ?? ctx.memberValues[varMatch[1]] ?? 0;
    const b = ctx.pivotValues?.[varMatch[2]] ?? ctx.memberValues[varMatch[2]] ?? 0;
    return a - b;
  }

  let expr = formula
    .replace(/(?:HS)?GETVALUE\(([^)]*)\)/gi, (_m, argsStr) => {
      const key = argsStr
        .split(",")
        .map((s: string) => s.trim().replace(/^['"]|['"]$/g, ""))
        .join("|");
      const val = ctx.hsCache?.[key];
      return Number.isFinite(val) ? String(val) : "0";
    })
    .replace(/MEMBER\(\s*['"]([^'"]+)['"]\s*\)/gi, (_m, name) =>
      String(resolveMember(name, ctx.memberValues)),
    )
    .replace(/PARENTVAL\(\s*['"]([^'"]+)['"]\s*\)/gi, (_m, name) =>
      String(resolveMember(name, ctx.parentValues)),
    )
    .replace(/TOTALVAL\(\s*['"]([^'"]+)['"]\s*\)/gi, (_m, name) =>
      String(resolveMember(name, ctx.totalValues)),
    )
    .replace(/PRIOR\(\s*(\d+)\s*(?:,\s*['"]([^'"]+)['"]\s*)?\)/gi, (_m, offsetStr, name) => {
      const idx = Math.max(0, parseInt(offsetStr, 10) - 1);
      const priorBag = ctx.priorRowValues?.[idx];
      if (!priorBag) return "0";
      const key = name || Object.keys(priorBag)[0] || "";
      return String(resolveMember(key, priorBag));
    });

  // Replace NULLIF(a, b)
  expr = expr.replace(/NULLIF\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, (_m, a, b) => {
    return `((${a}) === (${b}) ? NaN : (${a}))`;
  });

  // Safe arithmetic check: allow only numbers, NaN, parentheses, spaces, comparison & math operators
  if (!/^[0-9NaN+\-*/().\s=?:]+$/.test(expr)) {
    return null;
  }

  try {
    // ponytail: arithmetic expression is stripped to numeric literals and operators before evaluation
    const res = Function(`"use strict"; return (${expr});`)();
    return typeof res === "number" && Number.isFinite(res) ? res : null;
  } catch {
    return null;
  }
}

export const evaluateLookBaseFormula = evaluateEssbaseFormula;

export interface OutlineNodeMeta {
  memberId: string;
  parentId: string;
  label: string;
  path: string;
  level: number;
  isLeaf: boolean;
  rawRow: Record<string, any>;
}

/**
 * Extracts OutlineNodeMeta from a raw Looker query row using ParentChildHierarchyConfig.
 */
export function extractOutlineNode(
  row: Record<string, any>,
  pc: ParentChildHierarchyConfig,
): OutlineNodeMeta | null {
  const memberId = row?.[pc.memberIdField]?.value ?? row?.[pc.memberIdField];
  if (memberId === undefined || memberId === null || memberId === "") return null;
  const parentId = String(row?.[pc.parentIdField]?.value ?? row?.[pc.parentIdField] ?? "ROOT");
  const label = String(row?.[pc.labelField]?.value ?? row?.[pc.labelField] ?? memberId);
  const path = String(row?.[pc.pathField]?.value ?? row?.[pc.pathField] ?? label);
  const levelRaw = row?.[pc.levelField]?.value ?? row?.[pc.levelField] ?? 0;
  const level = typeof levelRaw === "number" ? levelRaw : parseInt(String(levelRaw), 10) || 0;
  const leafRaw = row?.[pc.isLeafField]?.value ?? row?.[pc.isLeafField];
  const isLeaf = leafRaw === true || leafRaw === "Yes" || leafRaw === "yes" || leafRaw === "true";

  return {
    memberId: String(memberId),
    parentId,
    label,
    path,
    level,
    isLeaf,
    rawRow: row,
  };
}

/**
 * Fetches immediate children of `parentMemberId` from Looker via `run_inline_query`
 * using the `parent_id` filter (`WHERE dim_product_hierarchy.parent_id = parentMemberId`).
 */
export async function fetchOutlineChildren(
  core40SDK: any,
  baseQuery: {
    model: string;
    view: string;
    fields: string[];
    pivots?: string[];
    filters?: Record<string, string>;
    sorts?: string[];
  },
  parentMemberId: string | string[],
  pcConfig: ParentChildHierarchyConfig,
): Promise<any[]> {
  const parentFilterExpr = Array.isArray(parentMemberId)
    ? buildLookerFilterExpression(parentMemberId)
    : parentMemberId.includes(",") && !parentMemberId.includes("^,")
      ? buildLookerFilterExpression(parentMemberId.split(","))
      : escapeLookerFilterValue(parentMemberId);
  if (!core40SDK || !parentFilterExpr) return [];
  const filters: Record<string, string> = {
    ...(baseQuery.filters || {}),
    [pcConfig.parentIdField]: parentFilterExpr,
  };
  delete filters[pcConfig.memberIdField];
  delete filters[pcConfig.levelField];

  const rawResponse = await core40SDK.ok(
    core40SDK.run_inline_query({
      result_format: "json_detail",
      body: {
        model: baseQuery.model,
        view: baseQuery.view,
        fields: baseQuery.fields,
        pivots: baseQuery.pivots || [],
        filters,
        sorts: baseQuery.sorts || [pcConfig.labelField],
        limit: "500",
      },
    }),
  );
  const response = parseSdkJson(rawResponse);

  return Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
      ? response
      : [];
}

const MEN_STARTER_CATEGORIES: Record<string, string[]> = {
  Accessories: ["Ray-Ban", "Oakley", "Fossil", "Timberland"],
  Active: ["Nike", "Adidas", "Under Armour", "Puma"],
  "Fashion Hoodies & Sweatshirts": ["Champion", "Carhartt", "Nike", "Tommy Hilfiger"],
  Jeans: ["7 For All Mankind", "Calvin Klein", "Diesel", "Levi's", "Lucky Brand", "True Religion", "Wrangler"],
  "Outerwear & Coats": ["Arc'teryx", "Carhartt", "Columbia", "Patagonia", "The North Face"],
  Pants: ["Dockers", "Haggar", "Levi's", "Perry Ellis"],
  Shorts: ["Billabong", "Hurley", "Nike", "Quiksilver"],
  "Sleep & Lounge": ["Calvin Klein", "Hanes", "Nautica", "Ralph Lauren"],
  Socks: ["Gold Toe", "Happy Socks", "Nike", "Smartwool"],
  "Suits & Sport Coats": ["Calvin Klein", "Hugo Boss", "Kenneth Cole", "Tommy Hilfiger"],
  Sweaters: ["Banana Republic", "Calvin Klein", "Lacoste", "Ralph Lauren"],
  Swim: ["Billabong", "O'Neill", "Quiksilver", "Speedo"],
  "Tops & Tees": ["Adidas", "Calvin Klein", "Hanes", "Lacoste", "Nike", "Ralph Lauren"],
  Underwear: ["Calvin Klein", "Fruit of the Loom", "Hanes", "Tommy John"],
};

const WOMEN_STARTER_CATEGORIES: Record<string, string[]> = {
  Accessories: ["Coach", "Kate Spade", "Michael Kors", "Ray-Ban"],
  Active: ["Adidas", "Lululemon", "Nike", "PUMA", "Under Armour"],
  "Blazers & Jackets": ["Anne Klein", "Calvin Klein", "Nine West", "Tahari"],
  "Clothing Sets": ["adidas", "Calvin Klein", "Juicy Couture"],
  Dresses: ["BCBGMAXAZRIA", "Calvin Klein", "Free People", "Guess", "Michael Kors", "Ralph Lauren"],
  "Fashion Hoodies & Sweatshirts": ["Adidas", "Champion", "Free People", "Nike"],
  Intimates: ["Bali", "Calvin Klein", "Hankanky Panky", "Maidenform", "Wacoal"],
  Jeans: ["7 For All Mankind", "Hudson", "Joe's Jeans", "Levi's", "Lucky Brand", "NYDJ", "PAIGE"],
  "Jumpsuits & Rompers": ["BB Dakota", "Free People", "Vince Camuto"],
  Leggings: ["Hue", "Lululemon", "Nike", "Spanx"],
  Maternity: ["Ingrid & Isabel", "Motherhood Maternity", "Pea in the Pod"],
  "Outerwear & Coats": ["Cole Haan", "Columbia", "London Fog", "Patagonia", "The North Face"],
  "Pants & Capris": ["Anne Klein", "Dockers", "Lee", "NYDJ"],
  Plus: ["Calvin Klein", "Lane Bryant", "Michael Kors", "NYDJ"],
  Shorts: ["Columbia", "Free People", "Levi's", "Nike"],
  Skirts: ["Anne Klein", "BCBGMAXAZRIA", "Calvin Klein", "Vince Camuto"],
  "Sleep & Lounge": ["Carole Hochman", "Eberjey", "PJ Salvage", "UGG"],
  "Socks & Hosiery": ["Hue", "Smartwool", "Spanx", "Wolford"],
  Suits: ["Anne Klein", "Calvin Klein", "Kasper", "Tahari"],
  Sweaters: ["Cashmere", "Free People", "Jessica Simpson", "Ralph Lauren"],
  Swim: ["La Blanca", "Roxy", "Seafolly", "Speedo", "TYR"],
  "Tops & Tees": ["Calvin Klein", "Free People", "Lucky Brand", "Michael Kors", "Vince"],
};

function buildStarterHierarchyCatalogNodes(): OutlineNodeMeta[] {
  const nodes: OutlineNodeMeta[] = [
    {
      memberId: "ALL",
      parentId: "ROOT",
      label: "All Products",
      path: "All Products",
      level: 0,
      isLeaf: false,
      rawRow: {},
    },
    {
      memberId: "DEPT:Men",
      parentId: "ALL",
      label: "Men",
      path: "All Products|Men",
      level: 1,
      isLeaf: false,
      rawRow: {},
    },
    {
      memberId: "DEPT:Women",
      parentId: "ALL",
      label: "Women",
      path: "All Products|Women",
      level: 1,
      isLeaf: false,
      rawRow: {},
    },
  ];

  const addDept = (dept: "Men" | "Women", catMap: Record<string, string[]>) => {
    for (const [cat, brands] of Object.entries(catMap)) {
      const catId = `CAT:${dept}|${cat}`;
      const catPath = `All Products|${dept}|${cat}`;
      nodes.push({
        memberId: catId,
        parentId: `DEPT:${dept}`,
        label: cat,
        path: catPath,
        level: 2,
        isLeaf: false,
        rawRow: {},
      });
      for (const brand of brands) {
        nodes.push({
          memberId: `BRAND:${dept}|${cat}|${brand}`,
          parentId: catId,
          label: brand,
          path: `${catPath}|${brand}`,
          level: 3,
          isLeaf: true,
          rawRow: {},
        });
      }
    }
  };

  addDept("Men", MEN_STARTER_CATEGORIES);
  addDept("Women", WOMEN_STARTER_CATEGORIES);
  return sortOutlineNodesTreeOrder(nodes);
}

export const STARTER_HIERARCHY_CATALOG_NODES: OutlineNodeMeta[] = buildStarterHierarchyCatalogNodes();

/**
 * Returns starter hierarchy nodes for `hierarchyId`.
 * - When `isCustomCalculationsConfig(calcConfig)` is `true`, synthesizes the root and initial L1
 *   branch nodes strictly from `calcConfig.hierarchies` (so default e-commerce nodes never appear).
 * - Only falls back to `STARTER_HIERARCHY_CATALOG_NODES` (`All Products`, `Men`, `Women`) when no
 *   customer `calculations.strings.json` is present.
 */
export function getStarterHierarchyNodesForId(
  hierarchyId = "product",
  calcConfig?: CalculationsConfig | null,
): OutlineNodeMeta[] {
  if (isCustomCalculationsConfig(calcConfig)) {
    const hDef =
      calcConfig?.hierarchies?.find((h) => h.id === hierarchyId) ||
      calcConfig?.hierarchies?.[0];
    if (!hDef) return [];
    const rootLabel = hDef.rootLabel || hDef.shortLabel || "Total";
    const nodes: OutlineNodeMeta[] = [
      {
        memberId: "ALL",
        parentId: "ROOT",
        label: rootLabel,
        path: rootLabel,
        level: 0,
        isLeaf: false,
        rawRow: {},
      },
    ];
    for (const id of hDef.defaultExpandedIds || []) {
      if (id === "ROOT" || id === "ALL") continue;
      const label = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
      nodes.push({
        memberId: id,
        parentId: "ALL",
        label,
        path: `${rootLabel}|${label}`,
        level: 1,
        isLeaf: false,
        rawRow: {},
      });
    }
    return sortOutlineNodesTreeOrder(nodes);
  }
  return STARTER_HIERARCHY_CATALOG_NODES;
}

/**
 * Asynchronously fetches immediate child nodes (`WHERE parent_id IN (...)`) for one or more
 * parent branches when unfolding `L1`, `L2`, etc. in the Hierarchy Selector Modal.
 */
export async function fetchHierarchyModalChildren(
  core40SDK: any,
  model = "lookbase",
  parentIds: string | string[],
  pcConfig: ParentChildHierarchyConfig = DEFAULT_CALCULATIONS_CONFIG.parent_child_hierarchy!,
  limit = 5000,
  hierarchyId?: string,
  calcConfig?: CalculationsConfig | null,
): Promise<OutlineNodeMeta[]> {
  const parentList = Array.isArray(parentIds) ? parentIds : [parentIds];
  const parentFilterExpr = buildLookerFilterExpression(parentList);
  if (!parentFilterExpr) return [];

  if (!core40SDK || typeof core40SDK.run_inline_query !== "function") {
    const parentSet = new Set(parentList);
    return getStarterHierarchyNodesForId(hierarchyId, calcConfig).filter((n) =>
      parentSet.has(n.parentId),
    );
  }

  const fields = [
    pcConfig.memberIdField,
    pcConfig.parentIdField,
    pcConfig.labelField,
    pcConfig.pathField,
    pcConfig.levelField,
    pcConfig.isLeafField,
  ];

  const isCustom = isCustomCalculationsConfig(calcConfig);
  const resolvedHierarchyId =
    isCustom &&
    calcConfig?.hierarchies?.length &&
    (!hierarchyId || !calcConfig.hierarchies.some((h) => h.id === hierarchyId))
      ? calcConfig.initial_state?.default_hierarchy || calcConfig.hierarchies[0].id
      : hierarchyId;
  const primaryExplore = calcConfig?.explore || "long_metrics";
  const runForView = async (viewName: string) => {
    const filters: Record<string, string> = {
      [pcConfig.parentIdField]: parentFilterExpr,
    };
    if (resolvedHierarchyId && resolvedHierarchyId !== "product") {
      filters["dim_product_hierarchy.hierarchy_id"] =
        escapeLookerFilterValue(resolvedHierarchyId);
    } else if (resolvedHierarchyId && isCustom) {
      filters["dim_product_hierarchy.hierarchy_id"] =
        escapeLookerFilterValue(resolvedHierarchyId);
    }
    const raw = await core40SDK.ok(
      core40SDK.run_inline_query({
        result_format: "json",
        body: {
          model,
          view: viewName,
          fields,
          filters,
          sorts: [pcConfig.levelField, pcConfig.labelField],
          limit: String(limit),
        },
      }),
    );
    const parsed = parseSdkJson(raw);
    return Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.data)
        ? parsed.data
        : [];
  };

  try {
    let rows = await runForView(primaryExplore);
    if (!rows.length && primaryExplore !== "dim_product_hierarchy") {
      rows = await runForView("dim_product_hierarchy");
    }
    const extracted: OutlineNodeMeta[] = [];
    for (const r of rows) {
      const node = extractOutlineNode(r, pcConfig);
      if (node) extracted.push(node);
    }
    if (extracted.length > 0) {
      return sortOutlineNodesTreeOrder(extracted);
    }
  } catch {
    try {
      const fallbackView =
        primaryExplore === "dim_product_hierarchy" ? "long_metrics" : "dim_product_hierarchy";
      const rows = await runForView(fallbackView);
      const extracted: OutlineNodeMeta[] = [];
      for (const r of rows) {
        const node = extractOutlineNode(r, pcConfig);
        if (node) extracted.push(node);
      }
      if (extracted.length > 0) {
        return sortOutlineNodesTreeOrder(extracted);
      }
    } catch {
      // fallback to starter catalog children
    }
  }

  const parentSet = new Set(parentList);
  return getStarterHierarchyNodesForId(hierarchyId, calcConfig).filter((n) =>
    parentSet.has(n.parentId),
  );
}

/**
 * Fetches the full `(member_id, parent_id, member_label, member_path, level_num, is_leaf)`
 * outline directory from Looker (`dim_product_hierarchy` explore, falling back to `long_metrics`)
 * for the specified `hierarchyId`.
 */
export async function fetchFullHierarchyCatalog(
  core40SDK: any,
  model = "lookbase",
  pcConfig: ParentChildHierarchyConfig = DEFAULT_CALCULATIONS_CONFIG.parent_child_hierarchy!,
  hierarchyId?: string,
  calcConfig?: CalculationsConfig | null,
): Promise<OutlineNodeMeta[]> {
  if (!core40SDK || typeof core40SDK.run_inline_query !== "function") {
    return getStarterHierarchyNodesForId(hierarchyId, calcConfig);
  }

  const fields = [
    pcConfig.memberIdField,
    pcConfig.parentIdField,
    pcConfig.labelField,
    pcConfig.pathField,
    pcConfig.levelField,
    pcConfig.isLeafField,
  ];

  const isCustom = isCustomCalculationsConfig(calcConfig);
  const resolvedHierarchyId =
    isCustom &&
    calcConfig?.hierarchies?.length &&
    (!hierarchyId || !calcConfig.hierarchies.some((h) => h.id === hierarchyId))
      ? calcConfig.initial_state?.default_hierarchy || calcConfig.hierarchies[0].id
      : hierarchyId;
  const activeHDef =
    calcConfig?.hierarchies?.find((h) => h.id === resolvedHierarchyId) ||
    calcConfig?.hierarchies?.[0];
  const isDeepHierarchy = (activeHDef?.levelLabels?.length || 4) >= 6;
  const primaryExplore = calcConfig?.explore || "long_metrics";

  const runForView = async (viewName: string, extraFilters?: Record<string, string>) => {
    const filters: Record<string, string> = {
      ...(isDeepHierarchy ? { [pcConfig.levelField]: "<=5" } : {}),
      ...(extraFilters || {}),
    };
    if (resolvedHierarchyId && resolvedHierarchyId !== "product") {
      filters["dim_product_hierarchy.hierarchy_id"] =
        escapeLookerFilterValue(resolvedHierarchyId);
    } else if (resolvedHierarchyId && isCustom) {
      filters["dim_product_hierarchy.hierarchy_id"] =
        escapeLookerFilterValue(resolvedHierarchyId);
    }
    const raw = await core40SDK.ok(
      core40SDK.run_inline_query({
        result_format: "json",
        body: {
          model,
          view: viewName,
          fields,
          filters,
          sorts: [pcConfig.levelField, pcConfig.labelField],
          limit: "5000",
        },
      }),
    );
    const parsed = parseSdkJson(raw);
    return Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.data)
        ? parsed.data
        : [];
  };

  try {
    let rows = await runForView(primaryExplore, {
      [pcConfig.levelField]: ">=0",
    });
    if (!rows.length && primaryExplore !== "dim_product_hierarchy") {
      rows = await runForView("dim_product_hierarchy");
    }
    const extracted: OutlineNodeMeta[] = [];
    for (const r of rows) {
      const node = extractOutlineNode(r, pcConfig);
      if (node) extracted.push(node);
    }
    if (extracted.length > 0) {
      return sortOutlineNodesTreeOrder(extracted);
    }
  } catch {
    try {
      const fallbackView =
        primaryExplore === "dim_product_hierarchy" ? "long_metrics" : "dim_product_hierarchy";
      const rows = await runForView(fallbackView);
      const extracted: OutlineNodeMeta[] = [];
      for (const r of rows) {
        const node = extractOutlineNode(r, pcConfig);
        if (node) extracted.push(node);
      }
      if (extracted.length > 0) {
        return sortOutlineNodesTreeOrder(extracted);
      }
    } catch {
      // fallback to starter catalog
    }
  }

  return getStarterHierarchyNodesForId(hierarchyId, calcConfig);
}

/**
 * Merges newly fetched child rows into existing outline rows, deduplicating by `member_id`.
 */
export function mergeOutlineRows(
  existingRows: Record<string, any>[],
  newChildRows: Record<string, any>[],
  pcConfig: ParentChildHierarchyConfig,
): Record<string, any>[] {
  const byId = new Map<string, Record<string, any>>();
  for (const r of existingRows) {
    const id = r?.[pcConfig.memberIdField]?.value ?? r?.[pcConfig.memberIdField];
    if (id != null) byId.set(String(id), r);
  }
  for (const r of newChildRows) {
    const id = r?.[pcConfig.memberIdField]?.value ?? r?.[pcConfig.memberIdField];
    if (id != null) byId.set(String(id), r);
  }
  return Array.from(byId.values());
}

export interface ProjectedOutlineResult {
  queryResponse: any;
  pathToNode: Record<string, OutlineNodeMeta>;
  memberIdToNode: Record<string, OutlineNodeMeta>;
}

/**
 * Ensures any Looker `QueryResponse` (including raw `run_inline_query` `json_detail` payloads)
 * has `fields.measure_like`, `fields.dimension_like`, `fields.pivots`, `fields.table_calculations`,
 * and `fields.supermeasure_like` populated as arrays so `ReportTable`'s `VisPluginTableModel`
 * never throws `Cannot read properties of undefined (reading 'forEach')`.
 */
export function normalizeQueryResponseFields(qr: any): any {
  if (!qr || typeof qr !== "object") return qr;
  const f = qr.fields || {};
  const rawDims: any[] = Array.isArray(f.dimension_like)
    ? f.dimension_like
    : Array.isArray(f.dimensions)
      ? f.dimensions
      : [];
  const rawMeasures: any[] = Array.isArray(f.measure_like)
    ? f.measure_like
    : Array.isArray(f.measures)
      ? f.measures
      : [];
  const tableCalcs: any[] = Array.isArray(f.table_calculations)
    ? f.table_calculations
    : [];
  const normalizedMeasures = rawMeasures.map((m: any) => ({
    ...m,
    is_numeric: m?.is_numeric ?? true,
  }));
  const measureLike = Array.isArray(f.measure_like)
    ? normalizedMeasures
    : [
        ...normalizedMeasures,
        ...tableCalcs.map((tc: any) => ({
          ...tc,
          is_table_calculation: tc?.is_table_calculation ?? true,
          is_numeric: tc?.is_numeric ?? true,
        })),
      ];
  const pivots: any[] = Array.isArray(f.pivots) ? f.pivots : [];
  const supermeasures: any[] = Array.isArray(f.supermeasure_like)
    ? f.supermeasure_like
    : Array.isArray(f.supermeasures)
      ? f.supermeasures
      : [];

  return {
    ...qr,
    sorts: Array.isArray(qr.sorts) ? qr.sorts : [],
    pivots: Array.isArray(qr.pivots) ? qr.pivots : [],
    fields: {
      ...f,
      dimension_like: rawDims,
      dimensions: Array.isArray(f.dimensions) ? f.dimensions : rawDims,
      measure_like: measureLike,
      measures: normalizedMeasures,
      table_calculations: tableCalcs,
      supermeasure_like: supermeasures,
      pivots,
    },
  };
}

/**
 * Projects flat `(member_id, parent_id, member_label, member_path, level_num, is_leaf)` rows
 * into a `QueryResponse` compatible with `viz-report-table`'s `<ReportTable />`
 * (`subtotalStyle: "collapsed"`, `subtotalsOnTop: true`, `indexColumn: true`) without
 * modifying a single line inside the `viz-report-table` submodule.
 */
export function projectOutlineRowsToReportTable(
  outlineRows: Record<string, any>[],
  baseQueryResponse: any,
  pcConfig: ParentChildHierarchyConfig,
  totalHierarchyDepth = 4,
  selectedMemberIds?: string[],
): ProjectedOutlineResult {
  const normalizedBase = normalizeQueryResponseFields(baseQueryResponse || {});
  const allExtractedNodes: OutlineNodeMeta[] = [];
  const pathToNode: Record<string, OutlineNodeMeta> = {};
  const memberIdToNode: Record<string, OutlineNodeMeta> = {};

  for (const row of outlineRows) {
    const node = extractOutlineNode(row, pcConfig);
    if (node) {
      allExtractedNodes.push(node);
      pathToNode[node.path] = node;
      memberIdToNode[node.memberId] = node;
    }
  }

  // If specific leaf nodes (e.g. `BRAND:Men|Jeans|Calvin Klein`) are selected for a category,
  // filter that category's leaves to only the selected leaves while keeping categories with no explicit leaf filter intact.
  const explicitLeafParentIds = new Set<string>();
  const explicitLeafIds = new Set<string>();
  if (Array.isArray(selectedMemberIds) && selectedMemberIds.length > 0) {
    for (const id of selectedMemberIds) {
      const matchingNode = memberIdToNode[id];
      if (matchingNode?.isLeaf) {
        explicitLeafIds.add(id);
        explicitLeafParentIds.add(matchingNode.parentId);
      } else if (id.startsWith("BRAND:")) {
        explicitLeafIds.add(id);
        const parts = id.slice("BRAND:".length).split("|");
        if (parts.length >= 2) {
          explicitLeafParentIds.add(`CAT:${parts[0]}|${parts[1]}`);
        }
      }
    }
  }

  const nodes = sortOutlineNodesTreeOrder(allExtractedNodes).filter((n) => {
    if (n.isLeaf && explicitLeafParentIds.has(n.parentId)) {
      return explicitLeafIds.has(n.memberId);
    }
    return true;
  });

  const maxDepth = Math.max(
    totalHierarchyDepth,
    nodes.reduce((acc, n) => Math.max(acc, n.level + 1), 2),
  );

  const syntheticDims = Array.from({ length: maxDepth }, (_, idx) => ({
    name: `__lookbase_lvl_${idx}`,
    label: idx === 0 ? "Outline Member" : `Level ${idx}`,
    short_label: idx === 0 ? "Outline Member" : `Level ${idx}`,
    type: "string",
    is_numeric: false,
  }));

  const subtotalsData: Record<string, any[]> = {};
  const leafDataRows: Record<string, any>[] = [];
  const parentPathsWithChildren = new Set<string>();

  for (const node of nodes) {
    const parts = node.path.split("|");
    if (parts.length > 1) {
      parentPathsWithChildren.add(parts.slice(0, -1).join("|"));
    }
  }

  const measureFields: any[] = Array.isArray(normalizedBase?.fields?.measure_like)
    ? normalizedBase.fields.measure_like
    : STARTER_OUTLINE_QUERY_RESPONSE.fields.measure_like;

  const pivotFields: Array<{ name: string }> = Array.isArray(normalizedBase?.fields?.pivots)
    ? normalizedBase.fields.pivots
    : [];
  const rawPivots: any[] = Array.isArray(normalizedBase?.pivots)
    ? normalizedBase.pivots
    : [];
  const timeframeOrderMap = new Map<string, number>(
    LOOKBASE_TIMEFRAME_OPTIONS.map((opt, i) => [opt.value.toLowerCase(), i]),
  );
  const normalizedPivots = rawPivots.map((p, idx) => {
    const sortValues: Record<string, any> = { ...(p?.sort_values || {}) };
    const metadata: Record<string, any> = { ...(p?.metadata || {}) };
    const data: Record<string, any> = { ...(p?.data || {}) };
    for (const pf of pivotFields) {
      const fName = pf.name;
      const fallbackVal = data[fName] ?? p?.key ?? String(idx);
      const renderedVal =
        fName === "long_metrics.timeframe"
          ? formatTimeframeLabel(String(fallbackVal))
          : String(fallbackVal);
      if (data[fName] === undefined) {
        data[fName] = fallbackVal;
      }
      if (fName === "long_metrics.timeframe") {
        const tfIdx = timeframeOrderMap.get(String(fallbackVal).toLowerCase());
        sortValues[fName] =
          tfIdx !== undefined
            ? `${String(tfIdx).padStart(2, "0")}_${String(fallbackVal)}`
            : String(fallbackVal);
      } else if (sortValues[fName] === undefined) {
        sortValues[fName] = fallbackVal;
      }
      metadata[fName] = {
        ...(metadata[fName] || {}),
        value: fallbackVal,
        rendered: renderedVal,
      };
    }
    return {
      ...p,
      data,
      sort_values: sortValues,
      metadata,
    };
  });

  const copyMeasures = (
    srcRow: Record<string, any>,
    targetRow: Record<string, any>,
    zeroOut = false,
  ) => {
    for (const m of measureFields) {
      const mName = m.name;
      if (normalizedPivots.length > 0) {
        const pivotCells: Record<string, any> = {};
        const srcMeasureObj = srcRow?.[mName];
        for (const p of normalizedPivots) {
          const pKey = p.key;
          if (zeroOut) {
            pivotCells[pKey] = { value: null, rendered: "" };
          } else if (srcMeasureObj && srcMeasureObj[pKey] !== undefined) {
            pivotCells[pKey] = JSON.parse(JSON.stringify(srcMeasureObj[pKey]));
          } else {
            pivotCells[pKey] = { value: null, rendered: "—" };
          }
        }
        targetRow[mName] = pivotCells;
      } else if (srcRow?.[mName] !== undefined) {
        targetRow[mName] = zeroOut
          ? { value: null, rendered: "" }
          : JSON.parse(JSON.stringify(srcRow[mName]));
      } else {
        targetRow[mName] = { value: null, rendered: zeroOut ? "" : "—" };
      }
    }
  };

  for (const node of nodes) {
    const parts = node.path.split("|");
    const depth = parts.length; // 1-based depth (1 = Root 'All Products', 2 = Dept 'Men', etc.)

    if (!node.isLeaf && depth < maxDepth) {
      const depthKey = String(depth);
      if (!subtotalsData[depthKey]) subtotalsData[depthKey] = [];
      const grouping = syntheticDims.slice(0, depth).map((d) => d.name);
      const subRow: Record<string, any> = {
        $$$__grouping__$$$: grouping,
        _member_id: node.memberId,
        _parent_id: node.parentId,
      };
      for (let i = 0; i < maxDepth; i++) {
        subRow[`__lookbase_lvl_${i}`] = {
          value: i < depth ? parts[i] : null,
          rendered: i < depth ? parts[i] : "",
        };
      }
      copyMeasures(node.rawRow, subRow, false);
      subtotalsData[depthKey].push(subRow);

      // If this non-leaf node has no loaded children yet, add a hidden placeholder leaf row
      // so VisPluginTableModel materializes the parent subtotal group with a [+] icon.
      if (!parentPathsWithChildren.has(node.path)) {
        const placeholderLeaf: Record<string, any> = {
          _is_placeholder: true,
          _parent_member_id: node.memberId,
        };
        for (let i = 0; i < maxDepth; i++) {
          const val = i < depth ? parts[i] : `(Expand ${node.label}...)`;
          placeholderLeaf[`__lookbase_lvl_${i}`] = { value: val, rendered: val };
        }
        copyMeasures(node.rawRow, placeholderLeaf, true);
        leafDataRows.push(placeholderLeaf);
      }
    } else {
      // Leaf node at maxDepth
      const leafRow: Record<string, any> = {
        _member_id: node.memberId,
        _parent_id: node.parentId,
      };
      for (let i = 0; i < maxDepth; i++) {
        const val = parts[i] ?? parts[parts.length - 1] ?? node.label;
        leafRow[`__lookbase_lvl_${i}`] = { value: val, rendered: val };
      }
      copyMeasures(node.rawRow, leafRow, false);
      leafDataRows.push(leafRow);
    }
  }

  const projectedQueryResponse = {
    ...normalizedBase,
    data: leafDataRows,
    subtotals_data: subtotalsData,
    pivots: normalizedPivots,
    sorts: pivotFields.map((pf) => ({ name: pf.name, desc: false })),
    fields: {
      ...(normalizedBase?.fields || {}),
      dimension_like: syntheticDims,
      dimensions: syntheticDims,
      measure_like: measureFields,
      measures: measureFields,
      table_calculations: Array.isArray(normalizedBase?.fields?.table_calculations)
        ? normalizedBase.fields.table_calculations
        : [],
      supermeasure_like: Array.isArray(normalizedBase?.fields?.supermeasure_like)
        ? normalizedBase.fields.supermeasure_like
        : [],
      pivots: pivotFields,
    },
  };

  return {
    queryResponse: projectedQueryResponse,
    pathToNode,
    memberIdToNode,
  };
}

/**
 * Multi-column level hierarchy fallback: fetches child rows for a parent path
 * when standard dimension columns (`dim_products.department`, `dim_products.category`, ...) are used.
 */
export async function fetchChildHierarchySlice(
  core40SDK: any,
  baseQuery: {
    model: string;
    view: string;
    fields: string[];
    pivots?: string[];
    filters?: Record<string, string>;
  },
  hierarchyDims: string[],
  parentPathStr: string,
): Promise<{ childDim: string; depth: number; rows: any[] } | null> {
  const pathParts = parentPathStr.split("|").filter(Boolean);
  const depth = pathParts.length;
  if (!core40SDK || depth === 0 || depth >= hierarchyDims.length) {
    return null;
  }

  const childDim = hierarchyDims[depth];
  const sliceFilters: Record<string, string> = { ...(baseQuery.filters || {}) };
  for (let i = 0; i < depth; i++) {
    sliceFilters[hierarchyDims[i]] = escapeLookerFilterValue(pathParts[i]);
  }

  const sliceFields = Array.from(
    new Set([...hierarchyDims.slice(0, depth + 1), ...baseQuery.fields]),
  );

  const response = await core40SDK.ok(
    core40SDK.run_inline_query({
      result_format: "json_detail",
      body: {
        model: baseQuery.model,
        view: baseQuery.view,
        fields: sliceFields,
        pivots: baseQuery.pivots || [],
        filters: sliceFilters,
        limit: "500",
      },
    }),
  );

  const rows = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
      ? response
      : [];

  return { childDim, depth, rows };
}

/**
 * Triggers an on-demand Looker PDT rebuild (`rebuild_pdts: true` on `run_inline_query`
 * or `start_pdt_build` for background materialization).
 */
export async function rebuildCubePdt(
  core40SDK: any,
  options: {
    model: string;
    view: string;
    fields?: string[];
    asyncBackground?: boolean;
  },
): Promise<{ status: string; materializationId?: string; rows?: any[] }> {
  if (!core40SDK) {
    return { status: "skipped" };
  }

  if (options.asyncBackground && typeof core40SDK.start_pdt_build === "function") {
    const res = await core40SDK.ok(
      core40SDK.start_pdt_build({
        model_name: options.model,
        view_name: options.view,
        force_rebuild: true,
      }),
    );
    return {
      status: "started",
      materializationId: res?.materialization_id,
    };
  }

  const fields = options.fields?.length ? options.fields : [`${options.view}.count`];
  const res = await core40SDK.ok(
    core40SDK.run_inline_query({
      result_format: "json",
      rebuild_pdts: true,
      cache: false,
      body: {
        model: options.model,
        view: options.view,
        fields,
        limit: "1",
      },
    }),
  );
  return {
    status: "completed",
    rows: Array.isArray(res) ? res : [],
  };
}

/**
 * Executes a zero-backend BigQuery `CLONE` or proportional delta `INSERT` writeback action
 * via the `lookbase_writeback` `create_process` explore.
 */
export async function executeEssbaseWriteback(
  core40SDK: any,
  model: string,
  writebackExplore: string,
  params: Record<string, string>,
): Promise<any> {
  if (!core40SDK) return null;
  const reqId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const filters: Record<string, string> = {
    [`${writebackExplore}.request_id`]: reqId,
  };
  for (const [k, v] of Object.entries(params)) {
    const qualifiedKey = k.includes(".") ? k : `${writebackExplore}.${k}`;
    filters[qualifiedKey] = String(v);
  }

  return core40SDK.ok(
    core40SDK.run_inline_query({
      result_format: "json",
      rebuild_pdts: true,
      cache: false,
      body: {
        model,
        view: writebackExplore,
        fields: [
          `${writebackExplore}.action_executed`,
          `${writebackExplore}.completed_at`,
        ],
        filters,
        limit: "1",
      },
    }),
  );
}

export const executeLookBaseWriteback = executeEssbaseWriteback;

/**
 * Restores a saved multi-branch outline expansion on initial load without querying the full
 * recursive hierarchy table at once (respecting Looker's row limits).
 *
 * Groups `["ROOT", "ALL", ...savedExpandedMemberIds]` into batches of `batchSize` parent IDs
 * and executes all batch `WHERE parent_id IN (...)` queries concurrently via `Promise.all` on load,
 * then merges and deduplicates all returned rows by `member_id`.
 */
export async function restoreSavedOutlineExpansion(
  core40SDK: any,
  baseQuery: {
    model: string;
    view: string;
    fields: string[];
    pivots?: string[];
    filters?: Record<string, string>;
    sorts?: string[];
  },
  savedExpandedMemberIds: string[],
  pcConfig: ParentChildHierarchyConfig,
  batchSize = 20,
): Promise<{
  rows: Record<string, any>[];
  fetchedParentIds: string[];
  batchCount: number;
}> {
  const roots = pcConfig.rootParentIds?.length ? pcConfig.rootParentIds : ["ROOT", "ALL"];
  const uniqueParents = Array.from(
    new Set(
      [...roots, ...(savedExpandedMemberIds || [])]
        .map((id) => String(id).trim())
        .filter(Boolean),
    ),
  );

  if (!core40SDK || uniqueParents.length === 0) {
    return { rows: [], fetchedParentIds: uniqueParents, batchCount: 0 };
  }

  const step = Math.max(1, batchSize);
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueParents.length; i += step) {
    chunks.push(uniqueParents.slice(i, i + step));
  }

  // Run all saved expansion chunks concurrently on load via Promise.all
  const batchResults = await Promise.all(
    chunks.map((chunk) =>
      fetchOutlineChildren(core40SDK, baseQuery, chunk, pcConfig),
    ),
  );

  let merged: Record<string, any>[] = [];
  for (const batchRows of batchResults) {
    merged = mergeOutlineRows(merged, batchRows, pcConfig);
  }

  return {
    rows: merged,
    fetchedParentIds: uniqueParents,
    batchCount: chunks.length,
  };
}

export interface AutocompleteItem {
  id: string;
  label: string;
  category: "measure" | "two_pass_calc" | "column_calc" | "member" | "custom_formula";
  formula?: string;
  fieldName?: string;
  format?: string;
  description?: string;
  level?: number;
}

/**
 * Builds the unified autocomplete catalog of LookML measures, two-pass calculations,
 * variance/column calculations, and hierarchy members for the Left-Hand Side combobox.
 */
export function buildAutocompleteCatalog(
  calcConfig: CalculationsConfig = DEFAULT_CALCULATIONS_CONFIG,
  availableMeasureFields: Array<{ name: string; label?: string; label_short?: string }> = [],
  loadedNodes: OutlineNodeMeta[] = [],
): AutocompleteItem[] {
  const items: AutocompleteItem[] = [];
  const seenIds = new Set<string>();

  const pushUnique = (item: AutocompleteItem) => {
    if (seenIds.has(item.id)) return;
    seenIds.add(item.id);
    items.push(item);
  };

  const isCustomConfig = isCustomCalculationsConfig(calcConfig);
  const configuredMeasures = Array.isArray(calcConfig?.measures)
    ? calcConfig.measures
    : [];

  // 1a. Customer-configured measures from calculations.strings.json (if present)
  for (const m of configuredMeasures) {
    const id = m.id || m.fieldName;
    if (!id) continue;
    const label = m.label || m.label_short || id;
    const fieldName = m.fieldName || id;
    pushUnique({
      id,
      label,
      category: "measure",
      fieldName,
      formula: m.formula || `MEMBER('${label.replace(/\s*\(LookML\)$/, "")}')`,
      format: m.format || m.value_format || "$#,##0",
      description: m.description || `Configured Measure · ${fieldName}`,
    });
  }

  // 1b. Built-in eCommerce Demo Measures (ONLY when no customer calculations.strings.json is present)
  if (!isCustomConfig) {
    const defaultMeasures: Array<{
      id: string;
      label: string;
      fieldName: string;
      format: string;
      desc: string;
    }> = [
      {
        id: "long_metrics.total_sale_price",
        label: "Total Sale Price",
        fieldName: "long_metrics.total_sale_price",
        format: "$#,##0",
        desc: "LookML Measure · Total Gross Revenue across selected period",
      },
      {
        id: "long_metrics.total_gross_margin",
        label: "Total Gross Margin",
        fieldName: "long_metrics.total_gross_margin",
        format: "$#,##0",
        desc: "LookML Measure · Total Gross Profit Margin",
      },
      {
        id: "long_metrics.gross_margin_percentage",
        label: "Gross Margin % (LookML)",
        fieldName: "long_metrics.gross_margin_percentage",
        format: "0.0%",
        desc: "LookML Measure · Native SQL Margin Ratio",
      },
      {
        id: "long_metrics.count",
        label: "Cube Row Count",
        fieldName: "long_metrics.count",
        format: "#,##0",
        desc: "LookML Measure · Number of underlying order records",
      },
    ];

    for (const m of defaultMeasures) {
      pushUnique({
        id: m.id,
        label: m.label,
        category: "measure",
        fieldName: m.fieldName,
        formula: `MEMBER('${m.label.replace(/\s*\(LookML\)$/, "")}')`,
        format: m.format,
        description: m.desc,
      });
    }
  }

  // 1c. Live Explore Measure Fields discovered from LookML model
  for (const mf of availableMeasureFields) {
    const label = mf.label_short || mf.label || mf.name;
    const isCountOrLocal =
      mf.name.includes("local") ||
      mf.name.includes("units") ||
      mf.name.includes("count") ||
      mf.name.includes("smart_reporting");
    pushUnique({
      id: mf.name,
      label,
      category: "measure",
      fieldName: mf.name,
      formula: `MEMBER('${label}')`,
      format:
        mf.value_format ||
        (label.includes("%") ? "0.0%" : isCountOrLocal ? "#,##0" : "$#,##0"),
      description: mf.description || `LookML Measure · ${mf.name}`,
    });
  }

  // 2. Two-Pass Calculations from calculations.strings.json (or eCommerce defaults)
  for (const tp of calcConfig.two_pass_metrics || []) {
    pushUnique({
      id: `calc:${tp.id}`,
      label: tp.label,
      category: "two_pass_calc",
      formula: tp.formula,
      format: tp.format || "0.0%",
      description: `Two-Pass Calc (Solve Order ${tp.solve_order ?? 2}) · ${tp.formula}`,
    });
  }

  // Extra eCommerce Demo Two-Pass Calcs (ONLY when no customer calculations.strings.json is present)
  if (!isCustomConfig) {
    const extraCalcs: Array<{
      id: string;
      label: string;
      formula: string;
      format: string;
      desc: string;
    }> = [
      {
        id: "calc:implied_cogs",
        label: "Implied COGS ($)",
        formula: "MEMBER('Total Sale Price') - MEMBER('Total Gross Margin')",
        format: "$#,##0",
        desc: "Derived Calculation · Revenue minus Gross Margin",
      },
      {
        id: "calc:margin_to_sales_ratio",
        label: "Contribution Margin Ratio (%)",
        formula: "MEMBER('Total Gross Margin') / MEMBER('Total Sale Price')",
        format: "0.0%",
        desc: "Two-Pass Ratio · Gross Margin divided by Sale Price",
      },
    ];
    for (const ec of extraCalcs) {
      pushUnique({
        id: ec.id,
        label: ec.label,
        category: "two_pass_calc",
        formula: ec.formula,
        format: ec.format,
        description: ec.desc,
      });
    }
  }

  // 3. Column / Variance Calculations
  for (const cc of calcConfig.column_calcs || []) {
    pushUnique({
      id: `colcalc:${cc.id}`,
      label: cc.label,
      category: "column_calc",
      formula: cc.formula,
      format: cc.format || "+$#,##0;($#,##0);$0",
      description: `Variance Calc · ${cc.formula}`,
    });
  }

  // 4. Loaded Outline Hierarchy Members
  const primaryMeasureLabel =
    configuredMeasures[0]?.label ||
    availableMeasureFields[0]?.label_short ||
    availableMeasureFields[0]?.label ||
    (isCustomConfig ? "Primary Measure" : "Total Sale Price");
  for (const node of loadedNodes) {
    pushUnique({
      id: `member:${node.memberId}`,
      label: node.label,
      category: "member",
      formula: `GETVALUE('${primaryMeasureLabel}', 'Current', 'ytd', '${node.memberId}')`,
      format: "$#,##0",
      description: `Outline Member (L${node.level}) · ${node.path}`,
      level: node.level,
    });
  }

  return items;
}

export const DEFAULT_AUTOCOMPLETE_MEMBER_LEVELS: number[] = [1];

export interface VirtualizedWindowSlice {
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetTop: number;
}

/**
 * Computes the virtualized window slice (`startIndex..endIndex`, `totalHeight`, `offsetTop`)
 * for the unlimited Left-Hand Side autocomplete dropdown list.
 */
export function getVirtualizedAutocompleteWindow(
  totalCount: number,
  scrollTop: number,
  viewportHeight = 320,
  itemHeight = 48,
  overscan = 5,
): VirtualizedWindowSlice {
  const safeCount = Math.max(0, totalCount);
  const safeHeight = Math.max(8, itemHeight);
  const totalHeight = safeCount * safeHeight;
  if (safeCount === 0) {
    return { startIndex: 0, endIndex: 0, totalHeight: 0, offsetTop: 0 };
  }
  const safeScrollTop = Math.max(0, scrollTop);
  const firstVisible = Math.floor(safeScrollTop / safeHeight);
  const visibleCount = Math.ceil(Math.max(safeHeight, viewportHeight) / safeHeight);
  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(safeCount, firstVisible + visibleCount + overscan);
  return {
    startIndex,
    endIndex,
    totalHeight,
    offsetTop: startIndex * safeHeight,
  };
}

/**
 * Filters and ranks autocomplete items for the Left-Hand Side metric/calculation combobox.
 * - Unlimited by default (`limit = Infinity`).
 * - When `allowedMemberLevels` is provided (e.g. `[1]` by default, expanded to `[1, 2, 3, ...]` via checkboxes),
 *   filters `category === "member"` items to those matching the selected hierarchy levels.
 * - Also supports typing ad-hoc formulas starting with `=` (e.g. `=MEMBER('Total Sale Price') * 1.1`).
 */
export function searchAutocompleteItems(
  query: string,
  catalog: AutocompleteItem[],
  limit = Infinity,
  allowedMemberLevels?: number[],
): AutocompleteItem[] {
  const levelSet =
    Array.isArray(allowedMemberLevels) ? new Set(allowedMemberLevels) : null;
  const filteredCatalog = levelSet
    ? catalog.filter(
        (item) =>
          item.category !== "member" ||
          levelSet.has(typeof item.level === "number" ? item.level : 1),
      )
    : catalog;

  const cap =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? limit
      : filteredCatalog.length + 1;

  const trimmed = (query || "").trim();
  if (!trimmed) {
    return filteredCatalog.slice(0, cap);
  }

  const results: AutocompleteItem[] = [];

  if (trimmed.startsWith("=")) {
    const rawExpr = trimmed.slice(1).trim();
    if (rawExpr) {
      results.push({
        id: `custom:${rawExpr}`,
        label: `Custom Formula: ${rawExpr}`,
        category: "custom_formula",
        formula: rawExpr,
        format: rawExpr.includes("/") || rawExpr.includes("VARPER") ? "0.0%" : "$#,##0",
        description: "Press Enter to add ad-hoc LookBase calculation row on the left-hand side",
      });
    }
  }

  const qLower = trimmed.toLowerCase();
  const tokens = qLower.split(/\s+/).filter(Boolean);

  const scored: Array<{ item: AutocompleteItem; score: number }> = [];
  for (const item of filteredCatalog) {
    const labelLower = item.label.toLowerCase();
    const idLower = item.id.toLowerCase();
    const formulaLower = (item.formula || "").toLowerCase();
    const descLower = (item.description || "").toLowerCase();
    const haystack = `${labelLower} ${idLower} ${formulaLower} ${descLower}`;

    if (!tokens.every((t) => haystack.includes(t))) continue;

    let score = 10;
    if (labelLower === qLower) score += 100;
    else if (labelLower.startsWith(qLower)) score += 60;
    else if (labelLower.includes(qLower)) score += 35;
    if (item.category === "measure" || item.category === "two_pass_calc") score += 15;

    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  for (const s of scored) {
    if (results.length >= cap) break;
    results.push(s.item);
  }

  return results;
}

/**
 * Evaluates a Left-Hand Side metric or calculation row for a specific Outline node & pivot period.
 */
export function evaluateLeftHandMetricRow(
  item: AutocompleteItem,
  node: OutlineNodeMeta | undefined,
  parentNode: OutlineNodeMeta | undefined,
  periodKey: string,
  calcConfig: CalculationsConfig = DEFAULT_CALCULATIONS_CONFIG,
  timeframeKey?: string,
): { value: number | null; formatted: string } {
  const row = node?.rawRow || {};
  const parentRow = parentNode?.rawRow || {};

  const resolveCell = (r: Record<string, any>, fieldName: string, pKey: string): any => {
    const fObj = r?.[fieldName];
    if (!fObj || typeof fObj !== "object") return fObj;
    if (timeframeKey && fObj[`${timeframeKey}|FIELD|${pKey}`] !== undefined) {
      return fObj[`${timeframeKey}|FIELD|${pKey}`];
    }
    if (fObj[pKey] !== undefined) return fObj[pKey];
    const matchKey = Object.keys(fObj).find((k) => k.endsWith(`|FIELD|${pKey}`));
    if (matchKey) return fObj[matchKey];
    return fObj;
  };

  const getRawMetric = (r: Record<string, any>, fieldName: string): number => {
    const cell = resolveCell(r, fieldName, periodKey);
    const v = cell?.value ?? cell;
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };

  if (item.category === "measure" && item.fieldName) {
    const directVal = getRawMetric(row, item.fieldName);
    const fmt = item.format || (item.fieldName.includes("percentage") ? "0.0%" : "$#,##0");
    return {
      value: directVal,
      formatted: formatEssbaseValue(directVal, fmt),
    };
  }

  const isCustomConfig = isCustomCalculationsConfig(calcConfig);
  const configuredMeasures = Array.isArray(calcConfig?.measures)
    ? calcConfig.measures
    : [];

  const memberValues: Record<string, number> = {};
  const parentValues: Record<string, number> = {};

  // Populate dynamic measure values from calcConfig.measures
  for (const m of configuredMeasures) {
    const fName = m.fieldName || m.id;
    if (!fName) continue;
    const valCur = getRawMetric(row, fName);
    const valPar = getRawMetric(parentRow, fName) || valCur;
    if (m.label) {
      memberValues[m.label] = valCur;
      parentValues[m.label] = valPar;
    }
    if (m.label_short) {
      memberValues[m.label_short] = valCur;
      parentValues[m.label_short] = valPar;
    }
    memberValues[fName] = valCur;
    parentValues[fName] = valPar;
  }

  // Also index any raw measure keys on row/parentRow directly
  for (const key of Object.keys(row)) {
    if (key.includes(".") && memberValues[key] === undefined) {
      const valCur = getRawMetric(row, key);
      const valPar = getRawMetric(parentRow, key) || valCur;
      memberValues[key] = valCur;
      parentValues[key] = valPar;
    }
  }

  const salePriceFallback = getRawMetric(row, "long_metrics.total_sale_price");
  const grossMarginFallback = getRawMetric(row, "long_metrics.total_gross_margin");
  const parentSalePriceFallback =
    getRawMetric(parentRow, "long_metrics.total_sale_price") || salePriceFallback;
  const parentGrossMarginFallback =
    getRawMetric(parentRow, "long_metrics.total_gross_margin") || grossMarginFallback;

  if (!isCustomConfig) {
    memberValues["Total Sale Price"] = salePriceFallback;
    memberValues["Total Gross Margin"] = grossMarginFallback;
    parentValues["Total Sale Price"] = parentSalePriceFallback;
    parentValues["Total Gross Margin"] = parentGrossMarginFallback;
  }

  const primaryFieldName =
    configuredMeasures[0]?.fieldName ||
    configuredMeasures[0]?.id ||
    "long_metrics.total_sale_price";
  const primaryVal = getRawMetric(row, primaryFieldName);
  const currentPrimary =
    resolveCell(row, primaryFieldName, "Current")?.value ?? primaryVal;
  const lyPrimary =
    resolveCell(row, primaryFieldName, "Last Year")?.value ?? 0;

  const val = evaluateEssbaseFormula(item.formula || "", {
    memberValues,
    parentValues,
    pivotValues: {
      Current: currentPrimary,
      "Last Year": lyPrimary,
    },
    accounts: calcConfig.accounts,
  });

  const fmt = item.format || "$#,##0";
  return {
    value: val,
    formatted: formatEssbaseValue(val, fmt),
  };
}

/**
 * Resolves the active Left-Hand Side metrics/calculations for a new user (from `initial_state.left_hand_metrics`
 * in `lookbase.config.json` / `calculations.strings.json`) or from a returning user's saved Looker Artifact.
 */
export function resolveInitialLeftHandMetrics(
  calcConfig: CalculationsConfig = DEFAULT_CALCULATIONS_CONFIG,
  catalog: AutocompleteItem[] = buildAutocompleteCatalog(calcConfig),
  userMetricIdsOverride?: string[],
): AutocompleteItem[] {
  const isCustomConfig = isCustomCalculationsConfig(calcConfig);
  const configuredInitialMetrics = calcConfig.initial_state?.left_hand_metrics;
  const rawTargetIds =
    userMetricIdsOverride && userMetricIdsOverride.length > 0
      ? userMetricIdsOverride
      : configuredInitialMetrics && configuredInitialMetrics.length > 0
        ? configuredInitialMetrics
        : isCustomConfig
          ? (calcConfig.measures || []).slice(0, 4).map((m) => m.id || m.fieldName)
          : DEFAULT_CALCULATIONS_CONFIG.initial_state?.left_hand_metrics || [
              "long_metrics.total_sale_price",
              "long_metrics.total_gross_margin",
              "calc:gm_pct",
              "calc:pct_of_parent",
              "calc:implied_cogs",
            ];
  const targetIds = Array.from(new Set(rawTargetIds));

  const byId = new Map<string, AutocompleteItem>();
  for (const item of catalog) {
    byId.set(item.id, item);
  }

  const resolved: AutocompleteItem[] = [];
  for (const id of targetIds) {
    const existing = byId.get(id);
    if (existing) {
      resolved.push(existing);
    } else if (id.startsWith("custom:")) {
      const expr = id.slice("custom:".length);
      resolved.push({
        id,
        label: `Custom Formula: ${expr}`,
        category: "custom_formula",
        formula: expr,
        format: expr.includes("/") || expr.includes("VARPER") ? "0.0%" : "$#,##0",
      });
    }
  }
  if (resolved.length === 0 && userMetricIdsOverride && userMetricIdsOverride.length > 0) {
    return resolveInitialLeftHandMetrics(calcConfig, catalog, undefined);
  }
  return resolved;
}

/**
 * Built-in eCommerce demo starter outline snapshot so LookBase renders a complete interactive
 * parent-child grid immediately when running in standalone eCommerce fallback mode (without a
 * customer-specific `calculations.strings.json`).
 */
export const STARTER_OUTLINE_QUERY_RESPONSE: any = {
  fields: {
    dimension_like: [
      { name: "dim_product_hierarchy.member_id", label: "Member ID", type: "string" },
      { name: "dim_product_hierarchy.parent_id", label: "Parent ID", type: "string" },
      { name: "dim_product_hierarchy.member_label", label: "Member Name", type: "string" },
      { name: "dim_product_hierarchy.member_path", label: "Member Path", type: "string" },
      { name: "dim_product_hierarchy.level_num", label: "Level", type: "number" },
      { name: "dim_product_hierarchy.is_leaf", label: "Is Leaf", type: "yesno" },
    ],
    measure_like: [
      {
        name: "long_metrics.total_sale_price",
        label: "Total Sale Price",
        label_short: "Total Sale Price",
        type: "number",
        is_numeric: true,
        value_format: "$#,##0",
      },
      {
        name: "long_metrics.total_gross_margin",
        label: "Total Gross Margin",
        label_short: "Total Gross Margin",
        type: "number",
        is_numeric: true,
        value_format: "$#,##0",
      },
      {
        name: "long_metrics.gross_margin_percentage",
        label: "Gross Margin % (LookML)",
        label_short: "Gross Margin %",
        type: "number",
        is_numeric: true,
        value_format: "0.0%",
      },
    ],
    pivots: [
      { name: "long_metrics.current_period", label: "Current Period", type: "string" },
    ],
  },
  pivots: [
    {
      key: "Current",
      data: { "long_metrics.current_period": "Current" },
      sort_values: { "long_metrics.current_period": "Current" },
      metadata: {
        "long_metrics.current_period": { value: "Current", rendered: "Current" },
      },
      is_total: false,
    },
    {
      key: "Last Year",
      data: { "long_metrics.current_period": "Last Year" },
      sort_values: { "long_metrics.current_period": "Last Year" },
      metadata: {
        "long_metrics.current_period": { value: "Last Year", rendered: "Last Year" },
      },
      is_total: false,
    },
  ],
  sorts: [],
  data: [
    {
      "dim_product_hierarchy.member_id": { value: "ALL" },
      "dim_product_hierarchy.parent_id": { value: "ROOT" },
      "dim_product_hierarchy.member_label": { value: "All Products" },
      "dim_product_hierarchy.member_path": { value: "All Products" },
      "dim_product_hierarchy.level_num": { value: 0 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": {
        Current: { value: 1842650, rendered: "$1,842,650" },
        "Last Year": { value: 1614900, rendered: "$1,614,900" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 958178, rendered: "$958,178" },
        "Last Year": { value: 823599, rendered: "$823,599" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.52, rendered: "52.0%" },
        "Last Year": { value: 0.51, rendered: "51.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "DEPT:Women" },
      "dim_product_hierarchy.parent_id": { value: "ALL" },
      "dim_product_hierarchy.member_label": { value: "Women" },
      "dim_product_hierarchy.member_path": { value: "All Products|Women" },
      "dim_product_hierarchy.level_num": { value: 1 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": {
        Current: { value: 984200, rendered: "$984,200" },
        "Last Year": { value: 861400, rendered: "$861,400" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 521626, rendered: "$521,626" },
        "Last Year": { value: 447928, rendered: "$447,928" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.53, rendered: "53.0%" },
        "Last Year": { value: 0.52, rendered: "52.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "DEPT:Men" },
      "dim_product_hierarchy.parent_id": { value: "ALL" },
      "dim_product_hierarchy.member_label": { value: "Men" },
      "dim_product_hierarchy.member_path": { value: "All Products|Men" },
      "dim_product_hierarchy.level_num": { value: 1 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": {
        Current: { value: 858450, rendered: "$858,450" },
        "Last Year": { value: 753500, rendered: "$753,500" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 436552, rendered: "$436,552" },
        "Last Year": { value: 375671, rendered: "$375,671" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.5085, rendered: "50.9%" },
        "Last Year": { value: 0.4986, rendered: "49.9%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "CAT:Women|Outerwear & Coats" },
      "dim_product_hierarchy.parent_id": { value: "DEPT:Women" },
      "dim_product_hierarchy.member_label": { value: "Outerwear & Coats" },
      "dim_product_hierarchy.member_path": { value: "All Products|Women|Outerwear & Coats" },
      "dim_product_hierarchy.level_num": { value: 2 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": {
        Current: { value: 342100, rendered: "$342,100" },
        "Last Year": { value: 289500, rendered: "$289,500" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 191576, rendered: "$191,576" },
        "Last Year": { value: 156330, rendered: "$156,330" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.56, rendered: "56.0%" },
        "Last Year": { value: 0.54, rendered: "54.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "CAT:Women|Dresses" },
      "dim_product_hierarchy.parent_id": { value: "DEPT:Women" },
      "dim_product_hierarchy.member_label": { value: "Dresses" },
      "dim_product_hierarchy.member_path": { value: "All Products|Women|Dresses" },
      "dim_product_hierarchy.level_num": { value: 2 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": {
        Current: { value: 278900, rendered: "$278,900" },
        "Last Year": { value: 251200, rendered: "$251,200" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 150606, rendered: "$150,606" },
        "Last Year": { value: 130624, rendered: "$130,624" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.54, rendered: "54.0%" },
        "Last Year": { value: 0.52, rendered: "52.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "CAT:Women|Sweaters" },
      "dim_product_hierarchy.parent_id": { value: "DEPT:Women" },
      "dim_product_hierarchy.member_label": { value: "Sweaters" },
      "dim_product_hierarchy.member_path": { value: "All Products|Women|Sweaters" },
      "dim_product_hierarchy.level_num": { value: 2 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": {
        Current: { value: 198400, rendered: "$198,400" },
        "Last Year": { value: 179300, rendered: "$179,300" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 99200, rendered: "$99,200" },
        "Last Year": { value: 87857, rendered: "$87,857" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.5, rendered: "50.0%" },
        "Last Year": { value: 0.49, rendered: "49.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "CAT:Men|Jeans" },
      "dim_product_hierarchy.parent_id": { value: "DEPT:Men" },
      "dim_product_hierarchy.member_label": { value: "Jeans" },
      "dim_product_hierarchy.member_path": { value: "All Products|Men|Jeans" },
      "dim_product_hierarchy.level_num": { value: 2 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": {
        Current: { value: 312450, rendered: "$312,450" },
        "Last Year": { value: 274800, rendered: "$274,800" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 162474, rendered: "$162,474" },
        "Last Year": { value: 140148, rendered: "$140,148" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.52, rendered: "52.0%" },
        "Last Year": { value: 0.51, rendered: "51.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "CAT:Men|Active" },
      "dim_product_hierarchy.parent_id": { value: "DEPT:Men" },
      "dim_product_hierarchy.member_label": { value: "Active" },
      "dim_product_hierarchy.member_path": { value: "All Products|Men|Active" },
      "dim_product_hierarchy.level_num": { value: 2 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": {
        Current: { value: 264800, rendered: "$264,800" },
        "Last Year": { value: 231100, rendered: "$231,100" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 135048, rendered: "$135,048" },
        "Last Year": { value: 113239, rendered: "$113,239" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.51, rendered: "51.0%" },
        "Last Year": { value: 0.49, rendered: "49.0%" },
      },
    },
  ],
};

/**
 * Returns the starter outline QueryResponse for a given `CalculationsConfig`:
 * - When `isCustomCalculationsConfig(calcConfig)` is `false` (no customer `calculations.strings.json`),
 *   returns Bryan's `STARTER_OUTLINE_QUERY_RESPONSE` (Default eCommerce Demo Fallbacks).
 * - When `isCustomCalculationsConfig(calcConfig)` is `true`, builds a customer-specific starter
 *   outline from `calcConfig.hierarchies` and `calcConfig.measures` so zero e-commerce nodes
 *   (`All Products`, `Men`, `Women`) or e-commerce measures (`Total Sale Price`, `Total Gross Margin`)
 *   ever appear in the UI.
 */
export function getStarterOutlineForConfig(
  calcConfig?: CalculationsConfig,
  hierarchyId?: string,
): any {
  if (!isCustomCalculationsConfig(calcConfig)) {
    return STARTER_OUTLINE_QUERY_RESPONSE;
  }
  const activeHierarchy =
    (calcConfig?.hierarchies || []).find((h) => h.id === hierarchyId) ||
    calcConfig?.hierarchies?.[0];
  const viewPrefix = activeHierarchy?.view || "dim_product_hierarchy";
  const starterNodes = getStarterHierarchyNodesForId(
    activeHierarchy?.id || hierarchyId || "product",
    calcConfig,
  );
  const configuredMeasures =
    calcConfig?.measures && calcConfig.measures.length > 0
      ? calcConfig.measures.map((m) => ({
          name: m.fieldName || m.id,
          label: m.label || m.label_short || m.id,
          label_short: m.label_short || m.label || m.id,
          type: "number",
          is_numeric: true,
          value_format: m.value_format || m.format || "$#,##0",
        }))
      : [];

  const data = starterNodes.map((node) => {
    const row: Record<string, any> = {
      [`${viewPrefix}.member_id`]: { value: node.memberId },
      [`${viewPrefix}.parent_id`]: { value: node.parentId },
      [`${viewPrefix}.member_label`]: { value: node.label },
      [`${viewPrefix}.member_path`]: { value: node.path },
      [`${viewPrefix}.level_num`]: { value: node.level },
      [`${viewPrefix}.is_leaf`]: { value: node.isLeaf ? "Yes" : "No" },
    };
    for (const m of configuredMeasures) {
      row[m.name] = {
        Current: { value: 0, rendered: formatEssbaseValue(0, m.value_format) },
        "Last Year": { value: 0, rendered: formatEssbaseValue(0, m.value_format) },
      };
    }
    return row;
  });

  return {
    fields: {
      dimension_like: [
        { name: `${viewPrefix}.member_id`, label: "Member ID", type: "string" },
        { name: `${viewPrefix}.parent_id`, label: "Parent ID", type: "string" },
        { name: `${viewPrefix}.member_label`, label: "Member Name", type: "string" },
        { name: `${viewPrefix}.member_path`, label: "Member Path", type: "string" },
        { name: `${viewPrefix}.level_num`, label: "Level", type: "number" },
        { name: `${viewPrefix}.is_leaf`, label: "Is Leaf", type: "yesno" },
      ],
      measure_like: configuredMeasures,
      pivots: [
        { name: "long_metrics.current_period", label: "Current Period", type: "string" },
      ],
    },
    pivots: [
      {
        key: "Current",
        data: { "long_metrics.current_period": "Current" },
        sort_values: { "long_metrics.current_period": "Current" },
        metadata: {
          "long_metrics.current_period": { value: "Current", rendered: "Current" },
        },
        is_total: false,
      },
      {
        key: "Last Year",
        data: { "long_metrics.current_period": "Last Year" },
        sort_values: { "long_metrics.current_period": "Last Year" },
        metadata: {
          "long_metrics.current_period": { value: "Last Year", rendered: "Last Year" },
        },
        is_total: false,
      },
    ],
    sorts: [],
    data,
  };
}
