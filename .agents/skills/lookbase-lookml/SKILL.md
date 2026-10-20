---
name: lookbase-lookml
description: >
  Extends the `long-metrics-table` skill with `member_id` / `parent_id` OLAP closure hierarchies
  (via BigQuery `UNNEST([STRUCT(...)])`), modular per-measure views, PDT materialization rules,
  on-demand cube rebuilds (`rebuild_pdts: true` and `start_pdt_build`), BigQuery BI Engine
  `ALTER BI_CAPACITY` pinning, and BigQuery `CLONE` zero-copy sandboxes for LookBase.
---

# Skill: LookBase OLAP Cube, `member_id`/`parent_id` Hierarchies & BigQuery `CLONE` Sandboxes (`lookbase-lookml`)

This skill builds directly on [`long-metrics-table`](../long-metrics-table/SKILL.md) to turn a narrow Long Metrics table into a full multidimensional OLAP cube with `(member_id, parent_id)` outline hierarchies, modular per-measure PDTs, on-demand cube rebuilds, BI Engine pinning, and BigQuery `CLONE` writeback sandboxes.

Always read [`.agents/skills/long-metrics-table/SKILL.md`](../long-metrics-table/SKILL.md) first for the core `explore_source` window functions, `source_parameter` filtering, and `current_period` alignment rules.

---

## 1. Modeling `member_id` and `parent_id` Hierarchies (`UNNEST` Closure Bridge & `WITH RECURSIVE`)

The base `long-metrics-table` pattern only exposes flat columns (`department`, `category`, `brand`) and a flat `metric` string. It lacks **`member_id` and `parent_id`**, which LookBase requires to:
1. Zoom in/out on any node by filtering `WHERE parent_id = '<clicked_member_id>'` without changing the query's `fields` list.
2. Query multiple expanded branches at different depths in a single SQL query without Looker needing `N` separate subtotal queries.
3. Apply unary consolidation operators (`+1`, `-1`, `0` ignore) across parent-child Account rollups.

### A. Option 1: Fixed-Depth `UNNEST([STRUCT(...)])` Closure Bridge (`dim_product_hierarchy`)
When hierarchy levels come from fixed columns (`department` -> `category` -> `brand`), you can use `UNNEST([STRUCT(...)])` over `products` to emit one closure row per `(product_id, hierarchy_level)`.

### A2. Option 2: Arbitrary-Depth / Jagged `WITH RECURSIVE` CTE Hierarchy (4–20 Levels)
For ragged or arbitrary-depth parent-child hierarchies (`(member_id, parent_id)` edges up to 20 levels deep), use BigQuery's **`WITH RECURSIVE` CTE** with **`persist_for: "24 hours"`** (critical: BigQuery only allows `WITH RECURSIVE` at the top level of a `SELECT` or `CREATE TABLE AS SELECT`, never inside an inline `(WITH RECURSIVE ...)` subquery join!) to compute `level_num`, `member_path`, and `ancestor_ids`:

```lookml
view: dim_product_hierarchy {
  derived_table: {
    persist_for: "24 hours"
    sql:
      WITH RECURSIVE
      raw_products AS (
        SELECT
          id AS product_id,
          TRIM(department) AS department,
          TRIM(category) AS category,
          TRIM(brand) AS brand
        FROM `looker-private-demo.thelook_ecommerce.products`
        WHERE department IS NOT NULL AND category IS NOT NULL AND brand IS NOT NULL
      ),
      hierarchy_edges AS (
        SELECT 'ALL' AS member_id, 'ROOT' AS parent_id, 'All Products' AS member_label, FALSE AS is_leaf
        UNION DISTINCT
        SELECT CONCAT('DEPT:', department), 'ALL', department, FALSE FROM raw_products
        UNION DISTINCT
        SELECT CONCAT('CAT:', department, '|', category), CONCAT('DEPT:', department), category, FALSE FROM raw_products
        UNION DISTINCT
        SELECT CONCAT('BRAND:', department, '|', category, '|', brand), CONCAT('CAT:', department, '|', category), brand, TRUE FROM raw_products
      ),
      recursive_outline AS (
        SELECT
          e.member_id,
          e.parent_id,
          e.member_label,
          e.member_label AS member_path,
          0 AS level_num,
          e.is_leaf,
          [e.member_id] AS ancestor_ids
        FROM hierarchy_edges AS e
        WHERE e.parent_id = 'ROOT'

        UNION ALL

        SELECT
          c.member_id,
          c.parent_id,
          c.member_label,
          CONCAT(p.member_path, '|', c.member_label) AS member_path,
          p.level_num + 1 AS level_num,
          c.is_leaf,
          ARRAY_CONCAT(p.ancestor_ids, [c.member_id]) AS ancestor_ids
        FROM hierarchy_edges AS c
        INNER JOIN recursive_outline AS p
          ON c.parent_id = p.member_id
        WHERE p.level_num < 20
      ),
      leaf_product_map AS (
        SELECT
          p.product_id,
          anc_id AS member_id
        FROM raw_products AS p
        INNER JOIN recursive_outline AS leaf
          ON leaf.member_id = CONCAT('BRAND:', p.department, '|', p.category, '|', p.brand)
        CROSS JOIN UNNEST(leaf.ancestor_ids) AS anc_id
      )
      SELECT
        m.product_id,
        o.member_id,
        o.parent_id,
        o.member_label,
        o.member_path,
        o.level_num,
        o.is_leaf
      FROM leaf_product_map AS m
      INNER JOIN recursive_outline AS o
        ON m.member_id = o.member_id
    ;;
  }

  dimension: pk {
    primary_key: yes
    hidden: yes
    sql: CONCAT(CAST(${TABLE}.product_id AS STRING), '|', ${TABLE}.member_id) ;;
  }
  dimension: product_id { type: number hidden: yes tags: ["lookbase:exclude"] }
  dimension: member_id { type: string label: "Member ID" tags: ["lookbase:member_id"] }
  dimension: parent_id { type: string label: "Parent Member ID" tags: ["lookbase:parent_id"] }
  dimension: member_label { type: string label: "Member Name" tags: ["lookbase:member_label"] }
  dimension: member_path { type: string label: "Member Path" tags: ["lookbase:member_path"] }
  dimension: level_num { type: number label: "Hierarchy Level" tags: ["lookbase:level_num"] }
  dimension: is_leaf { type: yesno label: "Is Leaf" tags: ["lookbase:is_leaf"] }
}
```

