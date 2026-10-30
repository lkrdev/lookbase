# LookBase quick-start actions and central query parameter reference

In LookBase, every application state maps to a deterministic set of URL query parameters (`LookBaseUrlState`). A Quick-Start Action is a named preset of URL query parameters (`{ id, label, params }`) rather than hardcoded UI logic:
1. You can configure actions at the project level in [lookbase.config.json](file:///usr/local/google/home/bryanweber/lkrdev/lookbase/lookbase.config.json) (deployed via `calculations.strings.json`).
2. Any logged-in user can create an action in one click using the `+ Save Current View` button on the Quick-Start bar, which saves it per user in `user_<userId>_lookbase_prefs.customQuickStartActions` via the Looker Artifacts API.
3. Users can dismiss individual pills by clicking the `×` on that pill (`user_<userId>_lookbase_prefs.dismissedQuickStartIds`), or reset all dismissed pills at any time via `?quickstart=reset` or the `Restore Pills` button.

## Central URL query parameter reference

Every parameter below can be passed directly in the browser URL (for example, `https://googledemo2.cloud.looker.com/extensions/lookbase::lookbase/?version=sandbox&expanded=ROOT,ALL,DEPT:Men,CAT:Men|Jeans&member=CAT:Men|Jeans&tour=0`) or inside a Quick-Start Action's `params` object.

### Precedence order on page load
$$\text{1. URL Query Parameters } (\texttt{?...}) \quad \succ \quad \text{2. User Artifact } (\texttt{user\_<id>\_lookbase\_prefs}) \quad \succ \quad \text{3. Project Config } (\texttt{lookbase.config.json})$$

| Query parameter | Type / format | Allowed / example values | Default (`lookbase.config.json`) | What it controls |
| :--- | :--- | :--- | :--- | :--- |
| `version` | `string` | `base`, `sandbox`, `fcst_v1`, `fcst_v2`, `budget_final` | `base` | Active POV Scenario Version slice (routes SQL to Base PDT, Personal Sandbox BigQuery `CLONE`, or promoted version table). |
| `timeframe` | `string` | `ytd`, `current_view`, `r7d`, `r28d`, `r90d`, `r3m`, `r12m` | `ytd` | Active POV Stacked Timeframe slice (`long_metrics.timeframe`). |
| `source` | `string` | `Daily Actual`, `Monthly Actual`, `Quarterly Actual` | `Daily Actual` | Active POV Aggregation Grain (`long_metrics.source_parameter`). |
| `year` | `string` | `ALL`, `2024`, `2023` | `ALL` | Active POV Year filter (`long_metrics.year`). |
| `member` | `string` | `ALL`, `DEPT:Men`, `CAT:Men\|Jeans`, `BRAND:Men\|Jeans\|Levi's` | `ALL` | Active selected outline `member_id` (drives the Left-Hand Metrics table and Formula Bar coordinate). |
| `expanded` | `CSV of member_ids` | `ROOT,ALL,DEPT:Men,CAT:Men\|Jeans` | `ROOT,ALL,DEPT:Men,DEPT:Women` | Expanded parent `member_id`s in the outline tree. Deterministically derives `expandedPaths` and batches `WHERE parent_id IN (...)` on load. |
| `metrics` | `CSV of metric IDs` | `long_metrics.total_sale_price,calc:gm_pct,custom:MEMBER('Total Sale Price')*1.1` | `long_metrics.total_sale_price,long_metrics.total_gross_margin,calc:gm_pct,calc:pct_of_parent,calc:implied_cogs` | Ordered list of measures, two-pass calculations, variance calcs, or `custom:<formula>` rows in the Left-Hand Metrics table. |
| `pane` | `1` \| `0` | `pane=1` (open), `pane=0` (hidden) | `1` | Toggles visibility of the Left-Hand Side Metrics & Autocomplete dock. |
| `q` | `string` | `q=margin` | `""` | Pre-fills the Left-Hand Metric Autocomplete combobox and opens the dropdown with matching items. |
| `modal` | `hierarchy` \| `""` | `modal=hierarchy` | `""` | Opens the Recursive CTE Jagged Hierarchy Filter modal immediately. |
| `edit` | `string` | `edit=%2B10%25` (`+10%`), `edit=500000` | `""` | Pre-fills the Sandbox cell delta writeback input in the Formula Bar. |
| `quickstart` | `1` \| `0` \| `reset` | `quickstart=1`, `quickstart=0`, `quickstart=reset` | `1` | `1` = force show Quick-Start bar; `0` = hide Quick-Start bar; `reset` = restore all individually dismissed Quick-Start pills. |
| `tour` | `1` \| `0` \| `<uuid>` \| `reset` | `tour=0`, `tour=1`, `tour=reset`, `tour=6f8a1c30-...` | Auto-queue unseen | `0` = suppress guided tour on load; `1` = force launch tour; `<uuid>` = launch a specific guide by UUID; `reset` = clear `dismissedGuideIds` and launch Guide 1. |

## Default configurable quick-start actions

The default Quick-Start pills are defined declaratively in `lookbase.config.json` under `quick_start_actions`:

```json
{
  "quick_start_actions": [
    {
      "id": "qs_search_margin",
      "label": "1. Search Left-Hand Metric Autocomplete (\"margin\")",
      "params": {
        "pane": true,
        "q": "margin"
      }
    },
    {
      "id": "qs_expand_men_women",
      "label": "2. Expand Men & Women Hierarchy Branches",
      "params": {
        "expanded": ["ROOT", "ALL", "DEPT:Men", "DEPT:Women"]
      }
    },
    {
      "id": "qs_open_hierarchy_modal",
      "label": "3. Open Recursive CTE Hierarchy Filter",
      "params": {
        "modal": "hierarchy"
      }
    },
    {
      "id": "qs_preview_sandbox_delta",
      "label": "4. Preview +10% Sandbox Writeback on Men",
      "params": {
        "version": "sandbox",
        "member": "DEPT:Men",
        "edit": "+10%"
      }
    }
  ]
}
```

| Pill ID | Label | What `applyUrlState(action.params)` does | Equivalent URL query string |
| :--- | :--- | :--- | :--- |
| `qs_search_margin` | `1. Search Left-Hand Metric Autocomplete ("margin")` | Opens the Left-Hand Metrics pane (`pane=1`), sets the search input to `"margin"` (`q=margin`), focuses the input, and opens the autocomplete dropdown. | `?pane=1&q=margin` |
| `qs_expand_men_women` | `2. Expand Men & Women Hierarchy Branches` | Expands `ROOT`, `ALL`, `DEPT:Men`, and `DEPT:Women` (`All Products`, `All Products\|Men`, `All Products\|Women`), fetches any uncached child categories, and persists the expansion. | `?expanded=ROOT,ALL,DEPT:Men,DEPT:Women` |
| `qs_open_hierarchy_modal` | `3. Open Recursive CTE Hierarchy Filter` | Opens the Jagged Product / Organization Hierarchy (`WITH RECURSIVE` CTE) modal (`modal=hierarchy`). | `?modal=hierarchy` |
| `qs_preview_sandbox_delta` | `4. Preview +10% Sandbox Writeback on Men` | Switches POV Version to `sandbox`, selects `DEPT:Men` (`All Products\|Men`), populates the Formula Bar with `=GETVALUE(...)`, and pre-fills `+10%` in the delta input. | `?version=sandbox&member=DEPT:Men&edit=%2B10%25` |

## Individual pill dismissal and user-created custom actions

### Dismissing individual quick-start pills
- Every Quick-Start pill has its own inline `×` button:
  - Clicking `×` on a built-in pill appends its `id` (such as `"qs_search_margin"`) to `dismissedQuickStartIds: string[]` in `user_<userId>_lookbase_prefs` via the Looker Artifacts API, hiding only that pill while the remaining pills stay visible.
  - Clicking `×` on a user-created custom pill removes it from `customQuickStartActions`.
- Clicking `Restore Pills` (or visiting `?quickstart=reset`) clears `dismissedQuickStartIds` and restores all default pills.
- Clicking the bar-level `✕` button at the far right hides the entire Quick-Start strip (`quickStartDismissed: true`).

### Creating custom quick-start actions
- Clicking `+ Save Current View` on the Quick-Start bar lets any user name and save their current state (`version`, `timeframe`, `source`, `year`, `member`, `expanded`, `metrics`, `pane`, `edit`) as a personal Quick-Start pill in `user_<userId>_lookbase_prefs.customQuickStartActions`.
- Because it stores a standard `QuickStartActionConfig` (`{ id, label, params }`), clicking a custom pill applies its saved `params` and updates the URL query string identically to built-in pills.
