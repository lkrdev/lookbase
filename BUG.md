# LookBase bug tracker

Items remain unchecked (`[ ]`) until tested and confirmed fixed.

## Outline grid and hierarchy
- [ ] Brand and N-level hierarchy indentation did not keep increasing in multiples of `8px` (`8x`). Switching `ReportTable` to `theme: "custom", customTheme: ""` avoids the `.singleIndex { padding-left: 15px !important; }` override in `theme_traditional.css`, allowing `viz-report-table`'s native inline `padding-left: ${depth * 16}px` (`0px`, `16px`, `32px`, `48px`, `64px`, ..., $16 \times N\text{ px}$, all multiples of `8px`) to work across any $N$ levels without modifying `viz-report-table/`. The Hierarchy Modal also uses `getOutlineIndentationPx(level, 16)`.
- [ ] Expanding an `L2` row (such as `Accessories`) caused the `L2` row to disappear or move to the bottom of the grid with its `L3` brands at the bottom. `projectOutlineRowsToReportTable` previously iterated `allExtractedNodes` in `outlineRows` insertion order; when `mergeOutlineRows` appended newly fetched `BRAND:Men|Accessories|...` rows to the end of `outlineRows`, `Accessories` lost its placeholder at the top and its brand `line_item` rows landed at the end of `leafDataRows`, causing `VisPluginTableModel.addSubTotals()` to move the `Accessories` `L2` group to the bottom. Fixed by sorting `allExtractedNodes` with `sortOutlineNodesTreeOrder` and setting `sorts: []` on `projectedQueryResponse`.
- [ ] Collapsed sibling rows re-expanded after an async `L2` lazy fetch rebuilt `dataTable`. Added `syncCollapsedRowsDom` on `ReportTable` `onDone` so any rows inside `collapsedKeysRef` have their `.collapsed` class and hidden descendants restored immediately after the table rebuilds.

## Left-hand side autocomplete and member search
- [ ] `Women` (and other `L1` members) were missing from the initial autocomplete dropdown. Previously `searchAutocompleteItems` had a hard `limit = 18` cap and included all `L2` and `L3` members before `Women`. Defaulting member search to `L1` (`DEFAULT_AUTOCOMPLETE_MEMBER_LEVELS = [1]`) and removing the result cap (`limit = Infinity`) ensures all `L1` members (`Men`, `Women`, etc.) appear immediately.
- [ ] The autocomplete dropdown could not re-open on click after selecting an item without losing and regaining focus. Added `onClick={() => setIsAutocompleteOpen(true)}` on the search `<input>` so clicking the focused input immediately re-opens the dropdown.
- [ ] `searchAutocompleteItems` completed items needed virtualized window scrolling, debounced search, and no item cap:
  - Removed the `18`-item cap (`limit = Infinity` default in `searchAutocompleteItems`).
  - Added 150ms debounced search (`debouncedMetricQuery`).
  - Added virtualized window scrolling (`getVirtualizedAutocompleteWindow` with `itemHeight = 48`, `viewportHeight = 320`, `overscan = 5`).
- [ ] Member search needed to default to all `L1` members with checkboxes to include `L2`, `L3`, ..., `LN`. Added dynamic `L1`, `L2`, `L3`, ... checkboxes in the autocomplete header (`selectedMemberLevels` defaults to `[1]`, and checking `L2`, `L3`, etc. adds those hierarchy levels to the autocomplete results).

## Extension host and Rebuild Cube
- [ ] `Rebuild Cube` triggered an extension host chatty timeout notice. Configured `chattyTimeout: -1` in `connectExtensionHost({ chattyTimeout: -1 })` so long-running `Rebuild Cube` and `run_inline_query` operations do not time out.
