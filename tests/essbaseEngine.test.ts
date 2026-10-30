import React from "react";
import { renderToString } from "react-dom/server";
import { VisPluginTableModel } from "report-table-js";
import {
  buildAlterBiCapacitySql,
  buildAutocompleteCatalog,
  buildLookerFilterExpression,
  canUserRebuildCube,
  canUserUpdateSettings,
  DEFAULT_AUTOCOMPLETE_MEMBER_LEVELS,
  DEFAULT_CALCULATIONS_CONFIG,
  DEFAULT_MODAL_UNFOLDED_IDS,
  DEFAULT_QUICK_START_ACTIONS,
  deriveExpandedPathsFromMemberIds,
  discoverBIEngineCandidateTables,
  discoverFieldsFromExplore,
  discoverHierarchiesFromExplore,
  escapeLookerFilterValue,
  evaluateEssbaseFormula,
  evaluateLeftHandMetricRow,
  parseBiEngineTablesFromGeneratedSql,
  fetchFullHierarchyCatalog,
  fetchHierarchiesFromLookmlOutline,
  fetchHierarchyModalChildren,
  flattenConfigToStringsJson,
  fetchOutlineChildren,
  formatEssbaseValue,
  formatMonthYearLabel,
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
  mergeOutlineRows,
  normalizeSourceAndTimeframe,
  parseLookBaseUrlState,
  projectOutlineRowsToReportTable,
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
  unflattenStringsJsonToConfig,
  validateLookBaseSettings,
} from "../src/essbaseEngine";
import {
  getLookBaseGuides,
  getLookBaseTourSteps,
  getNextUnseenGuide,
  loadLookBaseSettings,
  loadUserPrefsArtifact,
  resetDismissedGuides,
  resetDismissedQuickStarts,
  saveLookBaseSettings,
  saveUserPrefsArtifact,
} from "../src/lookbaseTour";

