import React from "react";
import {
  AutocompleteItem,
  CalculationsConfig,
  evaluateLeftHandMetricRow,
  formatLookBaseValue,
  formatTimeframeShortLabel,
  getVirtualizedAutocompleteWindow,
  LookBaseHierarchyDef,
  OutlineNodeMeta,
} from "./essbaseEngine";

export interface LookBaseLeftMetricsPaneProps {
  showLeftMetricsPane: boolean;
  isSkeletonLoading?: boolean;
  activeOutlineNode?: OutlineNodeMeta;
  parentOutlineNode?: OutlineNodeMeta;
  activeHierarchyDef: LookBaseHierarchyDef;
  selectedOutlineMemberId: string;
  autocompleteInputRef: React.RefObject<HTMLInputElement>;
  leftMetricQuery: string;
  setLeftMetricQuery: React.Dispatch<React.SetStateAction<string>>;
  isAutocompleteOpen: boolean;
  setIsAutocompleteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  highlightedIndex: number;
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
  handleAutocompleteKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  replacingRowId: string | null;
  setReplacingRowId: React.Dispatch<React.SetStateAction<string | null>>;
  availableMemberLevels: number[];
  autocompleteMemberLevels: number[];
  setAutocompleteMemberLevels: React.Dispatch<React.SetStateAction<number[]>>;
  autocompleteScrollTop: number;
  setAutocompleteScrollTop: React.Dispatch<React.SetStateAction<number>>;
  autocompleteMatches: AutocompleteItem[];
  handleSelectAutocompleteItem: (item: AutocompleteItem) => void;
  selectedTimeframes: string[];
  activeLeftTimeframe: string;
  setLeftPaneTimeframe: React.Dispatch<React.SetStateAction<string>>;
  leftMetricRows: AutocompleteItem[];
  calcConfig: CalculationsConfig;
  activeMetricRowId: string;
  setActiveMetricRowId: React.Dispatch<React.SetStateAction<string>>;
  setActiveCellCoord: React.Dispatch<React.SetStateAction<string>>;
  setFormulaText: React.Dispatch<React.SetStateAction<string>>;
  updateAndPersistLeftMetrics: (updater: (prev: AutocompleteItem[]) => AutocompleteItem[]) => void;
}

export const LookBaseLeftMetricsPane: React.FC<LookBaseLeftMetricsPaneProps> = ({
  showLeftMetricsPane,
  isSkeletonLoading = false,
  activeOutlineNode,
  parentOutlineNode,
  activeHierarchyDef,
  selectedOutlineMemberId,
  autocompleteInputRef,
  leftMetricQuery,
  setLeftMetricQuery,
  isAutocompleteOpen,
  setIsAutocompleteOpen,
  highlightedIndex,
  setHighlightedIndex,
  handleAutocompleteKeyDown,
  replacingRowId,
  setReplacingRowId,
  availableMemberLevels,
  autocompleteMemberLevels,
  setAutocompleteMemberLevels,
  autocompleteScrollTop,
  setAutocompleteScrollTop,
  autocompleteMatches,
  handleSelectAutocompleteItem,
  selectedTimeframes,
  activeLeftTimeframe,
  setLeftPaneTimeframe,
  leftMetricRows,
  calcConfig,
  activeMetricRowId,
  setActiveMetricRowId,
  setActiveCellCoord,
  setFormulaText,
  updateAndPersistLeftMetrics,
}) => {
  if (!showLeftMetricsPane) return null;

  return (
    <div className="lookbase-left-metrics-pane">
      <div className="lookbase-left-pane-header">
        <span>
          Row Inspector (
          {activeOutlineNode?.label || activeHierarchyDef.rootLabel || "All Products"})
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
        {isAutocompleteOpen &&
          autocompleteMatches.length > 0 &&
          (() => {
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
      {selectedTimeframes.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 8px",
            background: "#f8fafc",
            borderBottom: "1px solid #cbd5e1",
            fontSize: 10,
          }}
        >
          <span style={{ fontWeight: 600, color: "#334155" }}>Timeframe Slice:</span>
          <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
            {selectedTimeframes.map((tf) => {
              const isActiveTf = activeLeftTimeframe === tf;
              return (
                <button
                  key={`left-tf-${tf}`}
                  type="button"
                  onClick={() => setLeftPaneTimeframe(tf)}
                  style={{
                    padding: "1px 6px",
                    fontSize: 10,
                    fontWeight: isActiveTf ? 700 : 500,
                    borderRadius: 10,
                    border: isActiveTf ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
                    background: isActiveTf ? "#dbeafe" : "#ffffff",
                    color: isActiveTf ? "#1e3a8a" : "#334155",
                    cursor: "pointer",
                  }}
                >
                  {formatTimeframeShortLabel(tf)}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div
        id="lookbase-tour-left-table"
        className="lookbase-left-metrics-table-wrap"
        onClick={() => setIsAutocompleteOpen(false)}
      >
        <table className="lookbase-left-metrics-table">
          <thead>
            <tr>
              <th>Metric / Account ({formatTimeframeShortLabel(activeLeftTimeframe)})</th>
              <th>Current</th>
              <th>Last Year</th>
              <th>YoY Var %</th>
            </tr>
          </thead>
          <tbody>
            {isSkeletonLoading && leftMetricRows.length === 0
              ? Array.from({ length: 6 }, (_, sIdx) => (
                  <tr key={`skeleton-left-${sIdx}`}>
                    <td className="metric-row-header">
                      <span
                        className="lookbase-skeleton-bar"
                        style={{ width: sIdx % 2 === 0 ? "78%" : "64%" }}
                      />
                    </td>
                    <td>
                      <span className="lookbase-skeleton-bar" style={{ width: 56 }} />
                    </td>
                    <td>
                      <span className="lookbase-skeleton-bar" style={{ width: 56 }} />
                    </td>
                    <td>
                      <span className="lookbase-skeleton-bar" style={{ width: 42 }} />
                    </td>
                  </tr>
                ))
              : leftMetricRows.map((mRow, idx) => {
                  const curEval = evaluateLeftHandMetricRow(
                    mRow,
                    activeOutlineNode,
                    parentOutlineNode,
                    "Current",
                    calcConfig,
                    selectedTimeframes.length > 1 ? activeLeftTimeframe : undefined,
                  );
                  const lyEval = evaluateLeftHandMetricRow(
                    mRow,
                    activeOutlineNode,
                    parentOutlineNode,
                    "Last Year",
                    calcConfig,
                    selectedTimeframes.length > 1 ? activeLeftTimeframe : undefined,
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
                      <td>
                        {isSkeletonLoading ? (
                          <span className="lookbase-skeleton-bar" style={{ width: 58 }} />
                        ) : (
                          curEval.formatted
                        )}
                      </td>
                      <td>
                        {isSkeletonLoading ? (
                          <span className="lookbase-skeleton-bar" style={{ width: 58 }} />
                        ) : (
                          lyEval.formatted
                        )}
                      </td>
                      <td
                        style={{
                          color:
                            isSkeletonLoading || yoyPct === null
                              ? "#64748b"
                              : yoyPct >= 0
                                ? "#166534"
                                : "#b91c1c",
                          fontWeight: 600,
                        }}
                      >
                        {isSkeletonLoading ? (
                          <span className="lookbase-skeleton-bar" style={{ width: 42 }} />
                        ) : yoyPct !== null ? (
                          formatLookBaseValue(yoyPct, "+0.0%;-0.0%;0.0%")
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