### B. Account / Metric Outline Bridge (`dim_account_hierarchy`)
Similarly, map atomic `long_metrics.metric` values into a parent-child Chart of Accounts with unary `sign_weight` (`+1` addition, `-1` subtraction):

```lookml
view: dim_account_hierarchy {
  derived_table: {
    sql:
      SELECT * FROM UNNEST([
        -- Root Rollup: Gross Margin = Total Sale Price (+1) - Total Cost (-1)
        STRUCT('ACCT:GM' AS account_id, 'ROOT' AS parent_account_id, 'Gross Margin' AS account_label, 'Gross Margin' AS account_path, 0 AS level_num, FALSE AS is_leaf, 'Total Gross Margin' AS base_metric, 1.0 AS sign_weight),
        -- Child 1: Total Sale Price (+1)
        STRUCT('ACCT:SALES' AS account_id, 'ACCT:GM' AS parent_account_id, 'Total Sale Price' AS account_label, 'Gross Margin|Total Sale Price' AS account_path, 1 AS level_num, TRUE AS is_leaf, 'Total Sale Price' AS base_metric, 1.0 AS sign_weight),
        -- Child 2: Total Gross Margin (+1)
        STRUCT('ACCT:MARGIN_LEAF' AS account_id, 'ACCT:GM' AS parent_account_id, 'Total Gross Margin' AS account_label, 'Gross Margin|Total Gross Margin' AS account_path, 1 AS level_num, TRUE AS is_leaf, 'Total Gross Margin' AS base_metric, 1.0 AS sign_weight)
      ])
    ;;
  }
  dimension: pk { primary_key: yes hidden: yes sql: CONCAT(${TABLE}.account_id, '|', ${TABLE}.base_metric) ;; }
  dimension: account_id { type: string }
  dimension: parent_account_id { type: string }
  dimension: account_label { type: string }
  dimension: account_path { type: string }
  dimension: level_num { type: number }
  dimension: is_leaf { type: yesno }
  dimension: base_metric { type: string hidden: yes }
  dimension: sign_weight { type: number hidden: yes }
}
```

### C. Preventing Fan-Out & Avoiding Full-Table Queries (Looker Row Limits)
Never query the full `WITH RECURSIVE` hierarchy table in one unfiltered query—a 10,000-node hierarchy pivoted across time periods will exceed Looker's 5,000-row limit.
1. **Default Root Guard (`sql_always_where`):** If `dim_product_hierarchy` is joined without an explicit `member_id`, `parent_id`, or `level_num` filter, default to `member_id = 'ALL'`:
```lookml
{% if dim_product_hierarchy._in_query %}
  {% if dim_product_hierarchy.member_id._is_selected or dim_product_hierarchy.member_id._is_filtered or dim_product_hierarchy.parent_id._is_filtered or dim_product_hierarchy.level_num._is_filtered %}
    1=1
  {% else %}
    ${dim_product_hierarchy.member_id} = 'ALL'
  {% endif %}
{% else %}
  1=1
{% endif %}
```
2. **Incremental Expansion (`WHERE parent_id = '<clicked_member_id>'`):**
   - Clicking `[+]` or double-clicking a node (`member_id = "DEPT:Men"`) runs `core40SDK.run_inline_query` with `filters: { ...baseFilters, "dim_product_hierarchy.parent_id": "DEPT:Men" }`, fetching only the direct children of that node.
