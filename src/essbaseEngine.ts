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

export interface LookBaseUrlState {
  version?: string;
  timeframe?: string;
  source?: string;
  year?: string;
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
    year: "ALL",
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

  // Auto-build accounts map from discovered measures (reading value_format and optional lookbase:sign:-1 tag)
  const discoveredAccounts: Record<string, { sign: number; format?: string }> = {
    ...(baseConfig.accounts || {}),
  };
  for (const m of discoveredMeasures) {
    const label = String(m.label_short || m.label || m.name);
    const tags: string[] = Array.isArray(m.tags)
      ? m.tags.map((t: any) => String(t).toLowerCase())
      : [];
    const isNegative = tags.includes("lookbase:sign:-1") || tags.includes("sign:-1");
    const fmt =
      m.value_format ||
      (String(m.name).includes("percentage") || label.includes("%") ? "0.0%" : "$#,##0");
    if (!discoveredAccounts[label]) {
      discoveredAccounts[label] = {
        sign: isNegative ? -1 : 1,
        format: fmt,
      };
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

  const gridMeasures =
    baseConfig.initial_state?.grid_measures?.length
      ? baseConfig.initial_state.grid_measures
      : discoveredMeasureNames.length > 0
        ? discoveredMeasureNames
        : DEFAULT_CALCULATIONS_CONFIG.initial_state?.grid_measures || [];

  const defaultCalcIds = [
    ...(baseConfig.two_pass_metrics || []).map((tp) => `calc:${tp.id}`),
    "calc:implied_cogs",
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
    parent_child_hierarchy: pc,
    hierarchy:
      baseConfig.hierarchy?.length
        ? baseConfig.hierarchy
        : discoveredHierarchyDims.length > 0
          ? discoveredHierarchyDims
          : DEFAULT_CALCULATIONS_CONFIG.hierarchy,
    accounts: discoveredAccounts,
    initial_state: {
      ...DEFAULT_CALCULATIONS_CONFIG.initial_state,
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
): Promise<{
  projectId: string;
  tables: BIEngineCandidateTable[];
  alterSql: string;
}> {
  const probes: Array<{ view: string; field: string }> = [
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
): string[] {
  const paths = new Set<string>();
  const hasExplicitRootOnly =
    Array.isArray(expandedMemberIds) &&
    expandedMemberIds.length > 0 &&
    expandedMemberIds.every((id) => id === "ROOT");
  for (const id of expandedMemberIds || []) {
    if (id === "ROOT") continue;
    const node = memberIdToNode[id];
    if (node && node.path) {
      const parts = node.path.split("|");
      for (let i = 1; i <= parts.length; i++) {
        paths.add(parts.slice(0, i).join("|"));
      }
    } else if (id === "ALL") {
      paths.add("All Products");
    } else if (id.startsWith("DEPT:")) {
      const dept = id.slice("DEPT:".length);
      paths.add("All Products");
      paths.add(`All Products|${dept}`);
    } else if (id.startsWith("CAT:")) {
      const rest = id.slice("CAT:".length);
      const parts = ["All Products", ...rest.split("|")];
      for (let i = 1; i <= parts.length; i++) {
        paths.add(parts.slice(0, i).join("|"));
      }
    } else if (id.startsWith("BRAND:")) {
      const rest = id.slice("BRAND:".length);
      const brandParts = rest.split("|");
      // Parent category path is All Products | <Dept> | <Category>
      const catParts = ["All Products", ...brandParts.slice(0, -1)];
      for (let i = 1; i <= catParts.length; i++) {
        paths.add(catParts.slice(0, i).join("|"));
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

/**
 * Loads `calculations.strings.json` from the LookML project via Looker's internal core API
 * (`GET /projects/:project_id/file/content?file_path=calculations.strings.json`).
 */
export async function loadProjectCalculations(
  extensionSDK: any,
  projectId = "lookbase",
  filePath = "calculations.strings.json",
): Promise<CalculationsConfig> {
  if (!extensionSDK || typeof extensionSDK.invokeCoreSdk !== "function") {
    return DEFAULT_CALCULATIONS_CONFIG;
  }
  try {
    const raw = await extensionSDK.invokeCoreSdk(
      "GET",
      `/projects/${encodeURIComponent(projectId)}/file/content`,
      { file_path: filePath },
    );
    const body = raw?.ok !== undefined ? raw.value : raw;
    const parsed = typeof body === "string" ? JSON.parse(body) : body;
    if (parsed && typeof parsed === "object") {
      const embedded =
        typeof parsed.lookbase_config_json === "string"
          ? JSON.parse(parsed.lookbase_config_json)
          : {};
      return {
        ...DEFAULT_CALCULATIONS_CONFIG,
        ...parsed,
        ...embedded,
      };
    }
  } catch {
    // ponytail: fallback to built-in default config when project file is absent or user lacks develop permission
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
 * Asynchronously fetches immediate child nodes (`WHERE parent_id IN (...)`) for one or more
 * parent branches when unfolding `L1`, `L2`, etc. in the Jagged Hierarchy Modal, so even
 * hierarchies where `L1`/`L2`/`L3` exceed Looker's 5,000-row limit load cleanly on demand.
 */
export async function fetchHierarchyModalChildren(
  core40SDK: any,
  model = "lookbase",
  parentIds: string | string[],
  pcConfig: ParentChildHierarchyConfig = DEFAULT_CALCULATIONS_CONFIG.parent_child_hierarchy!,
  limit = 5000,
): Promise<OutlineNodeMeta[]> {
  const parentList = Array.isArray(parentIds) ? parentIds : [parentIds];
  const parentFilterExpr = buildLookerFilterExpression(parentList);
  if (!parentFilterExpr) return [];

  if (!core40SDK || typeof core40SDK.run_inline_query !== "function") {
    const parentSet = new Set(parentList);
    return STARTER_HIERARCHY_CATALOG_NODES.filter((n) => parentSet.has(n.parentId));
  }

  const fields = [
    pcConfig.memberIdField,
    pcConfig.parentIdField,
    pcConfig.labelField,
    pcConfig.pathField,
    pcConfig.levelField,
    pcConfig.isLeafField,
  ];

  const runForView = async (viewName: string) => {
    const raw = await core40SDK.ok(
      core40SDK.run_inline_query({
        result_format: "json",
        body: {
          model,
          view: viewName,
          fields,
          filters: {
            [pcConfig.parentIdField]: parentFilterExpr,
          },
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
    let rows = await runForView("dim_product_hierarchy");
    if (!rows.length) {
      rows = await runForView("long_metrics");
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
      const rows = await runForView("long_metrics");
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
  return STARTER_HIERARCHY_CATALOG_NODES.filter((n) => parentSet.has(n.parentId));
}

/**
 * Fetches the full `(member_id, parent_id, member_label, member_path, level_num, is_leaf)`
 * outline directory from Looker (`dim_product_hierarchy` explore, falling back to `long_metrics`)
 * so the Jagged Hierarchy Modal and Autocomplete display all 36 categories and 4,391 brands.
 */
export async function fetchFullHierarchyCatalog(
  core40SDK: any,
  model = "lookbase",
  pcConfig: ParentChildHierarchyConfig = DEFAULT_CALCULATIONS_CONFIG.parent_child_hierarchy!,
): Promise<OutlineNodeMeta[]> {
  if (!core40SDK || typeof core40SDK.run_inline_query !== "function") {
    return STARTER_HIERARCHY_CATALOG_NODES;
  }

  const fields = [
    pcConfig.memberIdField,
    pcConfig.parentIdField,
    pcConfig.labelField,
    pcConfig.pathField,
    pcConfig.levelField,
    pcConfig.isLeafField,
  ];

  const runForView = async (viewName: string, filters?: Record<string, string>) => {
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
    let rows = await runForView("dim_product_hierarchy");
    if (!rows.length) {
      rows = await runForView("long_metrics", {
        [pcConfig.levelField]: ">=0",
      });
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
      const rows = await runForView("long_metrics", {
        [pcConfig.levelField]: ">=0",
      });
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

  return STARTER_HIERARCHY_CATALOG_NODES;
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

  const measureFields: any[] =
    normalizedBase?.fields?.measure_like?.length > 0
      ? normalizedBase.fields.measure_like
      : STARTER_OUTLINE_QUERY_RESPONSE.fields.measure_like;

  const pivotFields: Array<{ name: string }> = Array.isArray(normalizedBase?.fields?.pivots)
    ? normalizedBase.fields.pivots
    : [];
  const rawPivots: any[] = Array.isArray(normalizedBase?.pivots)
    ? normalizedBase.pivots
    : [];
  const normalizedPivots = rawPivots.map((p, idx) => {
    const sortValues: Record<string, any> = { ...(p?.sort_values || {}) };
    const metadata: Record<string, any> = { ...(p?.metadata || {}) };
    const data: Record<string, any> = { ...(p?.data || {}) };
    for (const pf of pivotFields) {
      const fName = pf.name;
      const fallbackVal = data[fName] ?? p?.key ?? String(idx);
      if (data[fName] === undefined) {
        data[fName] = fallbackVal;
      }
      if (sortValues[fName] === undefined) {
        sortValues[fName] = fallbackVal;
      }
      if (metadata[fName] === undefined) {
        metadata[fName] = {
          value: fallbackVal,
          rendered: String(fallbackVal),
        };
      }
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
    sorts: [],
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

  // 1. Built-in / Explore LookML Measures
  const defaultMeasures: Array<{ id: string; label: string; fieldName: string; format: string; desc: string }> = [
    {
      id: "long_metrics.total_sale_price",
      label: "Total Sale Price",
      fieldName: "long_metrics.total_sale_price",
      format: "$#,##0",
      desc: "LookML Measure · SUM(value) WHERE metric = 'Total Sale Price'",
    },
    {
      id: "long_metrics.total_gross_margin",
      label: "Total Gross Margin",
      fieldName: "long_metrics.total_gross_margin",
      format: "$#,##0",
      desc: "LookML Measure · SUM(value) WHERE metric = 'Total Gross Margin'",
    },
    {
      id: "long_metrics.gross_margin_percentage",
      label: "Gross Margin % (LookML)",
      fieldName: "long_metrics.gross_margin_percentage",
      format: "0.0%",
      desc: "LookML Measure · total_gross_margin / NULLIF(total_sale_price, 0)",
    },
    {
      id: "long_metrics.count",
      label: "Cube Row Count",
      fieldName: "long_metrics.count",
      format: "#,##0",
      desc: "LookML Measure · COUNT(*)",
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

  for (const mf of availableMeasureFields) {
    const label = mf.label_short || mf.label || mf.name;
    pushUnique({
      id: mf.name,
      label,
      category: "measure",
      fieldName: mf.name,
      formula: `MEMBER('${label}')`,
      format: label.includes("%") ? "0.0%" : "$#,##0",
      description: `LookML Measure · ${mf.name}`,
    });
  }

  // 2. Two-Pass Calculations from calculations.strings.json
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

  // Additional built-in two-pass calculation presets
  const extraCalcs: AutocompleteItem[] = [
    {
      id: "calc:implied_cogs",
      label: "Implied Cost of Goods Sold (COGS)",
      category: "two_pass_calc",
      formula: "MEMBER('Total Sale Price') - MEMBER('Total Gross Margin')",
      format: "$#,##0",
      description: "Two-Pass Calc · Sales minus Gross Margin",
    },
    {
      id: "calc:margin_to_sales_ratio",
      label: "Markup on Cost %",
      category: "two_pass_calc",
      formula:
        "MEMBER('Total Gross Margin') / NULLIF(MEMBER('Total Sale Price') - MEMBER('Total Gross Margin'), 0)",
      format: "0.0%",
      description: "Two-Pass Calc · Gross Margin / Implied COGS",
    },
  ];
  for (const ec of extraCalcs) {
    pushUnique(ec);
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
  for (const node of loadedNodes) {
    pushUnique({
      id: `member:${node.memberId}`,
      label: node.label,
      category: "member",
      formula: `GETVALUE('Total Sale Price', 'Current', 'ytd', '${node.memberId}')`,
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
): { value: number | null; formatted: string } {
  const row = node?.rawRow || {};
  const parentRow = parentNode?.rawRow || {};

  const getRawMetric = (r: Record<string, any>, fieldName: string): number => {
    const cell = r?.[fieldName]?.[periodKey] ?? r?.[fieldName];
    const v = cell?.value ?? cell;
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };

  const sales = getRawMetric(row, "long_metrics.total_sale_price");
  const margin = getRawMetric(row, "long_metrics.total_gross_margin");
  const gmPct = getRawMetric(row, "long_metrics.gross_margin_percentage");
  const parentSales = getRawMetric(parentRow, "long_metrics.total_sale_price") || sales;
  const parentMargin = getRawMetric(parentRow, "long_metrics.total_gross_margin") || margin;

  if (item.category === "measure" && item.fieldName) {
    const directVal = getRawMetric(row, item.fieldName);
    const fmt = item.format || (item.fieldName.includes("percentage") ? "0.0%" : "$#,##0");
    return {
      value: directVal,
      formatted: formatEssbaseValue(directVal, fmt),
    };
  }

  const currentSales =
    row?.["long_metrics.total_sale_price"]?.Current?.value ?? sales;
  const lySales =
    row?.["long_metrics.total_sale_price"]?.["Last Year"]?.value ?? 0;

  const val = evaluateEssbaseFormula(item.formula || "", {
    memberValues: {
      "Total Sale Price": sales,
      "Total Gross Margin": margin,
      "Gross Margin %": gmPct,
    },
    parentValues: {
      "Total Sale Price": parentSales,
      "Total Gross Margin": parentMargin,
    },
    pivotValues: {
      Current: currentSales,
      "Last Year": lySales,
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
  const targetIds =
    userMetricIdsOverride && userMetricIdsOverride.length > 0
      ? userMetricIdsOverride
      : calcConfig.initial_state?.left_hand_metrics ||
        DEFAULT_CALCULATIONS_CONFIG.initial_state?.left_hand_metrics || [
          "long_metrics.total_sale_price",
          "long_metrics.total_gross_margin",
          "calc:gm_pct",
          "calc:pct_of_parent",
          "calc:implied_cogs",
        ];

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
  return resolved;
}

/**
 * Built-in starter outline snapshot across all 4 levels (L0 Root -> L1 Department -> L2 Category -> L3 Brand)
 * so LookBase renders a complete interactive parent-child grid immediately on initial open.
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
        label: "Gross Margin %",
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
        Current: { value: 1842500, rendered: "$1,842,500" },
        "Last Year": { value: 1590200, rendered: "$1,590,200" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 958100, rendered: "$958,100" },
        "Last Year": { value: 811002, rendered: "$811,002" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.52, rendered: "52.0%" },
        "Last Year": { value: 0.51, rendered: "51.0%" },
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
        Current: { value: 942100, rendered: "$942,100" },
        "Last Year": { value: 812400, rendered: "$812,400" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 499313, rendered: "$499,313" },
        "Last Year": { value: 422448, rendered: "$422,448" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.53, rendered: "53.0%" },
        "Last Year": { value: 0.52, rendered: "52.0%" },
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
        Current: { value: 900400, rendered: "$900,400" },
        "Last Year": { value: 777800, rendered: "$777,800" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 458787, rendered: "$458,787" },
        "Last Year": { value: 388554, rendered: "$388,554" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.51, rendered: "51.0%" },
        "Last Year": { value: 0.5, rendered: "50.0%" },
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
        Current: { value: 412000, rendered: "$412,000" },
        "Last Year": { value: 355000, rendered: "$355,000" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 222480, rendered: "$222,480" },
        "Last Year": { value: 188150, rendered: "$188,150" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.54, rendered: "54.0%" },
        "Last Year": { value: 0.53, rendered: "53.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "BRAND:Men|Jeans|Levi's" },
      "dim_product_hierarchy.parent_id": { value: "CAT:Men|Jeans" },
      "dim_product_hierarchy.member_label": { value: "Levi's" },
      "dim_product_hierarchy.member_path": { value: "All Products|Men|Jeans|Levi's" },
      "dim_product_hierarchy.level_num": { value: 3 },
      "dim_product_hierarchy.is_leaf": { value: "Yes" },
      "long_metrics.total_sale_price": {
        Current: { value: 168500, rendered: "$168,500" },
        "Last Year": { value: 145200, rendered: "$145,200" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 92675, rendered: "$92,675" },
        "Last Year": { value: 78408, rendered: "$78,408" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.55, rendered: "55.0%" },
        "Last Year": { value: 0.54, rendered: "54.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "BRAND:Men|Jeans|Calvin Klein" },
      "dim_product_hierarchy.parent_id": { value: "CAT:Men|Jeans" },
      "dim_product_hierarchy.member_label": { value: "Calvin Klein" },
      "dim_product_hierarchy.member_path": { value: "All Products|Men|Jeans|Calvin Klein" },
      "dim_product_hierarchy.level_num": { value: 3 },
      "dim_product_hierarchy.is_leaf": { value: "Yes" },
      "long_metrics.total_sale_price": {
        Current: { value: 112400, rendered: "$112,400" },
        "Last Year": { value: 96800, rendered: "$96,800" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 60696, rendered: "$60,696" },
        "Last Year": { value: 51304, rendered: "$51,304" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.54, rendered: "54.0%" },
        "Last Year": { value: 0.53, rendered: "53.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "BRAND:Men|Jeans|7 For All Mankind" },
      "dim_product_hierarchy.parent_id": { value: "CAT:Men|Jeans" },
      "dim_product_hierarchy.member_label": { value: "7 For All Mankind" },
      "dim_product_hierarchy.member_path": { value: "All Products|Men|Jeans|7 For All Mankind" },
      "dim_product_hierarchy.level_num": { value: 3 },
      "dim_product_hierarchy.is_leaf": { value: "Yes" },
      "long_metrics.total_sale_price": {
        Current: { value: 78100, rendered: "$78,100" },
        "Last Year": { value: 67000, rendered: "$67,000" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 41393, rendered: "$41,393" },
        "Last Year": { value: 34840, rendered: "$34,840" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.53, rendered: "53.0%" },
        "Last Year": { value: 0.52, rendered: "52.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "BRAND:Men|Jeans|Wrangler" },
      "dim_product_hierarchy.parent_id": { value: "CAT:Men|Jeans" },
      "dim_product_hierarchy.member_label": { value: "Wrangler" },
      "dim_product_hierarchy.member_path": { value: "All Products|Men|Jeans|Wrangler" },
      "dim_product_hierarchy.level_num": { value: 3 },
      "dim_product_hierarchy.is_leaf": { value: "Yes" },
      "long_metrics.total_sale_price": {
        Current: { value: 53000, rendered: "$53,000" },
        "Last Year": { value: 46000, rendered: "$46,000" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 27716, rendered: "$27,716" },
        "Last Year": { value: 23598, rendered: "$23,598" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.523, rendered: "52.3%" },
        "Last Year": { value: 0.513, rendered: "51.3%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "CAT:Men|Outerwear & Coats" },
      "dim_product_hierarchy.parent_id": { value: "DEPT:Men" },
      "dim_product_hierarchy.member_label": { value: "Outerwear & Coats" },
      "dim_product_hierarchy.member_path": { value: "All Products|Men|Outerwear & Coats" },
      "dim_product_hierarchy.level_num": { value: 2 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": {
        Current: { value: 530100, rendered: "$530,100" },
        "Last Year": { value: 457400, rendered: "$457,400" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 276833, rendered: "$276,833" },
        "Last Year": { value: 234298, rendered: "$234,298" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.522, rendered: "52.2%" },
        "Last Year": { value: 0.512, rendered: "51.2%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "BRAND:Men|Outerwear & Coats|The North Face" },
      "dim_product_hierarchy.parent_id": { value: "CAT:Men|Outerwear & Coats" },
      "dim_product_hierarchy.member_label": { value: "The North Face" },
      "dim_product_hierarchy.member_path": { value: "All Products|Men|Outerwear & Coats|The North Face" },
      "dim_product_hierarchy.level_num": { value: 3 },
      "dim_product_hierarchy.is_leaf": { value: "Yes" },
      "long_metrics.total_sale_price": {
        Current: { value: 245000, rendered: "$245,000" },
        "Last Year": { value: 211000, rendered: "$211,000" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 129850, rendered: "$129,850" },
        "Last Year": { value: 109720, rendered: "$109,720" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.53, rendered: "53.0%" },
        "Last Year": { value: 0.52, rendered: "52.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "BRAND:Men|Outerwear & Coats|Patagonia" },
      "dim_product_hierarchy.parent_id": { value: "CAT:Men|Outerwear & Coats" },
      "dim_product_hierarchy.member_label": { value: "Patagonia" },
      "dim_product_hierarchy.member_path": { value: "All Products|Men|Outerwear & Coats|Patagonia" },
      "dim_product_hierarchy.level_num": { value: 3 },
      "dim_product_hierarchy.is_leaf": { value: "Yes" },
      "long_metrics.total_sale_price": {
        Current: { value: 175100, rendered: "$175,100" },
        "Last Year": { value: 151400, rendered: "$151,400" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 91052, rendered: "$91,052" },
        "Last Year": { value: 77214, rendered: "$77,214" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.52, rendered: "52.0%" },
        "Last Year": { value: 0.51, rendered: "51.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "BRAND:Men|Outerwear & Coats|Columbia" },
      "dim_product_hierarchy.parent_id": { value: "CAT:Men|Outerwear & Coats" },
      "dim_product_hierarchy.member_label": { value: "Columbia" },
      "dim_product_hierarchy.member_path": { value: "All Products|Men|Outerwear & Coats|Columbia" },
      "dim_product_hierarchy.level_num": { value: 3 },
      "dim_product_hierarchy.is_leaf": { value: "Yes" },
      "long_metrics.total_sale_price": {
        Current: { value: 110000, rendered: "$110,000" },
        "Last Year": { value: 95000, rendered: "$95,000" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 55931, rendered: "$55,931" },
        "Last Year": { value: 47364, rendered: "$47,364" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.508, rendered: "50.8%" },
        "Last Year": { value: 0.499, rendered: "49.9%" },
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
        Current: { value: 485000, rendered: "$485,000" },
        "Last Year": { value: 410000, rendered: "$410,000" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 252200, rendered: "$252,200" },
        "Last Year": { value: 209100, rendered: "$209,100" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.52, rendered: "52.0%" },
        "Last Year": { value: 0.51, rendered: "51.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "BRAND:Women|Dresses|Calvin Klein" },
      "dim_product_hierarchy.parent_id": { value: "CAT:Women|Dresses" },
      "dim_product_hierarchy.member_label": { value: "Calvin Klein" },
      "dim_product_hierarchy.member_path": { value: "All Products|Women|Dresses|Calvin Klein" },
      "dim_product_hierarchy.level_num": { value: 3 },
      "dim_product_hierarchy.is_leaf": { value: "Yes" },
      "long_metrics.total_sale_price": {
        Current: { value: 265000, rendered: "$265,000" },
        "Last Year": { value: 224000, rendered: "$224,000" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 140450, rendered: "$140,450" },
        "Last Year": { value: 116480, rendered: "$116,480" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.53, rendered: "53.0%" },
        "Last Year": { value: 0.52, rendered: "52.0%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "BRAND:Women|Dresses|Ralph Lauren" },
      "dim_product_hierarchy.parent_id": { value: "CAT:Women|Dresses" },
      "dim_product_hierarchy.member_label": { value: "Ralph Lauren" },
      "dim_product_hierarchy.member_path": { value: "All Products|Women|Dresses|Ralph Lauren" },
      "dim_product_hierarchy.level_num": { value: 3 },
      "dim_product_hierarchy.is_leaf": { value: "Yes" },
      "long_metrics.total_sale_price": {
        Current: { value: 220000, rendered: "$220,000" },
        "Last Year": { value: 186000, rendered: "$186,000" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 111750, rendered: "$111,750" },
        "Last Year": { value: 92620, rendered: "$92,620" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.508, rendered: "50.8%" },
        "Last Year": { value: 0.498, rendered: "49.8%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "CAT:Women|Active" },
      "dim_product_hierarchy.parent_id": { value: "DEPT:Women" },
      "dim_product_hierarchy.member_label": { value: "Active" },
      "dim_product_hierarchy.member_path": { value: "All Products|Women|Active" },
      "dim_product_hierarchy.level_num": { value: 2 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": {
        Current: { value: 415400, rendered: "$415,400" },
        "Last Year": { value: 367800, rendered: "$367,800" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 206587, rendered: "$206,587" },
        "Last Year": { value: 179454, rendered: "$179,454" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.497, rendered: "49.7%" },
        "Last Year": { value: 0.488, rendered: "48.8%" },
      },
    },
    {
      "dim_product_hierarchy.member_id": { value: "BRAND:Women|Active|Nike" },
      "dim_product_hierarchy.parent_id": { value: "CAT:Women|Active" },
      "dim_product_hierarchy.member_label": { value: "Nike" },
      "dim_product_hierarchy.member_path": { value: "All Products|Women|Active|Nike" },
      "dim_product_hierarchy.level_num": { value: 3 },
      "dim_product_hierarchy.is_leaf": { value: "Yes" },
      "long_metrics.total_sale_price": {
        Current: { value: 415400, rendered: "$415,400" },
        "Last Year": { value: 367800, rendered: "$367,800" },
      },
      "long_metrics.total_gross_margin": {
        Current: { value: 206587, rendered: "$206,587" },
        "Last Year": { value: 179454, rendered: "$179,454" },
      },
      "long_metrics.gross_margin_percentage": {
        Current: { value: 0.497, rendered: "49.7%" },
        "Last Year": { value: 0.488, rendered: "48.8%" },
      },
    },
  ],
};
