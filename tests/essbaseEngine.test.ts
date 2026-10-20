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
  deriveExpandedPathsFromMemberIds,
  discoverBIEngineCandidateTables,
  discoverFieldsFromExplore,
  escapeLookerFilterValue,
  evaluateEssbaseFormula,
  evaluateLeftHandMetricRow,
  parseBiEngineTablesFromGeneratedSql,
  executeEssbaseWriteback,
  fetchHierarchyModalChildren,
  fetchOutlineChildren,
  formatEssbaseValue,
  getHierarchyNodeTriState,
  getHierarchyRowStickyStyle,
  getOutlineIndentationPx,
  getVirtualizedAutocompleteWindow,
  getVisibleHierarchyModalNodes,
  isLookerAdminUser,
  loadProjectCalculations,
  mergeOutlineRows,
  normalizeSourceAndTimeframe,
  parseLookBaseUrlState,
  projectOutlineRowsToReportTable,
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
      run_inline_query: jest.fn(() => [{ "lookbase_writeback.action_executed": "init_sandbox" }]),
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

    await executeEssbaseWriteback(mockSDK, "lookbase", "lookbase_writeback", {
      action_type: "write_delta",
      p_member_id: "DEPT:Men",
      p_delta_value: "50000",
    });
    expect(mockSDK.run_inline_query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rebuild_pdts: true,
        cache: false,
        body: expect.objectContaining({
          model: "lookbase",
          view: "lookbase_writeback",
          filters: expect.objectContaining({
            "lookbase_writeback.action_type": "write_delta",
            "lookbase_writeback.p_member_id": "DEPT:Men",
            "lookbase_writeback.p_delta_value": "50000",
          }),
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

    const gmMatches = searchAutocompleteItems("gross margin", catalog);
    expect(gmMatches.length).toBeGreaterThanOrEqual(2);
    expect(gmMatches.some((m) => m.id === "calc:gm_pct")).toBe(true);
    expect(gmMatches.some((m) => m.id === "long_metrics.total_gross_margin")).toBe(true);

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

  test("defines 8-step driver.js interactive guided tour and projects STARTER_OUTLINE_QUERY_RESPONSE with Level-3 Brand rows under CAT:Men|Jeans", () => {
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
    expect(projectedStarter.memberIdToNode["DEPT:Men"].label).toBe("Men");
    expect(projectedStarter.memberIdToNode["CAT:Men|Jeans"].parentId).toBe("DEPT:Men");
    expect(projectedStarter.memberIdToNode["BRAND:Men|Jeans|Levi's"].parentId).toBe("CAT:Men|Jeans");
    expect(projectedStarter.memberIdToNode["BRAND:Men|Jeans|Calvin Klein"].parentId).toBe("CAT:Men|Jeans");

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
      "/?version=sandbox&timeframe=qtd&source=Daily+Actual&year=2024&member=CAT:Men|Jeans&expanded=ROOT,ALL,DEPT:Men,CAT:Men|Jeans&metrics=long_metrics.total_sale_price,calc:gm_pct&pane=1&quickstart=1&modal=hierarchy&q=margin&edit=%2B10%25&tour=1";
    const parsed = parseLookBaseUrlState(rawQuery);
    expect(parsed).toEqual({
      version: "sandbox",
      timeframe: "qtd",
      source: "Daily Actual",
      year: "2024",
      member: "CAT:Men|Jeans",
      expanded: ["ROOT", "ALL", "DEPT:Men", "CAT:Men|Jeans"],
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
      ["ROOT", "ALL", "DEPT:Men", "CAT:Men|Jeans"],
      projectedStarter.memberIdToNode,
    );
    expect(paths).toEqual([
      "All Products",
      "All Products|Men",
      "All Products|Men|Jeans",
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
        expandSubtotals: "All Products,All Products|Men,All Products|Men|Jeans",
        indexColumn: true,
        spanCols: true,
        spanRows: true,
        arrowStyle: "plus_minus",
      },
    );

    expect(model.measures.length).toBe(2);
    expect(model.data.length).toBeGreaterThan(0);
    // Verify no cell in the model has undefined rendered or value when extra pivot key ("Yesterday") is present
    const levisRow = model.data.find((r: any) => String(r.id).includes("Levi's"));
    expect(levisRow).toBeDefined();
    expect(levisRow.data["Yesterday.long_metrics.total_sale_price"]?.value).toBeNull();
  });

  test("computes and cycles triple-state (all, some, none) hierarchy selections in tree order and aligns grain/timeframe", () => {
    expect(STARTER_HIERARCHY_CATALOG_NODES.filter((n) => n.level === 2)).toHaveLength(36);
    expect(normalizeSourceAndTimeframe("Monthly Actual", "r90d")).toEqual({
      source: "Daily Actual",
      timeframe: "r90d",
    });
    expect(normalizeSourceAndTimeframe("Monthly Actual", "ytd", "source")).toEqual({
      source: "Monthly Actual",
      timeframe: "r12m",
    });

    const projected = projectOutlineRowsToReportTable(
      STARTER_OUTLINE_QUERY_RESPONSE.data,
      STARTER_OUTLINE_QUERY_RESPONSE,
      pcConfig,
      4,
    );
    const nodes = sortOutlineNodesTreeOrder(Object.values(projected.memberIdToNode));

    // Verify tree order places Men's categories & brands before Women
    const memberOrder = nodes.map((n) => n.memberId);
    expect(memberOrder.indexOf("DEPT:Men")).toBeLessThan(memberOrder.indexOf("CAT:Men|Jeans"));
    expect(memberOrder.indexOf("CAT:Men|Jeans")).toBeLessThan(memberOrder.indexOf("DEPT:Women"));

    const allNode = projected.memberIdToNode["ALL"];
    const menNode = projected.memberIdToNode["DEPT:Men"];
    const jeansNode = projected.memberIdToNode["CAT:Men|Jeans"];
    const levisNode = projected.memberIdToNode["BRAND:Men|Jeans|Levi's"];

    // 1. Default L0-L1 expanded: ["ROOT", "ALL", "DEPT:Men", "DEPT:Women"] -> ALL and DEPT:Men are "some", CAT:Men|Jeans is "none"
    const initialExpanded = ["ROOT", "ALL", "DEPT:Men", "DEPT:Women"];
    expect(getHierarchyNodeTriState(allNode, nodes, initialExpanded)).toBe("some");
    expect(getHierarchyNodeTriState(menNode, nodes, initialExpanded)).toBe("some");
    expect(getHierarchyNodeTriState(jeansNode, nodes, initialExpanded)).toBe("none");
    expect(getHierarchyNodeTriState(levisNode, nodes, initialExpanded)).toBe("none");

    // 2. Clicking Men ("some") -> cycles to "all" (expands DEPT:Men and all its categories)
    const afterMenAll = toggleHierarchyNodeTriState(menNode, nodes, initialExpanded);
    expect(getHierarchyNodeTriState(menNode, nodes, afterMenAll)).toBe("all");
    expect(getHierarchyNodeTriState(jeansNode, nodes, afterMenAll)).toBe("all");
    expect(getHierarchyNodeTriState(levisNode, nodes, afterMenAll)).toBe("all");
    expect(getHierarchyNodeTriState(allNode, nodes, afterMenAll)).toBe("some");

    // 3. Unchecking one brand (Levi's) under Jeans transitions Jeans to "some"
    const afterUncheckLevis = toggleHierarchyNodeTriState(levisNode, nodes, afterMenAll);
    expect(getHierarchyNodeTriState(levisNode, nodes, afterUncheckLevis)).toBe("none");
    expect(getHierarchyNodeTriState(jeansNode, nodes, afterUncheckLevis)).toBe("some");

    // 4. Clicking Men ("some") -> cycles to "all", then clicking Men ("all") -> cycles to "none"
    const afterMenAllAgain = toggleHierarchyNodeTriState(menNode, nodes, afterUncheckLevis);
    const afterMenNone = toggleHierarchyNodeTriState(menNode, nodes, afterMenAllAgain);
    expect(getHierarchyNodeTriState(menNode, nodes, afterMenNone)).toBe("none");
    expect(getHierarchyNodeTriState(jeansNode, nodes, afterMenNone)).toBe("none");

    // 5. Clicking Men ("none") -> cycles back to "some" (expands DEPT:Men only)
    const afterMenSome = toggleHierarchyNodeTriState(menNode, nodes, afterMenNone);
    expect(getHierarchyNodeTriState(menNode, nodes, afterMenSome)).toBe("some");
    expect(getHierarchyNodeTriState(jeansNode, nodes, afterMenSome)).toBe("none");

    // 6. Clicking a single L3 leaf ("Calvin Klein") when Jeans is "none" checks ONLY Calvin Klein,
    // leaving Levi's unchecked ("none"), and sets Jeans (L2), Men (L1), and All Products (L0) to "some"
    const calvinNode = projected.memberIdToNode["BRAND:Men|Jeans|Calvin Klein"];
    const afterClickCalvin = toggleHierarchyNodeTriState(calvinNode, nodes, initialExpanded);
    expect(getHierarchyNodeTriState(calvinNode, nodes, afterClickCalvin)).toBe("all");
    expect(getHierarchyNodeTriState(levisNode, nodes, afterClickCalvin)).toBe("none");
    expect(getHierarchyNodeTriState(jeansNode, nodes, afterClickCalvin)).toBe("some");
    expect(getHierarchyNodeTriState(menNode, nodes, afterClickCalvin)).toBe("some");
    expect(getHierarchyNodeTriState(allNode, nodes, afterClickCalvin)).toBe("some");

    // Clicking Calvin Klein a second time unchecks Calvin Klein and resets Jeans back to "none"
    const afterUncheckCalvin = toggleHierarchyNodeTriState(calvinNode, nodes, afterClickCalvin);
    expect(getHierarchyNodeTriState(calvinNode, nodes, afterUncheckCalvin)).toBe("none");
    expect(getHierarchyNodeTriState(jeansNode, nodes, afterUncheckCalvin)).toBe("none");
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

  test("supports foldable L1-default hierarchy tree, sticky L1/L2/L3 headers (L0 non-sticky), and async child loading on unfold", async () => {
    // 1. Default folded state ("ALL" unfolded) shows ONLY L0 (All Products) and L1 (Men, Women)
    const defaultVisible = getVisibleHierarchyModalNodes(
      STARTER_HIERARCHY_CATALOG_NODES,
      DEFAULT_MODAL_UNFOLDED_IDS,
    );
    expect(defaultVisible.map((n) => n.memberId)).toEqual(["ALL", "DEPT:Men", "DEPT:Women"]);

    // 2. Unfolding L1 ("DEPT:Men") reveals Men's 14 L2 categories while keeping L3 brands and Women's L2 categories folded
    const afterUnfoldMen = getVisibleHierarchyModalNodes(STARTER_HIERARCHY_CATALOG_NODES, [
      "ALL",
      "DEPT:Men",
    ]);
    expect(afterUnfoldMen.some((n) => n.memberId === "CAT:Men|Jeans")).toBe(true);
    expect(afterUnfoldMen.some((n) => n.isLeaf)).toBe(false);
    expect(afterUnfoldMen.some((n) => n.parentId === "DEPT:Women")).toBe(false);

    // 3. Unfolding L2 ("CAT:Men|Jeans") reveals L3 brands under Jeans (including Calvin Klein & Levi's)
    const afterUnfoldJeans = getVisibleHierarchyModalNodes(STARTER_HIERARCHY_CATALOG_NODES, [
      "ALL",
      "DEPT:Men",
      "CAT:Men|Jeans",
    ]);
    expect(
      afterUnfoldJeans.some((n) => n.memberId === "BRAND:Men|Jeans|Calvin Klein"),
    ).toBe(true);
    expect(afterUnfoldJeans.some((n) => n.memberId === "BRAND:Men|Jeans|Levi's")).toBe(true);

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
            [pcConfig.memberIdField]: "BRAND:Men|Jeans|Levi's",
            [pcConfig.parentIdField]: "CAT:Men|Jeans",
            [pcConfig.labelField]: "Levi's",
            [pcConfig.pathField]: "All Products|Men|Jeans|Levi's",
            [pcConfig.levelField]: 3,
            [pcConfig.isLeafField]: "Yes",
          },
        ];
      },
    };
    const loadedChildren = await fetchHierarchyModalChildren(
      mockAsyncSDK,
      "lookbase",
      ["CAT:Men|Jeans"],
      pcConfig,
    );
    expect(sdkCalls).toHaveLength(1);
    expect(sdkCalls[0].filters[pcConfig.parentIdField]).toBe("CAT:Men|Jeans");
    expect(loadedChildren).toHaveLength(1);
    expect(loadedChildren[0].memberId).toBe("BRAND:Men|Jeans|Levi's");
  });

  test("preserves L2 Accessories position and places L3 brands directly underneath when expanded, enforces 8x N-level indentation, and supports unlimited L1-default autocomplete with L2/L3 checkboxes", () => {
    // 1. N-level indentation in multiples of 8px (8x)
    for (let level = 0; level <= 8; level += 1) {
      const indentPx = getOutlineIndentationPx(level, 16);
      expect(indentPx).toBe(level * 16);
      expect(indentPx % 8).toBe(0);
      expect((8 + indentPx) % 8).toBe(0);
    }

    // 2. Expanding L2 "CAT:Men|Accessories" appends L3 brands at the end of outlineRows via mergeOutlineRows;
    //    verify Accessories stays at the top of Men and its L3 brands appear immediately underneath Accessories (before Jeans)
    const initialWithUnexpandedAccessories = [
      {
        [pcConfig.memberIdField]: { value: "CAT:Men|Accessories" },
        [pcConfig.parentIdField]: { value: "DEPT:Men" },
        [pcConfig.labelField]: { value: "Accessories" },
        [pcConfig.pathField]: { value: "All Products|Men|Accessories" },
        [pcConfig.levelField]: { value: 2 },
        [pcConfig.isLeafField]: { value: "No" },
        "long_metrics.total_sale_price": {
          Current: { value: 340000, rendered: "$340,000" },
          "Last Year": { value: 298000, rendered: "$298,000" },
        },
        "long_metrics.total_gross_margin": {
          Current: { value: 170000, rendered: "$170,000" },
          "Last Year": { value: 149000, rendered: "$149,000" },
        },
      },
      ...STARTER_OUTLINE_QUERY_RESPONSE.data,
    ];
    const lazyFetchedAccessoriesBrands = [
      {
        [pcConfig.memberIdField]: { value: "BRAND:Men|Accessories|Ray-Ban" },
        [pcConfig.parentIdField]: { value: "CAT:Men|Accessories" },
        [pcConfig.labelField]: { value: "Ray-Ban" },
        [pcConfig.pathField]: { value: "All Products|Men|Accessories|Ray-Ban" },
        [pcConfig.levelField]: { value: 3 },
        [pcConfig.isLeafField]: { value: "Yes" },
        "long_metrics.total_sale_price": {
          Current: { value: 185000, rendered: "$185,000" },
          "Last Year": { value: 160000, rendered: "$160,000" },
        },
        "long_metrics.total_gross_margin": {
          Current: { value: 92000, rendered: "$92,000" },
          "Last Year": { value: 80000, rendered: "$80,000" },
        },
      },
      {
        [pcConfig.memberIdField]: { value: "BRAND:Men|Accessories|Oakley" },
        [pcConfig.parentIdField]: { value: "CAT:Men|Accessories" },
        [pcConfig.labelField]: { value: "Oakley" },
        [pcConfig.pathField]: { value: "All Products|Men|Accessories|Oakley" },
        [pcConfig.levelField]: { value: 3 },
        [pcConfig.isLeafField]: { value: "Yes" },
        "long_metrics.total_sale_price": {
          Current: { value: 155000, rendered: "$155,000" },
          "Last Year": { value: 138000, rendered: "$138,000" },
        },
        "long_metrics.total_gross_margin": {
          Current: { value: 78000, rendered: "$78,000" },
          "Last Year": { value: 69000, rendered: "$69,000" },
        },
      },
    ];

    const mergedAfterAccessoriesExpand = mergeOutlineRows(
      initialWithUnexpandedAccessories,
      lazyFetchedAccessoriesBrands,
      pcConfig,
    );
    const projectedAfterAccessories = projectOutlineRowsToReportTable(
      mergedAfterAccessoriesExpand,
      STARTER_OUTLINE_QUERY_RESPONSE,
      pcConfig,
      4,
    );
    const tableModel = new VisPluginTableModel(
      projectedAfterAccessories.queryResponse.data,
      projectedAfterAccessories.queryResponse,
      {
        theme: "custom",
        customTheme: "",
        rowSubtotals: true,
        subtotalStyle: "collapsed",
        subtotalsOnTop: true,
        startFolded: true,
        expandSubtotals:
          "All Products,All Products|Men,All Products|Men|Accessories,All Products|Men|Jeans",
        indexColumn: true,
        spanCols: true,
        spanRows: true,
        arrowStyle: "plus_minus",
      },
    );

    const rowIds = tableModel.getDataRows().map((r: any) => String(r.id));
    const menIdx = rowIds.findIndex((id: string) => id === "Subtotal|All Products|Men");
    const accessoriesSubtotalIdx = rowIds.findIndex(
      (id: string) => id === "Subtotal|All Products|Men|Accessories",
    );
    const oakleyLeafIdx = rowIds.findIndex((id: string) =>
      id.includes("All Products|Men|Accessories|Oakley"),
    );
    const rayBanLeafIdx = rowIds.findIndex((id: string) =>
      id.includes("All Products|Men|Accessories|Ray-Ban"),
    );
    const jeansSubtotalIdx = rowIds.findIndex(
      (id: string) => id === "Subtotal|All Products|Men|Jeans",
    );

    expect(menIdx).toBeGreaterThanOrEqual(0);
    // Accessories L2 subtotal row stays immediately after Men L1 subtotal row (not moved to bottom!)
    expect(accessoriesSubtotalIdx).toBe(menIdx + 1);
    // Oakley and Ray-Ban L3 brand rows appear directly underneath Accessories (before Jeans)
    expect(oakleyLeafIdx).toBe(accessoriesSubtotalIdx + 1);
    expect(rayBanLeafIdx).toBe(accessoriesSubtotalIdx + 2);
    expect(jeansSubtotalIdx).toBe(rayBanLeafIdx + 1);

    // 3. Autocomplete: unlimited default, L1 default (includes both Men and Women), and L2/L3 checkboxes
    const fullCatalog = buildAutocompleteCatalog(
      DEFAULT_CALCULATIONS_CONFIG,
      [],
      Object.values(projectedAfterAccessories.memberIdToNode),
    );
    const defaultL1Results = searchAutocompleteItems(
      "",
      fullCatalog,
      Infinity,
      DEFAULT_AUTOCOMPLETE_MEMBER_LEVELS,
    );
    const defaultMemberItems = defaultL1Results.filter((item) => item.category === "member");
    expect(defaultMemberItems.map((m) => m.label)).toEqual(["Men", "Women"]);

    const withL2Results = searchAutocompleteItems("", fullCatalog, Infinity, [1, 2]);
    const withL2Members = withL2Results.filter((item) => item.category === "member");
    expect(withL2Members.some((m) => m.label === "Women")).toBe(true);
    expect(withL2Members.some((m) => m.label === "Accessories" && m.level === 2)).toBe(true);
    expect(withL2Members.some((m) => m.level === 3)).toBe(false);

    const withL3Results = searchAutocompleteItems("", fullCatalog, Infinity, [1, 2, 3]);
    const withL3Members = withL3Results.filter((item) => item.category === "member");
    expect(withL3Members.some((m) => m.label === "Ray-Ban" && m.level === 3)).toBe(true);
    expect(withL3Results.length).toBeGreaterThan(20); // Unlimited (previously capped at 18)

    // 4. Virtualized window calculation
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
});