describe("LookBase Multidimensional Engine & (member_id, parent_id) Hierarchy Integration", () => {
  const pcConfig = DEFAULT_CALCULATIONS_CONFIG.parent_child_hierarchy!;

  const baseQueryResponse = {
    fields: {
      dimension_like: [
        { name: pcConfig.memberIdField, label: "Member ID", type: "string" },
        { name: pcConfig.parentIdField, label: "Parent ID", type: "string" },
        { name: pcConfig.labelField, label: "Member Name", type: "string" },
        { name: pcConfig.pathField, label: "Member Path", type: "string" },
        { name: pcConfig.levelField, label: "Level", type: "number" },
        { name: pcConfig.isLeafField, label: "Is Leaf", type: "yesno" },
      ],
      measure_like: [
        {
          name: "long_metrics.total_sale_price",
          label: "Total Sale Price",
          type: "number",
          is_numeric: true,
          value_format: "$#,##0",
        },
        {
          name: "long_metrics.total_gross_margin",
          label: "Total Gross Margin",
          type: "number",
          is_numeric: true,
          value_format: "$#,##0",
        },
      ],
      pivots: [],
    },
    pivots: [],
    sorts: [],
  };

  const initialOutlineRows = [
    {
      "dim_product_hierarchy.member_id": { value: "ALL" },
      "dim_product_hierarchy.parent_id": { value: "ROOT" },
      "dim_product_hierarchy.member_label": { value: "All Products" },
      "dim_product_hierarchy.member_path": { value: "All Products" },
      "dim_product_hierarchy.level_num": { value: 0 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": { value: 500000, rendered: "$500,000" },
      "long_metrics.total_gross_margin": { value: 200000, rendered: "$200,000" },
    },
    {
      "dim_product_hierarchy.member_id": { value: "DEPT:Men" },
      "dim_product_hierarchy.parent_id": { value: "ALL" },
      "dim_product_hierarchy.member_label": { value: "Men" },
      "dim_product_hierarchy.member_path": { value: "All Products|Men" },
      "dim_product_hierarchy.level_num": { value: 1 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": { value: 300000, rendered: "$300,000" },
      "long_metrics.total_gross_margin": { value: 120000, rendered: "$120,000" },
    },
    {
      "dim_product_hierarchy.member_id": { value: "DEPT:Women" },
      "dim_product_hierarchy.parent_id": { value: "ALL" },
      "dim_product_hierarchy.member_label": { value: "Women" },
      "dim_product_hierarchy.member_path": { value: "All Products|Women" },
      "dim_product_hierarchy.level_num": { value: 1 },
      "dim_product_hierarchy.is_leaf": { value: "No" },
      "long_metrics.total_sale_price": { value: 200000, rendered: "$200,000" },
      "long_metrics.total_gross_margin": { value: 80000, rendered: "$80,000" },
    },
  ];

  test("projects (member_id, parent_id) outline rows into viz-report-table VisPluginTableModel without modifying submodule", () => {
    const projected = projectOutlineRowsToReportTable(
      initialOutlineRows,
      baseQueryResponse,
      pcConfig,
      4,
    );

    expect(projected.pathToNode["All Products"].memberId).toBe("ALL");
    expect(projected.pathToNode["All Products|Men"].memberId).toBe("DEPT:Men");
    expect(projected.pathToNode["All Products|Men"].parentId).toBe("ALL");
    expect(projected.memberIdToNode["DEPT:Women"].path).toBe("All Products|Women");

    const model = new VisPluginTableModel(
      projected.queryResponse.data,
      projected.queryResponse,
      {
        rowSubtotals: true,
        subtotalStyle: "collapsed",
        subtotalsOnTop: true,
        startFolded: true,
        indexColumn: true,
      },
    );

    const subtotalRows = model.getDataRows().filter((r: any) => r.type === "subtotal");
    const subtotalIds = subtotalRows.map((r: any) => r.id);

    expect(subtotalIds).toContain("Subtotal|All Products");
    expect(subtotalIds).toContain("Subtotal|All Products|Men");
    expect(subtotalIds).toContain("Subtotal|All Products|Women");

    const menRow = subtotalRows.find((r: any) => r.id === "Subtotal|All Products|Men");
    expect(menRow.data["long_metrics.total_sale_price"].value).toBe(300000);
  });

  test("fetches child nodes by parent_id via run_inline_query and splices them under the expanded parent", async () => {
    const childRowsFromLooker = [
      {
        "dim_product_hierarchy.member_id": { value: "CAT:Men|Jeans" },
        "dim_product_hierarchy.parent_id": { value: "DEPT:Men" },
        "dim_product_hierarchy.member_label": { value: "Jeans" },
        "dim_product_hierarchy.member_path": { value: "All Products|Men|Jeans" },
        "dim_product_hierarchy.level_num": { value: 2 },
        "dim_product_hierarchy.is_leaf": { value: "No" },
        "long_metrics.total_sale_price": { value: 180000, rendered: "$180,000" },
        "long_metrics.total_gross_margin": { value: 72000, rendered: "$72,000" },
      },
    ];

    const mockSDK = {
      ok: jest.fn((p) => Promise.resolve(p)),
      run_inline_query: jest.fn(() => ({ data: childRowsFromLooker })),
    };

    const fetched = await fetchOutlineChildren(
      mockSDK,
      {
        model: "lookbase",
        view: "long_metrics",
        fields: ["dim_product_hierarchy.member_id", "long_metrics.total_sale_price"],
        filters: { "long_metrics.timeframe": "ytd" },
      },
      "DEPT:Men",
      pcConfig,
    );

    expect(mockSDK.run_inline_query).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          filters: {
            "long_metrics.timeframe": "ytd",
            "dim_product_hierarchy.parent_id": "DEPT:Men",
          },
        }),
      }),
    );

    const merged = mergeOutlineRows(initialOutlineRows, fetched, pcConfig);
    expect(merged).toHaveLength(4);

    const projected = projectOutlineRowsToReportTable(merged, baseQueryResponse, pcConfig, 4);
    expect(projected.pathToNode["All Products|Men|Jeans"].memberId).toBe("CAT:Men|Jeans");
    expect(projected.pathToNode["All Products|Men|Jeans"].parentId).toBe("DEPT:Men");
  });

  test("evaluates multidimensional formulas (MEMBER, PARENTVAL, VAR, VARPER, GETVALUE) and formats with ssf", () => {
    const gmPct = evaluateEssbaseFormula(
      "MEMBER('Total Gross Margin') / NULLIF(MEMBER('Total Sale Price'), 0)",
      {
        memberValues: { "Total Sale Price": 300000, "Total Gross Margin": 120000 },
      },
    );
    expect(gmPct).toBeCloseTo(0.4);
    expect(formatEssbaseValue(gmPct, "0.0%")).toBe("40.0%");

    const pctOfParent = evaluateEssbaseFormula(
      "MEMBER('Total Sale Price') / NULLIF(PARENTVAL('Total Sale Price'), 0)",
      {
        memberValues: { "Total Sale Price": 300000 },
        parentValues: { "Total Sale Price": 500000 },
      },
    );
    expect(pctOfParent).toBeCloseTo(0.6);

    const yoyVar = evaluateEssbaseFormula("VAR('Current', 'Last Year')", {
      memberValues: {},
      pivotValues: { Current: 300000, "Last Year": 250000 },
    });
    expect(yoyVar).toBe(50000);

    const yoyVarPer = evaluateEssbaseFormula("VARPER('Current', 'Last Year')", {
      memberValues: {},
      pivotValues: { Current: 300000, "Last Year": 250000 },
    });
    expect(yoyVarPer).toBeCloseTo(0.2);

    const getVal = evaluateEssbaseFormula(
      "GETVALUE('long_metrics.total_sale_price', 'Current', 'ytd', 'dim_product_hierarchy.member_id=DEPT:Men')",
      {
        memberValues: {},
        hsCache: {
          "long_metrics.total_sale_price|Current|ytd|dim_product_hierarchy.member_id=DEPT:Men": 300000,
        },
      },
    );
    expect(getVal).toBe(300000);
  });

  test("loads project calculations.json via get_file_content and supports PDT rebuild & BigQuery CLONE writebacks", async () => {
    const mockHost = {
      invokeCoreSdk: jest.fn().mockResolvedValue(
        JSON.stringify({
          model: "lookbase",
          explore: "long_metrics",
          hierarchy: ["dim_products.department", "dim_products.category"],
        }),
      ),
    };

    const cfg = await loadProjectCalculations(mockHost, "lookbase", "calculations.json");
    expect(mockHost.invokeCoreSdk).toHaveBeenCalledWith(
      "GET",
      "/projects/lookbase/file/content",
      { file_path: "calculations.json" },
    );
    expect(cfg.hierarchy).toEqual(["dim_products.department", "dim_products.category"]);

    const mockSDK = {
      ok: jest.fn((p) => Promise.resolve(p)),
      run_inline_query: jest.fn(() => []),
    };

    await rebuildCubePdt(mockSDK, {
      model: "lookbase",
      view: "stacked_total_sale_price",
    });
    expect(mockSDK.run_inline_query).toHaveBeenCalledWith(
      expect.objectContaining({
        rebuild_pdts: true,
        cache: false,
        body: expect.objectContaining({
          model: "lookbase",
          view: "stacked_total_sale_price",
        }),
      }),
    );
  });

  test("restores saved multi-branch outline expansions concurrently on load via restoreSavedOutlineExpansion", async () => {
    const mockSDK = {
      ok: jest.fn((p) => Promise.resolve(p)),
      run_inline_query: jest.fn(({ body }) => {
        const parentFilter: string = body.filters["dim_product_hierarchy.parent_id"];
        if (parentFilter.includes("DEPT:Men")) {
          return {
            data: [
              {
                "dim_product_hierarchy.member_id": { value: "CAT:Men|Jeans" },
                "dim_product_hierarchy.parent_id": { value: "DEPT:Men" },
                "dim_product_hierarchy.member_label": { value: "Jeans" },
                "dim_product_hierarchy.member_path": { value: "All Products|Men|Jeans" },
                "dim_product_hierarchy.level_num": { value: 2 },
                "dim_product_hierarchy.is_leaf": { value: "No" },
                "long_metrics.total_sale_price": { value: 180000 },
              },
            ],
          };
        }
        return { data: initialOutlineRows };
      }),
    };

    const restored = await restoreSavedOutlineExpansion(
      mockSDK,
      {
        model: "lookbase",
        view: "long_metrics",
        fields: ["dim_product_hierarchy.member_id", "long_metrics.total_sale_price"],
        filters: { "long_metrics.timeframe": "ytd" },
      },
      ["DEPT:Men", "CAT:Men|Jeans"],
      pcConfig,
      2,
    );

    expect(restored.batchCount).toBe(2);
    expect(restored.fetchedParentIds).toEqual(["ROOT", "ALL", "DEPT:Men", "CAT:Men|Jeans"]);
    expect(mockSDK.run_inline_query).toHaveBeenCalledTimes(2);
    expect(restored.rows.length).toBe(4);
  });

  test("searches and evaluates Left-Hand Side measures, 2-pass calculations, and ad-hoc formulas via autocomplete", () => {
    const projected = projectOutlineRowsToReportTable(
      initialOutlineRows,
      baseQueryResponse,
      pcConfig,
      4,
    );
    const loadedNodes = Object.values(projected.memberIdToNode);
    const catalog = buildAutocompleteCatalog(
      DEFAULT_CALCULATIONS_CONFIG,
      baseQueryResponse.fields.measure_like,
      loadedNodes,
    );

    const marginMatches = searchAutocompleteItems("margin", catalog);
    expect(marginMatches.length).toBeGreaterThanOrEqual(2);
    expect(marginMatches.some((m) => m.id === "long_metrics.total_gross_margin")).toBe(true);
    expect(marginMatches.some((m) => m.id === "calc:gm_pct")).toBe(true);

    const customMatches = searchAutocompleteItems(
      "=MEMBER('Total Sale Price') - MEMBER('Total Gross Margin')",
      catalog,
    );
    expect(customMatches[0].category).toBe("custom_formula");

    const pctParentItem = catalog.find((i) => i.id === "calc:pct_of_parent")!;
    const menNode = projected.memberIdToNode["DEPT:Men"];
    const rootNode = projected.memberIdToNode["ALL"];
    const evalResult = evaluateLeftHandMetricRow(
      pctParentItem,
      menNode,
      rootNode,
      "Current",
      DEFAULT_CALCULATIONS_CONFIG,
    );
    expect(evalResult.value).toBeCloseTo(0.6);
    expect(evalResult.formatted).toBe("60.0%");
  });

  test("defines 8-step driver.js interactive guided tour and projects STARTER_OUTLINE_QUERY_RESPONSE", () => {
    const steps = getLookBaseTourSteps();
    expect(steps).toHaveLength(8);
    expect(steps.map((s) => s.element)).toEqual([
      "#lookbase-tour-brand",
      "#lookbase-tour-pov",
      "#lookbase-tour-grid",
      "#lookbase-tour-hierarchy-btn",
      "#lookbase-tour-autocomplete",
      "#lookbase-tour-left-table",
      "#lookbase-tour-formula-bar",
      "#lookbase-tour-actions",
    ]);

    const projectedStarter = projectOutlineRowsToReportTable(
      STARTER_OUTLINE_QUERY_RESPONSE.data,
      STARTER_OUTLINE_QUERY_RESPONSE,
      pcConfig,
      4,
    );
    expect(projectedStarter.memberIdToNode["ALL"].label).toBe("All Products");
    expect(projectedStarter.memberIdToNode["DEPT:Women"].label).toBe("Women");
    expect(projectedStarter.memberIdToNode["CAT:Women|Dresses"].parentId).toBe("DEPT:Women");

    const starterTableModel = new VisPluginTableModel(
      projectedStarter.queryResponse.data,
      projectedStarter.queryResponse,
      {
        rowSubtotals: true,
        subtotalStyle: "collapsed",
        subtotalDepth: "(all)",
        spanCols: true,
        spanRows: true,
      },
    );
    expect(starterTableModel.columns.length).toBeGreaterThan(0);
    const topPivotHeaderCells = starterTableModel.getTableHeaderCells(0);
    const currentMergedCol = topPivotHeaderCells.find(
      (c: any) => c.levels[0]?.label === "Current",
    );
    expect(currentMergedCol?.levels[0]?.colspan).toBe(3);
  });

  test("parses and serializes LookBaseUrlState deterministically and derives expanded outline paths", () => {
    const rawQuery =
      "/?version=sandbox&timeframe=qtd&source=Daily+Actual&year=2024&member=CAT:Women|Dresses&expanded=ROOT,ALL,DEPT:Women,CAT:Women|Dresses&metrics=long_metrics.total_sale_price,calc:gm_pct&pane=1&quickstart=1&modal=hierarchy&q=margin&edit=%2B10%25&tour=1";
    const parsed = parseLookBaseUrlState(rawQuery);
    expect(parsed).toEqual({
      version: "sandbox",
      timeframe: "qtd",
      source: "Daily Actual",
      year: "2024",
      member: "CAT:Women|Dresses",
      expanded: ["ROOT", "ALL", "DEPT:Women", "CAT:Women|Dresses"],
      metrics: ["long_metrics.total_sale_price", "calc:gm_pct"],
      pane: true,
      quickstart: "1",
      modal: "hierarchy",
      q: "margin",
      edit: "+10%",
      tour: "1",
    });

    const serialized = serializeLookBaseUrlState(parsed);
    const reparsed = parseLookBaseUrlState(serialized);
    expect(reparsed).toEqual(parsed);

    const projectedStarter = projectOutlineRowsToReportTable(
      STARTER_OUTLINE_QUERY_RESPONSE.data,
      STARTER_OUTLINE_QUERY_RESPONSE,
      pcConfig,
      4,
    );
    const paths = deriveExpandedPathsFromMemberIds(
      ["ROOT", "ALL", "DEPT:Women", "CAT:Women|Dresses"],
      projectedStarter.memberIdToNode,
    );
    expect(paths).toEqual([
      "All Products",
      "All Products|Women",
      "All Products|Women|Dresses",
    ]);
  });

  test("auto-discovers measures, dimensions, and parent-child fields from LookML Explore via discoverFieldsFromExplore", () => {
    const mockExplore = {
      fields: {
        measures: [
          {
            name: "long_metrics.total_sale_price",
            label_short: "Total Sale Price",
            hidden: false,
            value_format: "$#,##0",
            tags: ["lookbase:include"],
          },
          {
            name: "long_metrics.total_gross_margin",
            label_short: "Total Gross Margin",
            hidden: false,
            value_format: "$#,##0",
            tags: [],
          },
          {
            name: "long_metrics.count",
            label_short: "Count",
            hidden: false,
            tags: ["lookbase:exclude"],
          },
          {
            name: "long_metrics.sum_value",
            label_short: "Sum Value",
            hidden: true,
            tags: [],
          },
        ],
        dimensions: [
          {
            name: "dim_product_hierarchy.member_id",
            hidden: false,
            tags: ["lookbase:member_id"],
          },
          {
            name: "dim_product_hierarchy.parent_id",
            hidden: false,
            tags: ["lookbase:parent_id"],
          },
          {
            name: "dim_product_hierarchy.member_label",
            hidden: false,
            tags: ["lookbase:member_label"],
          },
          {
            name: "dim_product_hierarchy.member_path",
            hidden: false,
            tags: ["lookbase:member_path"],
          },
          {
            name: "dim_product_hierarchy.level_num",
            hidden: false,
            tags: ["lookbase:level_num"],
          },
          {
            name: "dim_product_hierarchy.is_leaf",
            hidden: false,
            tags: ["lookbase:is_leaf"],
          },
          {
            name: "dim_products.department",
            hidden: false,
            tags: ["lookbase:include"],
          },
          {
            name: "dim_products.category",
            hidden: false,
            tags: [],
          },
          {
            name: "dim_products.id",
            hidden: false,
            tags: ["lookbase:exclude"],
          },
        ],
      },
    };

    // 1. Default mode: "all_except_excluded" includes all non-hidden fields except those tagged "lookbase:exclude"
    const slimConfig = {
      model: "lookbase",
      explore: "long_metrics",
      field_discovery: {
        mode: "all_except_excluded" as const,
        exclude_tag: "lookbase:exclude",
      },
      two_pass_metrics: DEFAULT_CALCULATIONS_CONFIG.two_pass_metrics,
      column_calcs: DEFAULT_CALCULATIONS_CONFIG.column_calcs,
    };
    const discoveredDefault = discoverFieldsFromExplore(mockExplore, slimConfig);
    expect(discoveredDefault.initial_state?.grid_measures).toEqual([
      "long_metrics.total_sale_price",
      "long_metrics.total_gross_margin",
    ]);
    expect(discoveredDefault.hierarchy).toEqual([
      "dim_products.department",
      "dim_products.category",
    ]);
    expect(discoveredDefault.parent_child_hierarchy?.memberIdField).toBe(
      "dim_product_hierarchy.member_id",
    );

    // 2. Opt-in mode: "include_tagged" only includes fields tagged "lookbase:include"
    const optInConfig = {
      ...slimConfig,
      field_discovery: {
        mode: "include_tagged" as const,
        include_tag: "lookbase:include",
      },
    };
    const discoveredOptIn = discoverFieldsFromExplore(mockExplore, optInConfig);
    expect(discoveredOptIn.initial_state?.grid_measures).toEqual([
      "long_metrics.total_sale_price",
    ]);
    expect(discoveredOptIn.hierarchy).toEqual(["dim_products.department"]);
  });

  test("persists tourDismissed, dismissedQuickStartIds, and customQuickStartActions via Looker Artifacts API", async () => {
    let serverStoredArtifact: any = null;
    const mockSDK = {
      ok: jest.fn((p) => Promise.resolve(p)),
      me: jest.fn(() => ({ id: "42" })),
      artifact: jest.fn(() => (serverStoredArtifact ? [serverStoredArtifact] : [])),
      update_artifacts: jest.fn((_ns, items) => {
        serverStoredArtifact = {
          key: items[0].key,
          value: items[0].value,
          version: (items[0].version ?? 0) + 1,
        };
        return [serverStoredArtifact];
      }),
    };

    const guides = getLookBaseGuides();
    expect(guides).toHaveLength(2);
    const initialLoad = await loadUserPrefsArtifact(mockSDK, "lookbase");
    expect(initialLoad.userId).toBe("42");
    expect(initialLoad.key).toBe("user_42_lookbase_prefs");
    expect(initialLoad.prefs.tourDismissed).toBeUndefined();
    expect(getNextUnseenGuide(initialLoad.prefs)?.id).toBe(guides[0].id);

    const defaultStartingMetrics = resolveInitialLeftHandMetrics(DEFAULT_CALCULATIONS_CONFIG);
    expect(defaultStartingMetrics.map((m) => m.id)).toEqual([
      "long_metrics.total_sale_price",
      "long_metrics.total_gross_margin",
      "calc:gm_pct",
      "calc:pct_of_parent",
      "calc:implied_cogs",
    ]);

    await saveUserPrefsArtifact(
      mockSDK,
      {
        dismissedGuideIds: [guides[0].id],
        lastDismissedGuideId: guides[0].id,
        dismissedQuickStartIds: ["qs_search_margin"],
        customQuickStartActions: [
          {
            id: "custom_1",
            label: "Men QTD View",
            params: { timeframe: "qtd", member: "DEPT:Men" },
          },
        ],
        leftHandMetricIds: ["long_metrics.total_sale_price", "calc:gm_pct"],
      },
      "lookbase",
    );

    const secondLoad = await loadUserPrefsArtifact(mockSDK, "lookbase");
    expect(secondLoad.prefs.dismissedGuideIds).toEqual([guides[0].id]);
    expect(secondLoad.prefs.dismissedQuickStartIds).toEqual(["qs_search_margin"]);
    expect(secondLoad.prefs.customQuickStartActions).toHaveLength(1);
    expect(getNextUnseenGuide(secondLoad.prefs)?.id).toBe(guides[1].id);

    await saveUserPrefsArtifact(
      mockSDK,
      { resetDismissedQuickStarts: true, quickStartDismissed: false },
      "lookbase",
    );
    const afterQuickStartReset = await loadUserPrefsArtifact(mockSDK, "lookbase");
    expect(afterQuickStartReset.prefs.dismissedQuickStartIds).toEqual([]);
    expect(afterQuickStartReset.prefs.quickStartDismissed).toBe(false);

    await saveUserPrefsArtifact(
      mockSDK,
      { resetDismissedGuides: true, tourDismissed: false },
      "lookbase",
    );
    const afterGuideReset = await loadUserPrefsArtifact(mockSDK, "lookbase");
    expect(afterGuideReset.prefs.dismissedGuideIds).toEqual([]);
    expect(afterGuideReset.prefs.tourDismissed).toBe(false);
  });

  test("normalizes raw run_inline_query json_detail responses (without fields.measure_like) so VisPluginTableModel.addMeasures never throws", () => {
    const rawJsonDetailResponse = {
      fields: {
        dimensions: [
          { name: pcConfig.memberIdField, label: "Member ID", type: "string" },
          { name: pcConfig.parentIdField, label: "Parent ID", type: "string" },
          { name: pcConfig.labelField, label: "Member Name", type: "string" },
          { name: pcConfig.pathField, label: "Member Path", type: "string" },
          { name: pcConfig.levelField, label: "Level", type: "number" },
          { name: pcConfig.isLeafField, label: "Is Leaf", type: "yesno" },
        ],
        measures: [
          {
            name: "long_metrics.total_sale_price",
            label: "Total Sale Price",
            type: "sum",
            value_format: "$#,##0",
          },
          {
            name: "long_metrics.total_gross_margin",
            label: "Total Gross Margin",
            type: "sum",
            value_format: "$#,##0",
          },
        ],
        pivots: [{ name: "long_metrics.current_period", label: "Current Period", type: "string" }],
        table_calculations: [],
      },
      pivots: [
        { key: "Current", data: { "long_metrics.current_period": "Current" } },
        { key: "Last Year", data: { "long_metrics.current_period": "Last Year" } },
        { key: "Yesterday", data: { "long_metrics.current_period": "Yesterday" } },
      ],
      data: STARTER_OUTLINE_QUERY_RESPONSE.data,
    };

    const projected = projectOutlineRowsToReportTable(
      STARTER_OUTLINE_QUERY_RESPONSE.data,
      rawJsonDetailResponse,
      pcConfig,
      4,
    );

    expect(Array.isArray(projected.queryResponse.fields.measure_like)).toBe(true);
    expect(projected.queryResponse.fields.measure_like).toHaveLength(2);
    expect(projected.queryResponse.fields.measure_like[0].is_numeric).toBe(true);

    const model = new VisPluginTableModel(
      projected.queryResponse.data,
      projected.queryResponse,
      {
        theme: "traditional",
        rowSubtotals: true,
        subtotalStyle: "collapsed",
        subtotalsOnTop: true,
        startFolded: true,
        expandSubtotals: "All Products,All Products|Women,All Products|Women|Dresses",
        indexColumn: true,
        spanCols: true,
        spanRows: true,
        arrowStyle: "plus_minus",
      },
    );

    expect(model.measures.length).toBe(2);
    expect(model.data.length).toBeGreaterThan(0);
    // Verify no cell in the model has undefined rendered or value when extra pivot key ("Yesterday") is present
    const womenRow = model.data.find((r: any) => String(r.id).includes("Women"));
    expect(womenRow).toBeDefined();
    expect(womenRow.data["Yesterday.long_metrics.total_sale_price"]?.value).toBeNull();
  });

  test("computes and cycles triple-state (all, some, none) hierarchy selections in tree order and aligns grain/timeframe", () => {
    expect(STARTER_HIERARCHY_CATALOG_NODES.filter((n) => n.level === 2)).toHaveLength(36);
    expect(STARTER_HIERARCHY_CATALOG_NODES.some((n) => n.level === 3 && n.isLeaf)).toBe(true);
    expect(normalizeSourceAndTimeframe("Monthly Actual", "r90d")).toEqual({
      source: "Daily Actual",
      timeframe: "r90d",
    });
    expect(normalizeSourceAndTimeframe("Monthly Actual", "ytd", "source")).toEqual({
      source: "Monthly Actual",
      timeframe: "r12m",
    });

    const nodes = sortOutlineNodesTreeOrder(STARTER_HIERARCHY_CATALOG_NODES);
    const memberIdToNode: Record<string, any> = {};
    for (const n of nodes) memberIdToNode[n.memberId] = n;

    // Verify tree order places Men's categories before Women's department
    const memberOrder = nodes.map((n) => n.memberId);
    expect(memberOrder.indexOf("DEPT:Men")).toBeLessThan(
      memberOrder.indexOf("CAT:Men|Jeans"),
    );
    expect(memberOrder.indexOf("CAT:Men|Jeans")).toBeLessThan(
      memberOrder.indexOf("DEPT:Women"),
    );

    const allNode = memberIdToNode["ALL"];
    const menNode = memberIdToNode["DEPT:Men"];
    const jeansNode = memberIdToNode["CAT:Men|Jeans"];
    const levisLeaf = memberIdToNode["BRAND:Men|Jeans|Levi's"];

    // 1. Default L0-L1 expanded: ["ROOT", "ALL", "DEPT:Men", "DEPT:Women"] -> ALL and DEPT:Men are "some"
    const initialExpanded = ["ROOT", "ALL", "DEPT:Men", "DEPT:Women"];
    expect(getHierarchyNodeTriState(allNode, nodes, initialExpanded)).toBe("some");
    expect(getHierarchyNodeTriState(menNode, nodes, initialExpanded)).toBe("some");
    expect(getHierarchyNodeTriState(jeansNode, nodes, initialExpanded)).toBe("none");
    expect(getHierarchyNodeTriState(levisLeaf, nodes, initialExpanded)).toBe("none");

    // 2. Clicking Men ("some") -> cycles to "all" (expands DEPT:Men and all its descendants)
    const afterMenAll = toggleHierarchyNodeTriState(menNode, nodes, initialExpanded);
    expect(getHierarchyNodeTriState(menNode, nodes, afterMenAll)).toBe("all");
    expect(getHierarchyNodeTriState(jeansNode, nodes, afterMenAll)).toBe("all");
    expect(getHierarchyNodeTriState(levisLeaf, nodes, afterMenAll)).toBe("all");
    expect(getHierarchyNodeTriState(allNode, nodes, afterMenAll)).toBe("some");
  });

  test("escapes Looker string filter metacharacters (Levi's, Scarf_tradinginc, commas, %, \", ^, leading -) for run_inline_query", async () => {
    expect(escapeLookerFilterValue("BRAND:Men|Jeans|Levi's")).toBe("BRAND:Men|Jeans|Levi's");
    expect(escapeLookerFilterValue("BRAND:Women|Accessories|Scarf_tradinginc")).toBe(
      "BRAND:Women|Accessories|Scarf^_tradinginc",
    );
    expect(escapeLookerFilterValue("BRAND:Men|Sweaters|F/X FUSION")).toBe(
      "BRAND:Men|Sweaters|F/X FUSION",
    );
    expect(escapeLookerFilterValue("BRAND:Test, Inc.")).toBe("BRAND:Test^, Inc.");
    expect(escapeLookerFilterValue("100% Cotton")).toBe("100^% Cotton");
    expect(escapeLookerFilterValue('-LeadingHyphen "Quoted" ^Caret')).toBe(
      '^-LeadingHyphen ^"Quoted^" ^^Caret',
    );
    expect(escapeLookerFilterValue("EMPTY")).toBe('"EMPTY"');
    expect(escapeLookerFilterValue("NULL")).toBe('"NULL"');

    const expr = buildLookerFilterExpression([
      "BRAND:Men|Jeans|Levi's",
      "BRAND:Women|Accessories|Scarf_tradinginc",
      "BRAND:Test, Inc.",
    ]);
    expect(expr).toBe(
      "BRAND:Men|Jeans|Levi's,BRAND:Women|Accessories|Scarf^_tradinginc,BRAND:Test^, Inc.",
    );

    const capturedFilters: Record<string, string>[] = [];
    const mockSDK = {
      ok: async (p: any) => p,
      run_inline_query: async (req: any) => {
        capturedFilters.push(req.body.filters);
        return { data: [] };
      },
    };
    await fetchOutlineChildren(
      mockSDK,
      { model: "lookbase", view: "long_metrics", fields: [pcConfig.memberIdField] },
      ["CAT:Men|Jeans", "BRAND:Women|Accessories|Scarf_tradinginc"],
      pcConfig,
    );
    expect(capturedFilters[0][pcConfig.parentIdField]).toBe(
      "CAT:Men|Jeans,BRAND:Women|Accessories|Scarf^_tradinginc",
    );
  });

  test("supports foldable L1-default hierarchy tree down to Level 7 (L6 leaf nodes), sticky headers, and async child loading on unfold", async () => {
    // 1. Default folded state ("ALL" unfolded) shows ONLY L0 (All Products) and L1 (Men, Women)
    const defaultVisible = getVisibleHierarchyModalNodes(
      STARTER_HIERARCHY_CATALOG_NODES,
      DEFAULT_MODAL_UNFOLDED_IDS,
    );
    expect(defaultVisible.map((n) => n.memberId)).toEqual([
      "ALL",
      "DEPT:Men",
      "DEPT:Women",
    ]);

    // 2. Unfolding L1 ("DEPT:Men") reveals Men's L2 categories while keeping L3 brands and Women's L2 categories folded
    const afterUnfoldMen = getVisibleHierarchyModalNodes(STARTER_HIERARCHY_CATALOG_NODES, [
      "ALL",
      "DEPT:Men",
    ]);
    expect(afterUnfoldMen.some((n) => n.memberId === "CAT:Men|Jeans")).toBe(true);
    expect(afterUnfoldMen.some((n) => n.isLeaf)).toBe(false);
    expect(afterUnfoldMen.some((n) => n.parentId === "DEPT:Women")).toBe(false);

    // 3. Unfolding a 7-level custom hierarchy down to L6 reveals L6 leaf nodes
    const custom7LevelNodes = sortOutlineNodesTreeOrder([
      { memberId: "ALL", parentId: "ROOT", label: "Global", path: "Global", level: 0, isLeaf: false },
      { memberId: "L1:NA", parentId: "ALL", label: "North America", path: "Global|North America", level: 1, isLeaf: false },
      { memberId: "L2:US", parentId: "L1:NA", label: "United States", path: "Global|North America|United States", level: 2, isLeaf: false },
      { memberId: "L3:West", parentId: "L2:US", label: "West Region", path: "Global|North America|United States|West Region", level: 3, isLeaf: false },
      { memberId: "L4:CA", parentId: "L3:West", label: "California", path: "Global|North America|United States|West Region|California", level: 4, isLeaf: false },
      { memberId: "L5:SF", parentId: "L4:CA", label: "San Francisco", path: "Global|North America|United States|West Region|California|San Francisco", level: 5, isLeaf: false },
      { memberId: "LEAF:SFO01", parentId: "L5:SF", label: "Site SFO-01", path: "Global|North America|United States|West Region|California|San Francisco|Site SFO-01", level: 6, isLeaf: true },
    ]);
    const allNonLeafIds = custom7LevelNodes.filter((n) => !n.isLeaf).map((n) => n.memberId);
    const afterUnfoldAll7Levels = getVisibleHierarchyModalNodes(
      custom7LevelNodes,
      allNonLeafIds,
    );
    expect(afterUnfoldAll7Levels.some((n) => n.level === 6 && n.isLeaf)).toBe(true);

    // 4. Sticky style verification: L0 is relative (not sticky), L1 is sticky top 0px, L2 is sticky top 30px, L3 is sticky top 60px
    const l0Style = getHierarchyRowStickyStyle(0, 30);
    const l1Style = getHierarchyRowStickyStyle(1, 30);
    const l2Style = getHierarchyRowStickyStyle(2, 30);
    const l3Style = getHierarchyRowStickyStyle(3, 30);

    expect(l0Style.position).toBe("relative");
    expect(l0Style.top).toBeUndefined();

    expect(l1Style.position).toBe("sticky");
    expect(l1Style.top).toBe(0);

    expect(l2Style.position).toBe("sticky");
    expect(l2Style.top).toBe(30);

    expect(l3Style.position).toBe("sticky");
    expect(l3Style.top).toBe(60);

    // 5. Async child loading on unfold via fetchHierarchyModalChildren
    const sdkCalls: any[] = [];
    const mockAsyncSDK = {
      ok: async (p: any) => p,
      run_inline_query: async (req: any) => {
        sdkCalls.push(req.body);
        return [
          {
            [pcConfig.memberIdField]: "LEAF:SFO01",
            [pcConfig.parentIdField]: "L5:SF",
            [pcConfig.labelField]: "Site SFO-01",
            [pcConfig.pathField]:
              "Global|North America|United States|West Region|California|San Francisco|Site SFO-01",
            [pcConfig.levelField]: 6,
            [pcConfig.isLeafField]: "Yes",
          },
        ];
      },
    };
    const loadedChildren = await fetchHierarchyModalChildren(
      mockAsyncSDK,
      "lookbase",
      ["L5:SF"],
      pcConfig,
      5000,
      "geography",
    );
    expect(sdkCalls).toHaveLength(1);
    expect(loadedChildren).toHaveLength(1);
    expect(loadedChildren[0].memberId).toBe("LEAF:SFO01");
    expect(loadedChildren[0].level).toBe(6);
  });

  test("enforces 8x N-level indentation across all 7 levels and supports unlimited L1-default autocomplete with level checkboxes", () => {
    // 1. N-level indentation in multiples of 8px (8x)
    for (let level = 0; level <= 8; level += 1) {
      const indentPx = getOutlineIndentationPx(level, 16);
      expect(indentPx).toBe(level * 16);
      expect(indentPx % 8).toBe(0);
      expect((8 + indentPx) % 8).toBe(0);
    }

    // 2. Autocomplete: unlimited default, L1 default, and L2..L3 checkboxes
    const fullCatalog = buildAutocompleteCatalog(
      DEFAULT_CALCULATIONS_CONFIG,
      [],
      STARTER_HIERARCHY_CATALOG_NODES,
    );
    const defaultL1Results = searchAutocompleteItems(
      "",
      fullCatalog,
      Infinity,
      DEFAULT_AUTOCOMPLETE_MEMBER_LEVELS,
    );
    const defaultMemberItems = defaultL1Results.filter((item) => item.category === "member");
    expect(defaultMemberItems.map((m) => m.label)).toEqual(["Men", "Women"]);

    const withL3Results = searchAutocompleteItems("", fullCatalog, Infinity, [1, 2, 3]);
    const withL3Members = withL3Results.filter((item) => item.category === "member");
    expect(withL3Members.some((m) => m.level === 3)).toBe(true);
    expect(withL3Results.length).toBeGreaterThan(20);

    // 3. Virtualized window calculation
    const win = getVirtualizedAutocompleteWindow(500, 480, 320, 48, 5);
    expect(win.startIndex).toBe(5);
    expect(win.endIndex).toBe(22);
    expect(win.offsetTop).toBe(5 * 48);
    expect(win.totalHeight).toBe(500 * 48);
  });

  test("enforces explore-blending style Configuration Settings permissions for who can edit settings and who can rebuild cube", async () => {
    const adminUser = {
      id: "10",
      email: "admin@company.com",
      display_name: "Admin User",
      role_ids: ["2"],
      group_ids: ["1"],
    };
    const fpaUser = {
      id: "42",
      email: "fpa@company.com",
      display_name: "FP&A Lead",
      role_ids: ["5"],
      group_ids: ["100", "200"],
    };
    const viewerUser = {
      id: "99",
      email: "viewer@company.com",
      display_name: "Viewer",
      role_ids: ["8"],
      group_ids: ["300"],
    };

    expect(isLookerAdminUser(adminUser)).toBe(true);
    expect(isLookerAdminUser(fpaUser)).toBe(false);

    // 1. Default unrestricted: everyone can edit settings and rebuild cube
    expect(canUserUpdateSettings(viewerUser, { restrict_settings: false })).toBe(true);
    expect(canUserRebuildCube(viewerUser, { restrict_rebuild_cube: false })).toBe(true);

    // 2. Restricted settings & rebuild cube by Group ID or User ID / Email
    const restrictedConfig = {
      restrict_settings: true,
      settings_group_ids: ["100"],
      settings_user_ids: [],
      restrict_rebuild_cube: true,
      rebuild_cube_group_ids: [],
      rebuild_cube_user_ids: ["fpa@company.com"],
    };

    // Admin always has access
    expect(canUserUpdateSettings(adminUser, restrictedConfig)).toBe(true);
    expect(canUserRebuildCube(adminUser, restrictedConfig)).toBe(true);

    // FP&A user matches group 100 for settings and email for rebuild cube
    expect(canUserUpdateSettings(fpaUser, restrictedConfig)).toBe(true);
    expect(canUserRebuildCube(fpaUser, restrictedConfig)).toBe(true);

    // Viewer user has neither
    expect(canUserUpdateSettings(viewerUser, restrictedConfig)).toBe(false);
    expect(canUserRebuildCube(viewerUser, restrictedConfig)).toBe(false);

    // 3. Self-lockout validation prevents non-admin from enabling restrict_settings without including their own Group/User ID
    const lockoutValidation = validateLookBaseSettings(
      {
        restrict_settings: true,
        settings_group_ids: ["999"],
        settings_user_ids: [],
      },
      fpaUser,
    );
    expect(lockoutValidation.settings_access_error).toContain("100, 200");

    // 4. Persistence via saveLookBaseSettings / loadLookBaseSettings (Context Data + Artifact)
    let savedContextData: any = null;
    let savedArtifact: any = null;
    const mockHost = {
      refreshContextData: jest.fn(async () => {}),
      getContextData: jest.fn(async () => savedContextData),
      saveContextData: jest.fn(async (data: any) => {
        savedContextData = data;
      }),
    };
    const mockSDK = {
      ok: jest.fn((p: any) => Promise.resolve(p)),
      artifact: jest.fn(async () => (savedArtifact ? [savedArtifact] : [])),
      update_artifacts: jest.fn(async (_ns: string, items: any[]) => {
        savedArtifact = {
          key: items[0].key,
          value: items[0].value,
          version: 1,
        };
        return [savedArtifact];
      }),
    };

    await saveLookBaseSettings(
      mockHost,
      mockSDK,
      restrictedConfig,
      fpaUser,
      { restrict_settings: false },
      "lookbase",
    );
    const loaded = await loadLookBaseSettings(mockHost, mockSDK, "lookbase");
    expect(loaded).toEqual(restrictedConfig);
  });

  test("discovers all shared LookBase PDT tables and builds ALTER BI_CAPACITY DDL while excluding non-shared sandboxes", async () => {
    const mockSql = [
      "-- use existing dim_product_hierarchy in `looker-private-demo.lookerdemo_scratch.LR_2RUPB_dim_product_hierarchy`",
      "-- use existing long_metrics_base in `looker-private-demo.lookerdemo_scratch.LR_2R31J_long_metrics_base`",
      "-- use existing lookbase_sandbox_42 in `looker-private-demo.lookerdemo_scratch.lookbase_sandbox_42`",
      "FROM `looker-private-demo.lookerdemo_scratch.LR_2RGSL_stacked_total_sale_price` AS stacked_total_sale_price",
    ].join("\n");

    const parsed = parseBiEngineTablesFromGeneratedSql([mockSql]);
    expect(parsed.projectId).toBe("looker-private-demo");
    expect(parsed.byView.long_metrics_base.datasetTable).toBe(
      "lookerdemo_scratch.LR_2R31J_long_metrics_base",
    );
    expect(parsed.byView.dim_product_hierarchy.datasetTable).toBe(
      "lookerdemo_scratch.LR_2RUPB_dim_product_hierarchy",
    );
    expect(parsed.byView.stacked_total_sale_price.datasetTable).toBe(
      "lookerdemo_scratch.LR_2RGSL_stacked_total_sale_price",
    );
    expect(parsed.byView.lookbase_sandbox_42).toBeUndefined();

    const mockSDK = {
      ok: jest.fn((p: any) => Promise.resolve(p)),
      run_inline_query: jest.fn(async () => mockSql),
    };

    const discovered = await discoverBIEngineCandidateTables(mockSDK, "lookbase");
    expect(discovered.tables).toHaveLength(10);
    expect(discovered.alterSql).toContain(
      "ALTER BI_CAPACITY `looker-private-demo.region-us.default`",
    );
    expect(discovered.alterSql).toContain(
      "'lookerdemo_scratch.LR_2R31J_long_metrics_base'",
    );
    expect(discovered.alterSql).toContain(
      "'lookerdemo_scratch.LR_2RUPB_dim_product_hierarchy'",
    );
    expect(discovered.alterSql).not.toContain("sandbox");
  });

  test("formats YYYY-MM Month + Year labels, defaults initial_state.year to most recent month 2025-03, and omits R3M + R12M shortcut", () => {
    expect(formatMonthYearLabel("2025-03")).toBe("Mar 2025");
    expect(formatMonthYearLabel("2025-02")).toBe("Feb 2025");
    expect(formatMonthYearLabel("2024-12")).toBe("Dec 2024");
    expect(formatMonthYearLabel("ALL")).toBe("All Months");
    expect(DEFAULT_CALCULATIONS_CONFIG.initial_state?.year).toBe("2025-03");
    expect(
      DEFAULT_QUICK_START_ACTIONS.some((a) => a.id === "qs_multi_timeframe_r3m_r12m"),
    ).toBe(false);
  });

  test("excludes all default eCommerce demo fallbacks (All Products, Men, Women, Total Sale Price, Total Gross Margin, calc:implied_cogs) when a customer calculations.strings.json is loaded", async () => {
    const customProjectJson = {
      model: "enterprise_finance",
      explore: "long_metrics",
      hierarchies: [
        {
          id: "org_tree",
          label: "Enterprise Org Tree (L0 → L6)",
          shortLabel: "Org Tree",
          rootLabel: "Total Enterprise",
          view: "dim_product_hierarchy",
          levelLabels: [
            "Enterprise (L0)",
            "Division (L1)",
            "Region (L2)",
            "Sub-Region (L3)",
            "Country (L4)",
            "District (L5)",
            "Site (L6)",
          ],
          defaultExpandedIds: ["ROOT", "ALL", "DIV:North America"],
          defaultExpandedPaths: ["Total Enterprise", "Total Enterprise|North America"],
        },
      ],
      measures: [
        {
          id: "long_metrics.gross_operating_rev",
          label: "Gross Operating Revenue",
          label_short: "Gross Operating Revenue",
          fieldName: "long_metrics.gross_operating_rev",
          format: "$#,##0",
        },
        {
          id: "long_metrics.net_operating_income",
          label: "Net Operating Income",
          label_short: "Net Operating Income",
          fieldName: "long_metrics.net_operating_income",
          format: "$#,##0",
        },
      ],
      initial_state: {
        year: "2025-03",
        default_hierarchy: "org_tree",
        enabled_hierarchies: ["org_tree"],
        grid_measures: [
          "long_metrics.gross_operating_rev",
          "long_metrics.net_operating_income",
        ],
        left_hand_metrics: [
          "long_metrics.gross_operating_rev",
          "long_metrics.net_operating_income",
          "calc:noi_margin_pct",
        ],
      },
      two_pass_metrics: [
        {
          id: "noi_margin_pct",
          label: "NOI Margin %",
          solve_order: 2,
          formula:
            "MEMBER('Net Operating Income') / NULLIF(MEMBER('Gross Operating Revenue'), 0)",
          format: "0.0%",
        },
      ],
      quick_start_actions: [
        {
          id: "qs_custom_org",
          label: "1. Expand North America",
          params: { hierarchy: "org_tree", expanded: ["ROOT", "ALL", "DIV:North America"] },
        },
      ],
    };

    const mockHost = {
      invokeCoreSdk: jest.fn().mockResolvedValue(JSON.stringify(customProjectJson)),
    };
    const loadedCfg = await loadProjectCalculations(
      mockHost,
      "enterprise_finance",
      "calculations.strings.json",
    );
    expect(isCustomCalculationsConfig(loadedCfg)).toBe(true);
    expect(isCustomCalculationsConfig(DEFAULT_CALCULATIONS_CONFIG)).toBe(false);

    // 1. Hierarchies strictly come from customer config — no e-commerce "Product" hierarchy
    const discoveredHierarchies = discoverHierarchiesFromExplore(null, loadedCfg);
    expect(discoveredHierarchies.map((h) => h.id)).toEqual(["org_tree"]);
    expect(discoveredHierarchies.some((h) => h.id === "product")).toBe(false);

    // 2. Starter hierarchy nodes strictly use customer config — no "All Products", "Men", or "Women"
    const starterNodes = getStarterHierarchyNodesForId("org_tree", loadedCfg);
    expect(starterNodes.map((n) => n.label)).toEqual(["Total Enterprise", "North America"]);
    expect(starterNodes.some((n) => n.label === "All Products" || n.label === "Men")).toBe(false);

    // 3. Starter outline strictly uses customer config — no e-commerce rows or measures
    const starterOutline = getStarterOutlineForConfig(loadedCfg, "org_tree");
    expect(
      starterOutline.fields.measure_like.map((m: any) => m.name),
    ).toEqual([
      "long_metrics.gross_operating_rev",
      "long_metrics.net_operating_income",
    ]);
    expect(
      starterOutline.data.some(
        (r: any) =>
          r["dim_product_hierarchy.member_label"]?.value === "All Products" ||
          r["dim_product_hierarchy.member_label"]?.value === "Men",
      ),
    ).toBe(false);

    // 4. Autocomplete catalog & initial left-hand metrics contain ZERO e-commerce fallbacks
    const catalog = buildAutocompleteCatalog(loadedCfg, [], starterNodes);
    const catalogIds = catalog.map((c) => c.id);
    expect(catalogIds).toContain("long_metrics.gross_operating_rev");
    expect(catalogIds).toContain("long_metrics.net_operating_income");
    expect(catalogIds).toContain("calc:noi_margin_pct");
    expect(catalogIds).not.toContain("long_metrics.total_sale_price");
    expect(catalogIds).not.toContain("long_metrics.total_gross_margin");
    expect(catalogIds).not.toContain("calc:implied_cogs");
    expect(catalogIds).not.toContain("calc:margin_to_sales_ratio");

    const initialLeft = resolveInitialLeftHandMetrics(loadedCfg, catalog);
    expect(initialLeft.map((m) => m.id)).toEqual([
      "long_metrics.gross_operating_rev",
      "long_metrics.net_operating_income",
      "calc:noi_margin_pct",
    ]);

    // Stale/unrecognized user metric IDs automatically fall back to calcConfig.initial_state.left_hand_metrics
    const recoveredLeft = resolveInitialLeftHandMetrics(loadedCfg, catalog, [
      "long_metrics.non_existent_measure",
    ]);
    expect(recoveredLeft.map((m) => m.id)).toEqual([
      "long_metrics.gross_operating_rev",
      "long_metrics.net_operating_income",
      "calc:noi_margin_pct",
    ]);

    // 5. SDK queries for fetchFullHierarchyCatalog & discoverBIEngineCandidateTables strictly use
    //    model: "enterprise_finance" and view: "long_metrics" (never "lookbase" or "dim_product_hierarchy")
    const recordedQueries: any[] = [];
    const customMockSDK = {
      ok: async (p: any) => p,
      run_inline_query: async (req: any) => {
        recordedQueries.push(req.body);
        return [
          {
            "dim_product_hierarchy.member_id": "ALL",
            "dim_product_hierarchy.parent_id": "ROOT",
            "dim_product_hierarchy.member_label": "Total Enterprise",
            "dim_product_hierarchy.member_path": "Total Enterprise",
            "dim_product_hierarchy.level_num": 0,
            "dim_product_hierarchy.is_leaf": "No",
          },
        ];
      },
    };
    await fetchFullHierarchyCatalog(
      customMockSDK,
      loadedCfg.model,
      loadedCfg.parent_child_hierarchy,
      "org_tree",
      loadedCfg,
    );
    await discoverBIEngineCandidateTables(customMockSDK, loadedCfg.model, loadedCfg);
    expect(recordedQueries.length).toBeGreaterThanOrEqual(2);
    for (const q of recordedQueries) {
      expect(q.model).toBe("enterprise_finance");
      expect(q.view).toBe("long_metrics");
      expect(q.fields).not.toContain("long_metrics.total_sale_price");
    }

    // 6. Verify loadProjectCalculations recovers via Looker Artifacts API even if getContextData throws,
    //    core40SDK.artifact returns a stringified JSON array, and invokeCoreSdk returns an error object ({ ok: false })
    const artifactBackedSdk = {
      ok: async (p: any) => p,
      artifact: jest
        .fn()
        .mockResolvedValue(
          JSON.stringify([
            { key: "lookbase_project_calculations", value: JSON.stringify(customProjectJson) },
          ]),
        ),
    };
    const artifactLoadedCfg = await loadProjectCalculations(
      {
        getContextData: () => ({}),
        invokeCoreSdk: jest.fn().mockResolvedValue({ ok: false, error: { message: "Forbidden" } }),
      },
      "enterprise_finance",
      "calculations.strings.json",
      artifactBackedSdk,
      "enterprise_finance::lookbase",
    );
    expect(isCustomCalculationsConfig(artifactLoadedCfg)).toBe(true);
    expect(artifactLoadedCfg.model).toBe("enterprise_finance");
    expect(artifactLoadedCfg.hierarchies?.map((h) => h.id)).toEqual(["org_tree"]);

    // 7. Verify LookBaseExtension component mounts and renders cleanly without any ReferenceError (both with and without a host prop)
    (global as any).window = {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      location: { search: "" },
      history: { replaceState: () => undefined },
    };
    const { LookBaseExtension } = require("../src/LookBaseExtension");
    const renderedStandalone = renderToString(React.createElement(LookBaseExtension));
    expect(renderedStandalone).toContain("LookBase");
    const renderedWithHost = renderToString(
      React.createElement(LookBaseExtension, {
        host: {
          lookerHostData: { extensionId: "enterprise_finance::lookbase" },
          updateTitle: () => undefined,
        } as any,
      }),
    );
    expect(renderedWithHost).toContain("LookBase");
  });

  test("supports 100% LookML vs 100% JSON hierarchy discovery configuration via hierarchy_discovery / hierarchy_source", async () => {
    const jsonHierarchy = {
      id: "json_only_tree",
      label: "JSON Only Tree",
      shortLabel: "JSON Tree",
      rootLabel: "JSON Root",
      description: "Defined in JSON",
      levelLabels: ["Root", "L1"],
      defaultExpandedIds: ["ROOT", "ALL", "JSON:L1"],
      defaultExpandedPaths: ["JSON Root", "JSON Root|JSON L1"],
      sourceType: "cube" as const,
      exploreView: "dim_product_hierarchy",
      preloadedByDefault: true,
    };

    const outlineRowsFromLookml = [
      {
        "dim_product_hierarchy.hierarchy_id": "total_ihg",
        "dim_product_hierarchy.member_id": "ALL",
        "dim_product_hierarchy.parent_id": "ROOT",
        "dim_product_hierarchy.member_label": "Total IHG",
        "dim_product_hierarchy.level_num": 0,
      },
      {
        "dim_product_hierarchy.hierarchy_id": "total_ihg",
        "dim_product_hierarchy.member_id": "DEPT:AMER Operations",
        "dim_product_hierarchy.parent_id": "ALL",
        "dim_product_hierarchy.member_label": "AMER Operations",
        "dim_product_hierarchy.level_num": 1,
      },
      {
        "dim_product_hierarchy.hierarchy_id": "country",
        "dim_product_hierarchy.member_id": "ALL",
        "dim_product_hierarchy.parent_id": "ROOT",
        "dim_product_hierarchy.member_label": "All Countries",
        "dim_product_hierarchy.level_num": 0,
      },
      {
        "dim_product_hierarchy.hierarchy_id": "country",
        "dim_product_hierarchy.member_id": "DEPT:United States",
        "dim_product_hierarchy.parent_id": "ALL",
        "dim_product_hierarchy.member_label": "United States",
        "dim_product_hierarchy.level_num": 1,
      },
    ];

    // 1. "json" mode pulls 100% from JSON and ignores LookML outline rows / explore dimensions
    const jsonCfg = {
      ...DEFAULT_CALCULATIONS_CONFIG,
      model: "hotel_finance",
      hierarchy_discovery: { source: "json" as const },
      hierarchies: [jsonHierarchy],
    };
    expect(resolveHierarchyDiscoverySource(jsonCfg)).toBe("json");
    const fromJson = discoverHierarchiesFromExplore(
      {
        fields: {
          dimensions: [
            { name: "dim_geo.region", group_label: "Geography" },
            { name: "dim_geo.country", group_label: "Geography" },
          ],
        },
      },
      jsonCfg,
      outlineRowsFromLookml,
    );
    expect(fromJson.map((h) => h.id)).toEqual(["json_only_tree"]);

    // 2. "lookml" mode pulls 100% from LookML and ignores JSON hierarchies
    const lookmlCfg = {
      ...DEFAULT_CALCULATIONS_CONFIG,
      model: "hotel_finance",
      hierarchy_discovery: { source: "lookml" as const },
      hierarchies: [jsonHierarchy],
    };
    expect(resolveHierarchyDiscoverySource(lookmlCfg)).toBe("lookml");
    const mockLookmlSdk = {
      ok: async (p: any) => p,
      run_inline_query: jest.fn().mockResolvedValue(outlineRowsFromLookml),
    };
    const fromLookml = await fetchHierarchiesFromLookmlOutline(
      mockLookmlSdk,
      "hotel_finance",
      null,
      lookmlCfg,
    );
    expect(fromLookml.map((h) => h.id)).toEqual(["total_ihg", "country"]);
    expect(fromLookml.some((h) => h.id === "json_only_tree")).toBe(false);
    expect(fromLookml[0].rootLabel).toBe("Total IHG");
    expect(fromLookml[0].defaultExpandedIds).toEqual([
      "ROOT",
      "ALL",
      "DEPT:AMER Operations",
    ]);

    // 3. Flat dot-key calculations.strings.json round-trips cleanly without lookbase_config_json stringification
    const flatStrings = flattenConfigToStringsJson({
      model: "hotel_finance",
      explore: "long_metrics",
      base_pdt_view: "long_metrics",
      hierarchy_discovery: {
        source: "lookml",
        hierarchy_id_field: "dim_product_hierarchy.hierarchy_id",
        outline_explore: "dim_product_hierarchy",
      },
      initial_state: {
        year: "2026-09",
        default_hierarchy: "total_ihg",
        show_left_metrics_pane: true,
        expanded_member_ids: ["ROOT", "ALL", "DEPT:AMER Operations"],
      },
      two_pass_metrics: [
        {
          id: "gm_pct",
          label: "Net P&L Ratio % (CUSD)",
          solve_order: 2,
          formula:
            "MEMBER('Constant USD Amount (Operator-Weighted P&L)') / NULLIF(MEMBER('Gross Constant USD Amount (Unweighted)'), 0)",
          format: "0.0%",
        },
      ],
    });
    expect(Object.values(flatStrings).every((v) => typeof v === "string")).toBe(true);
    expect(flatStrings["lookbase_config_json"]).toBeUndefined();
    expect(flatStrings["hierarchy_discovery.source"]).toBe("lookml");
    expect(flatStrings["two_pass_metrics.gm_pct.label"]).toBe("Net P&L Ratio % (CUSD)");

    const unflattened = unflattenStringsJsonToConfig(flatStrings);
    expect(unflattened.hierarchy_discovery.source).toBe("lookml");
    expect(unflattened.initial_state.show_left_metrics_pane).toBe(true);
    expect(unflattened.initial_state.expanded_member_ids).toEqual([
      "ROOT",
      "ALL",
      "DEPT:AMER Operations",
    ]);
    expect(unflattened.two_pass_metrics).toEqual([
      {
        id: "gm_pct",
        label: "Net P&L Ratio % (CUSD)",
        solve_order: 2,
        formula:
          "MEMBER('Constant USD Amount (Operator-Weighted P&L)') / NULLIF(MEMBER('Gross Constant USD Amount (Unweighted)'), 0)",
        format: "0.0%",
      },
    ]);
  });
});