3. **Saving & Restoring Multi-Branch Expansions on Load (`restoreSavedOutlineExpansion`):**
   - Persist both `expandSubtotals` (path strings) and `savedExpandedMemberIds` (`["ROOT", "ALL", "DEPT:Men", "CAT:Men|Jeans", ...]`) in URL query parameters (`?expanded=...`) and Looker User Artifacts (`user_<id>_lookbase_prefs`).
   - On initial load, group `["ROOT", "ALL", ...savedExpandedMemberIds]` into chunks (e.g., 20 parent IDs per batch so each query returns well under Looker's row limit) and fire them **all together on load** using Looker's comma-separated `IN` filter (`parent_id: "ROOT,ALL,DEPT:Men,CAT:Men|Jeans"`) wrapped in `Promise.all(...)`, then merge all returned rows by `member_id` in a single pass.
4. **Left-Hand Metric & Calculation Autocomplete:**
   - When Metrics / Accounts are placed down the Left-Hand Side (Column A) or inside the outline header, provide an inline autocomplete combobox (`searchAutocompleteItems`) that searches across:
     - LookML measures (`long_metrics.total_sale_price`, `long_metrics.total_gross_margin`, `long_metrics.gross_margin_percentage`),
     - Project-defined two-pass calculations (`calculations.strings.json` `two_pass_metrics` and `column_calcs`),
     - Outline hierarchy members (`member_id` / `member_label`), and
     - Ad-hoc multidimensional formulas (`=MEMBER(...)`, `=VAR(...)`, `=VARPER(...)`, `=PARENTVAL(...)`, `=GETVALUE(...)`).

---

## 2. Modular Per-Measure View Architecture & PDT Strategy

A single measure across 3 time grains (`Daily`, `Monthly`, `Quarterly`), ~13 rolling timeframes, and 4 period alignments (`Current`, `Yesterday`, `Last Month`, `Last Year`) produces **30+ `UNION ALL` branches per measure**.

### Rule A: Separate View File Per Measure (`metric_<measure_name>.view.lkml`)
- `base_fields.view.lkml` — shared extension views (`base_fields`, `day_agg_fields`, `month_agg_fields`, `quarter_agg_fields`, `booleans`), `dim_products`, `dim_product_hierarchy`, and `dim_account_hierarchy`.
- `metric_total_sale_price.view.lkml` — defines `metric_total_sale_price` (Daily), `metric_total_sale_price_month_aggregated` (Monthly), `metric_total_sale_price_quarter_aggregated` (Quarterly), and `stacked_total_sale_price` (all `UNION ALL` branches for `'Total Sale Price'`).
- `metric_total_gross_margin.view.lkml` — defines the same 4 views for `'Total Gross Margin'`.

### Rule B: Materialize Intermediate Views as PDTs When `UNION ALL` Grows Large
Add `persist_for: "24 hours"` (or `datagroup_trigger`) to:
1. Each base `metric_<measure>` daily/monthly/quarterly NDT (so window functions run **once** per measure instead of being inlined 20+ times as CTEs), AND
2. Each `stacked_<measure>` view once total `UNION ALL` branches exceed ~20 branches.

### Rule C: Final Cube View Unions the Per-Measure Stacked Views (`long_metrics.view.lkml`)
```lookml
view: long_metrics_base {
  derived_table: {
    persist_for: "24 hours"
    sql:
      SELECT * FROM ${stacked_total_sale_price.SQL_TABLE_NAME}
      UNION ALL
      SELECT * FROM ${stacked_total_gross_margin.SQL_TABLE_NAME}
    ;;
  }
}
```

---

## 3. On-Demand Cube Rebuilds (`rebuild_pdts: true` & `start_pdt_build`)

1. **Synchronous Rebuild on Query (`run_inline_query` with `rebuild_pdts: true`):**
   - **Full Cube Rebuild (`CALC ALL`):** `core40SDK.run_inline_query({ result_format: "json_detail", rebuild_pdts: true, cache: false, body })` on `long_metrics` rebuilds `long_metrics_base` and upstream `stacked_<measure>` PDTs.
   - **Single-Measure Rebuild (`CALC Measure`):** Querying `stacked_total_sale_price` with `rebuild_pdts: true` rebuilds only that measure's PDT.
2. **Asynchronous Background Materialization (`start_pdt_build` + `check_pdt_build`):**
   - `core40SDK.start_pdt_build({ model_name: "lookbase", view_name: "long_metrics_base", force_rebuild: true })`.

---

## 4. BigQuery BI Engine Pinning & `CLONE` Sandboxes

Reference `${long_metrics_base.SQL_TABLE_NAME}` inside a `persist_for: "1 second"` `create_process` view (`lookbase_writeback`) triggered via `run_inline_query(..., rebuild_pdts: true, cache: false)`:
- **`init_sandbox`:** `CREATE OR REPLACE TABLE ${long_metrics_base.SQL_TABLE_NAME}_sandbox_{{ _user_attributes['id'] }} CLONE ${long_metrics_base.SQL_TABLE_NAME}` (~1s, $0 storage).
- **`write_delta`:** Proportional `INSERT INTO ... SELECT` weighted by `SAFE_DIVIDE(value, NULLIF(SUM(value) OVER (), 0))` (supports writing deltas by `member_id` via `dim_product_hierarchy` or by `department`).
- **`compact_and_promote` / `clone_version`:** Compacts deltas via `GROUP BY` or zero-copy clones between named versions (`fcst_v1`, `fcst_v2`, `budget_final`) and pins via `ALTER BI_CAPACITY`.

