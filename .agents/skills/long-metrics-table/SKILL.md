---
name: long-metrics-table
description: Guide and patterns for creating, managing, and consuming long metrics (narrow format) tables in LookML.
---

# Managing metrics and dimensions in long-metrics.view.lkml

This document describes the pattern used in `long-metrics.view.lkml` for defining and aggregating metrics, along with instructions on how to add new dimensions and measures.

## Overview of the pattern

`long-metrics.view.lkml` uses a narrow, long-table format for metrics to support flexible reporting. It combines derived tables and `UNION ALL` queries to stack data for different metrics and timeframes:

- Views with `extension: required` (such as `base_fields` and `day_agg_fields`) share common fields across different aggregation levels.
- Metric-specific views like `metric_total_sale_price` compute window functions (running totals, rolling averages) over an explore source (`order_items`).
- The combined `long_metrics` view uses a derived table with `UNION ALL` queries to stack data for different metrics and timeframes into a single table, exposing individual measures by filtering on a `metric` dimension.

## How-to guides

### Adding a new dimension from products or other joined views

To add a new dimension (such as `category` from the `products` view, which is joined in the `order_items` explore):

1. In the source metric view (`metric_total_sale_price`), add the new dimension as a column inside the `explore_source` block:
   ```lookml
   column: category { field: products.category }
   ```
   If the dimension is a string, wrap it in `TRIM()` in the metric view or trim it in the destination view to avoid join mismatches caused by trailing spaces.
2. Define the dimension in the corresponding view (either in `base_fields` or directly in `metric_total_sale_price`):
   ```lookml
   dimension: category { type: string }
   ```
3. In the `derived_table` block of the combined view (`long_metrics`), update every `SELECT` statement in the `UNION ALL` query to include the new column in the exact same column order across all branches:
   ```sql
   SELECT source, product_id, category, row_count, dt, month, quarter, year, r7d as value, ...
   ```
   Then add the dimension definition in the `long_metrics` view:
   ```lookml
   dimension: category {}
   ```

### Adding a new measure

To add a new measure that follows this pattern (for example, `total_gross_margin`):

1. Create a new metric view patterned after `metric_total_sale_price` (such as `metric_total_gross_margin`). In its `explore_source`, map the source field for `value` to the measure or field representing gross margin:
   ```lookml
   column: value { field: order_items.total_gross_margin }
   ```
2. In the `derived_table` block of `long_metrics`, add a new set of `UNION ALL` branches that select from the new metric view and hardcode the metric name as `'Total Gross Margin'` in the `SELECT` list:
   ```sql
   UNION ALL
   SELECT source, product_id, row_count, dt, month, quarter, year, r7d as value, 'r7d' as timeframe, 'Total Gross Margin' as metric, 'calculated' as calculated_view FROM ${metric_total_gross_margin.SQL_TABLE_NAME}
   ```
3. Define a new measure in `long_metrics` that sums the `value` column and filters for this specific metric:
   ```lookml
   measure: total_gross_margin {
     type: sum
     sql: ${TABLE}.value ;;
     filters: [metric: "Total Gross Margin"]
   }
   ```

### Post-aggregation calculations

For non-additive calculations that cannot be pre-aggregated (such as percentages or ratios like `gross_margin_percentage`), define them as `type: number` measures in the combined `long_metrics` view:

1. Verify that the component metrics already exist as filtered sum measures in the `long_metrics` view:
   ```lookml
   measure: total_sale_price {
     type: sum
     sql: ${TABLE}.value ;;
     filters: [metric: "Total Sale Price"]
   }
   measure: total_gross_margin {
     type: sum
     sql: ${TABLE}.value ;;
     filters: [metric: "Total Gross Margin"]
   }
   ```
2. Add a `type: number` measure that references the component measures:
   ```lookml
   measure: gross_margin_percentage {
     type: number
     sql: ${total_gross_margin} / NULLIF(${total_sale_price}, 0) ;;
     value_format_name: percent_2
   }
   ```
   This runs the division after SQL aggregation, regardless of which dimensions are selected in the query.

### Period alignment and conditional filtering

The `long_metrics` explore uses Liquid conditionals to manage the period alignment pattern.

#### Dynamic source filtering

```sql
{% condition source_parameter %} ${source} {% endcondition %}
```

This binds `source_parameter` to the `${source}` dimension so the UI can switch the data grain (such as Daily vs. Monthly) through a parameter injected into the SQL `WHERE` clause.

#### Default period filtering

```sql
{% if long_metrics.current_period._is_filtered or long_metrics.current_period._is_selected %}
  1=1
{% else %}
  ${current_period} = 'Current'
{% endif %}
```

The period alignment pattern unions historical data (such as `'Last Year'`) and maps it to the current date for pivoting, which creates multiple rows for the same date (`'Current'`, `'Last Year'`, etc.):
- When a user selects or filters on the `current_period` dimension, they are asking for period comparisons, so the filter evaluates to `1=1`.
- When a user does not include `current_period`, the explore defaults to `${current_period} = 'Current'` so historical comparison rows do not inflate standard totals.

### Adding quick-start queries to the explore

To make these stacked metrics easier to explore, define pre-configured `query` blocks inside `explore: long_metrics` whenever you add a new metric, timeframe, or slice:

1. Add the `query` block inside `explore: long_metrics`:
   ```lookml
   explore: long_metrics {
     # ...
     query: query_name {
       label: "User Friendly Label"
       description: "Detailed description of what this pre-configured query returns."
       dimensions: [dimension_1, dimension_2]
       measures: [measure_1, measure_2]
       filters: [
         long_metrics.timeframe: "desired_timeframe",
         long_metrics.source_parameter: "desired_source",
         long_metrics.current_period: "Current"
       ]
     }
   }
   ```
2. Always include the appropriate `timeframe` (`r7d`, `mtd`, `ytd`) and `source_parameter` filters. If the query does not compare periods, set `current_period: "Current"` to avoid duplicate values.

### Preventing double-counting

Because a long metrics table stacks multiple timeframes (`r7d`, `r28d`, `ytd`) and comparison periods (`Current`, `Last Year`) as rows, queries that omit filters on those dimensions will sum different timeframes together.

To prevent double-counting:

1. Configure `always_filter` in the explore definition so queries require default filters for the stacked dimensions:
   ```lookml
   explore: long_metrics {
     always_filter: {
       filters: [
         source_parameter: "Daily Actual",
         timeframe: "current_view"
       ]
     }
   }
   ```
2. Add `sql_always_where` with Liquid logic so dimensions that control period alignment (like `current_period`) default to the current period unless the user selects or filters on the comparison period:
   ```lookml
   sql_always_where: 
     {% if long_metrics.current_period._is_filtered or long_metrics.current_period._is_selected %}
       1=1
     {% else %}
       ${current_period} = 'Current'
     {% endif %}
     ;;
   ```
