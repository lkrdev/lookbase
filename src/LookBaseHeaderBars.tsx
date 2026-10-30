import React from "react";
import {
  CalculationsConfig,
  formatMonthYearLabel,
  formatTimeframeLabel,
  formatTimeframeShortLabel,
  isCustomCalculationsConfig,
  LOOKBASE_TIMEFRAME_OPTIONS,
  LookBaseHierarchyDef,
  LookBaseMeasureDef,
  LookBaseUrlState,
  QuickStartActionConfig,
  serializeLookBaseUrlState,
} from "./essbaseEngine";
import { saveUserPrefsArtifact, startLookBaseTour } from "./lookbaseTour";

export interface LookBaseHeaderBarsProps {
  core40SDK: any;
  artifactNamespace: string;
  calcConfig: CalculationsConfig;
  showLeftMetricsPane: boolean;
  setShowLeftMetricsPane: React.Dispatch<React.SetStateAction<boolean>>;
  setIsHierarchyModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeHierarchyDef: LookBaseHierarchyDef;
  savedExpandedMemberIds: string[];
  effectiveActiveHierarchyId: string;
  effectiveAvailableHierarchies: LookBaseHierarchyDef[];
  effectiveEnabledHierarchyIds: string[];
  handleSwitchHierarchy: (nextHierarchyId: string) => void;
  isMeasuresDropdownOpen: boolean;
  setIsMeasuresDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  effectiveSelectedGridMeasureIds: string[];
  availableGridMeasures: LookBaseMeasureDef[];
  selectedGridMeasureIdsRef: React.MutableRefObject<string[]>;
  setSelectedGridMeasureIds: React.Dispatch<React.SetStateAction<string[]>>;
  loadStandaloneOutline: (
    versionOverride?: string,
    timeframeOverride?: string,
    sourceOverride?: string,
    yearOverride?: string,
    expandedMemberIdsOverride?: string[],
    hierarchyOverride?: string,
    configOverride?: CalculationsConfig,
    gridMeasuresOverride?: string[],
  ) => Promise<void>;
  povVersion: string;
  povTimeframe: string;
  povSource: string;
  povYear: string;
  availableYears: string[];
  selectedTimeframes: string[];
  isTimeframeDropdownOpen: boolean;
  setIsTimeframeDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handlePovChange: (
    nextVersion: string,
    nextTimeframe: string,
    nextSource: string,
    nextYear: string,
    changedField?: "source" | "timeframe",
  ) => void;
  canRebuildCube: boolean;
  canUpdateSettings: boolean;
  isBusy: boolean;
  handleRebuildCube: (viewToRebuild?: string) => void;
  handleOpenSettings: () => void;
  activeHierarchyId: string;
  showQuickStartBar: boolean;
  setShowQuickStartBar: React.Dispatch<React.SetStateAction<boolean>>;
  visibleQuickStartActions: QuickStartActionConfig[];
  applyUrlState: (urlPatch: LookBaseUrlState, triggerLiveSync?: boolean) => void;
  handleDismissQuickStartPill: (actionId: string) => void;
  isAddingCustomQuickStart: boolean;
  setIsAddingCustomQuickStart: React.Dispatch<React.SetStateAction<boolean>>;
  newQuickStartLabel: string;
  setNewQuickStartLabel: React.Dispatch<React.SetStateAction<string>>;
  handleSaveCustomQuickStart: () => void;
  dismissedQuickStartIds: string[];
  activeCellCoord: string;
  formulaText: string;
  setFormulaText: React.Dispatch<React.SetStateAction<string>>;
}

export const LookBaseHeaderBars: React.FC<LookBaseHeaderBarsProps> = ({
  core40SDK,
  artifactNamespace,
  calcConfig,
  showLeftMetricsPane,
  setShowLeftMetricsPane,
  setIsHierarchyModalOpen,
  activeHierarchyDef,
  savedExpandedMemberIds,
  effectiveActiveHierarchyId,
  effectiveAvailableHierarchies,
  effectiveEnabledHierarchyIds,
  handleSwitchHierarchy,
  isMeasuresDropdownOpen,
  setIsMeasuresDropdownOpen,
  effectiveSelectedGridMeasureIds,
  availableGridMeasures,
  selectedGridMeasureIdsRef,
  setSelectedGridMeasureIds,
  loadStandaloneOutline,
  povVersion,
  povTimeframe,
  povSource,
  povYear,
  availableYears,
  selectedTimeframes,
  isTimeframeDropdownOpen,
  setIsTimeframeDropdownOpen,
  handlePovChange,
  canRebuildCube,
  canUpdateSettings,
  isBusy,
  handleRebuildCube,
  handleOpenSettings,
  activeHierarchyId,
  showQuickStartBar,
  setShowQuickStartBar,
  visibleQuickStartActions,
  applyUrlState,
  handleDismissQuickStartPill,
  isAddingCustomQuickStart,
  setIsAddingCustomQuickStart,
  newQuickStartLabel,
  setNewQuickStartLabel,
  handleSaveCustomQuickStart,
  dismissedQuickStartIds,
  activeCellCoord,
  formulaText,
  setFormulaText,
}) => {
  const applyGridMeasures = (nextList: string[]) => {
    if (nextList.length === 0) return;
    selectedGridMeasureIdsRef.current = nextList;
    setSelectedGridMeasureIds(nextList);
    saveUserPrefsArtifact(core40SDK, { gridMeasureIds: nextList }, artifactNamespace);
    loadStandaloneOutline(
      povVersion,
      povTimeframe,
      povSource,
      povYear,
      savedExpandedMemberIds,
      effectiveActiveHierarchyId,
      calcConfig,
      nextList,
    );
  };

  return (
    <>
      {/* Top Ribbon */}
      <div className="lookbase-ribbon">
        <div className="lookbase-ribbon-left">
          <span id="lookbase-tour-brand" className="lookbase-brand">
            LookBase
          </span>
          <button
            className="lookbase-btn tour-btn"
            onClick={() => {
              setShowLeftMetricsPane(true);
              startLookBaseTour({
                core40SDK,
                namespace: artifactNamespace,
              });
            }}
            title="Start 8-step interactive Driver.js spotlight tour"
          >
            ? Guided Tour
          </button>
          <button
            className={`lookbase-btn ${showLeftMetricsPane ? "active-toggle" : ""}`}
            onClick={() => setShowLeftMetricsPane((v) => !v)}
            title="Toggle Row Inspector Dock"
          >
            Row Inspector
          </button>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <button
              id="lookbase-tour-hierarchy-btn"
              className="lookbase-btn"
              onClick={() => setIsHierarchyModalOpen(true)}
              title="Open Hierarchy Selector & Multi-Level Subtree Filter"
            >
              Hierarchy Selector: {activeHierarchyDef.shortLabel} ({savedExpandedMemberIds.length} Saved)
            </button>
            <select
              aria-label="Quick Switch Active Hierarchy"
              style={{
                height: 22,
                fontSize: 11,
                border: "1px solid #93c5fd",
                borderRadius: 3,
                background: "#eff6ff",
                color: "#1e3a8a",
                fontWeight: 600,
                padding: "0 4px",
                cursor: "pointer",
              }}
              value={effectiveActiveHierarchyId}
              onChange={(e) => handleSwitchHierarchy(e.target.value)}
              title="Quick-swap active dimensional hierarchy"
            >
              {effectiveAvailableHierarchies
                .filter((h) => effectiveEnabledHierarchyIds.includes(h.id))
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.shortLabel}
                  </option>
                ))}
            </select>
          </span>
          <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <button
              type="button"
              data-testid="grid-measures-multiselect-btn"
              className={`lookbase-btn ${isMeasuresDropdownOpen ? "active-toggle" : ""}`}
              onClick={() => setIsMeasuresDropdownOpen((v) => !v)}
              title="Select / Deselect LookML Measures shown as columns in the main outline grid"
            >
              Measures ({effectiveSelectedGridMeasureIds.length} Selected) ▾
            </button>
            {isMeasuresDropdownOpen && (
              <div
                data-testid="grid-measures-dropdown"
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  width: 340,
                  background: "#ffffff",
                  border: "1px solid #94a3b8",
                  borderRadius: 4,
                  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.18)",
                  zIndex: 360,
                  padding: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: 6,
                    marginBottom: 6,
                  }}
                >
                  <strong style={{ fontSize: 11, color: "#0f172a" }}>
                    Grid Columns ({effectiveSelectedGridMeasureIds.length} of{" "}
                    {availableGridMeasures.length})
                  </strong>
                  <div style={{ display: "inline-flex", gap: 4 }}>
                    <button
                      type="button"
                      className="lookbase-btn"
                      style={{ height: 18, fontSize: 10, padding: "0 5px" }}
                      onClick={() => {
                        const defaultList = calcConfig.initial_state?.grid_measures?.length
                          ? calcConfig.initial_state.grid_measures
                          : availableGridMeasures
                              .slice(0, 4)
                              .map((m) => m.fieldName || m.id);
                        applyGridMeasures(defaultList);
                      }}
                    >
                      Reset Default
                    </button>
                    <button
                      type="button"
                      className="lookbase-btn primary"
                      style={{ height: 18, fontSize: 10, padding: "0 6px" }}
                      onClick={() => setIsMeasuresDropdownOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    maxHeight: 280,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  {availableGridMeasures.map((m) => {
                    const mKey = m.fieldName || m.id;
                    const isChecked = effectiveSelectedGridMeasureIds.includes(mKey);
                    return (
                      <label
                        key={mKey}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "4px 6px",
                          borderRadius: 3,
                          background: isChecked ? "#eff6ff" : "transparent",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="checkbox"
                            data-testid={`grid-measure-opt-${mKey}`}
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked && effectiveSelectedGridMeasureIds.length <= 1) return;
                              const nextList = isChecked
                                ? effectiveSelectedGridMeasureIds.filter((id) => id !== mKey)
                                : [...effectiveSelectedGridMeasureIds, mKey];
                              applyGridMeasures(nextList);
                            }}
                          />
                          <span style={{ fontWeight: isChecked ? 700 : 500, color: "#0f172a" }}>
                            {m.label || mKey}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </span>
          <span id="lookbase-tour-actions" style={{ display: "inline-flex", gap: 6 }}>
            {canRebuildCube && (
              <>
                <button
                  className="lookbase-btn"
                  disabled={isBusy}
                  onClick={() => handleRebuildCube()}
                  title="Rebuild combined long_metrics_base PDT via run_inline_query(rebuild_pdts=true)"
                >
                  Calc All (Rebuild Cube)
                </button>
                {!isCustomCalculationsConfig(calcConfig) && (
                  <button
                    className="lookbase-btn"
                    disabled={isBusy}
                    onClick={() => handleRebuildCube("stacked_total_sale_price")}
                    title="Rebuild only the modular stacked_total_sale_price PDT"
                  >
                    Calc Sales PDT
                  </button>
                )}
              </>
            )}
            {canUpdateSettings && (
              <button
                id="lookbase-settings-btn"
                className="lookbase-btn"
                onClick={handleOpenSettings}
                title="Open LookBase Configuration Settings (Settings & Rebuild Cube Access Control + BI Engine Table List)"
              >
                ⚙ Settings
              </button>
            )}
          </span>
        </div>

        {/* Inline Top-Right POV Bar (Row 1 Slice Cells) */}
        <div id="lookbase-tour-pov" className="lookbase-ribbon-right">
          <span className="lookbase-pov-label">POV:</span>
          <div
            className="lookbase-pov-cell"
            style={{ position: "relative" }}
            title="Multi-Select Stacked Timeframe Slice (Select 1 or more timeframes, e.g., R3M + R12M)"
          >
            <span>Timeframe:</span>
            <button
              type="button"
              data-testid="pov-timeframe-multiselect-btn"
              onClick={() => setIsTimeframeDropdownOpen((v) => !v)}
              style={{
                border: "none",
                background: "transparent",
                fontWeight: 600,
                color: "#0f172a",
                fontSize: 11,
                cursor: "pointer",
                padding: "0 2px",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>
                {selectedTimeframes.length === 1
                  ? formatTimeframeLabel(selectedTimeframes[0])
                  : selectedTimeframes.map((tf) => formatTimeframeShortLabel(tf)).join(" + ")}
              </span>
              <span style={{ fontSize: 9, color: "#475569" }}>▾</span>
            </button>
            {isTimeframeDropdownOpen && (
              <div
                data-testid="pov-timeframe-dropdown"
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  width: 250,
                  background: "#ffffff",
                  border: "1px solid #94a3b8",
                  borderRadius: 4,
                  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.18)",
                  zIndex: 350,
                  padding: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: 6,
                    marginBottom: 6,
                  }}
                >
                  <strong style={{ fontSize: 11, color: "#0f172a" }}>
                    Select Timeframes ({selectedTimeframes.length})
                  </strong>
                  <div style={{ display: "inline-flex", gap: 4 }}>
                    <button
                      type="button"
                      className="lookbase-btn"
                      style={{ height: 18, fontSize: 10, padding: "0 5px" }}
                      onClick={() => setIsTimeframeDropdownOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    maxHeight: 240,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  {LOOKBASE_TIMEFRAME_OPTIONS.map((opt) => {
                    const isChecked = selectedTimeframes.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "3px 6px",
                          borderRadius: 3,
                          background: isChecked ? "#eff6ff" : "transparent",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="checkbox"
                            data-testid={`timeframe-opt-${opt.value}`}
                            checked={isChecked}
                            onChange={() => {
                              let nextList: string[];
                              if (isChecked) {
                                if (selectedTimeframes.length <= 1) return;
                                nextList = selectedTimeframes.filter((t) => t !== opt.value);
                              } else {
                                nextList = [...selectedTimeframes, opt.value];
                              }
                              handlePovChange(
                                povVersion,
                                nextList.join(","),
                                povSource,
                                povYear,
                                "timeframe",
                              );
                            }}
                          />
                          <span style={{ fontWeight: isChecked ? 700 : 500, color: "#0f172a" }}>
                            {opt.label}
                          </span>
                        </span>
                        <span style={{ fontSize: 9, color: "#64748b" }}>
                          {opt.grain.replace(" Actual", "")}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="lookbase-pov-cell" title="Aggregation Grain">
            <span>Grain:</span>
            <select
              value={povSource}
              onChange={(e) =>
                handlePovChange(povVersion, povTimeframe, e.target.value, povYear, "source")
              }
            >
              <option value="Daily Actual">Daily Actual</option>
              <option value="Monthly Actual">Monthly Actual</option>
              <option value="Quarterly Actual">Quarterly Actual</option>
            </select>
          </div>
          <div className="lookbase-pov-cell" title="Month + Year Slice">
            <span>Month:</span>
            <select
              aria-label="Month"
              value={povYear}
              onChange={(e) => handlePovChange(povVersion, povTimeframe, povSource, e.target.value)}
            >
              {availableYears.map((ym) => (
                <option key={ym} value={ym}>
                  {formatMonthYearLabel(ym)}
                </option>
              ))}
              <option value="ALL">All Months</option>
            </select>
          </div>
          <button
            id="lookbase-pov-run-btn"
            className="lookbase-btn primary"
            disabled={isBusy}
            onClick={() => {
              setIsTimeframeDropdownOpen(false);
              loadStandaloneOutline(
                povVersion,
                povTimeframe,
                povSource,
                povYear,
                savedExpandedMemberIds,
                activeHierarchyId,
              );
            }}
            title="Run / Refresh live BigQuery cube query for the selected POV slice"
          >
            {isBusy ? "Running..." : "↻ Run"}
          </button>
        </div>
      </div>

      {/* Configurable & Individually Dismissible Quick-Start Guide Strip */}
      {showQuickStartBar && (
        <div className="lookbase-quickstart-bar">
          <div className="lookbase-quickstart-steps">
            <strong style={{ color: "#1e3a8a" }}>Quick-Start Actions:</strong>
            {visibleQuickStartActions.map((action) => (
              <span key={action.id} className="lookbase-step-pill-wrap">
                <button
                  className="lookbase-step-pill"
                  onClick={() => applyUrlState(action.params)}
                  title={`Apply preset: ?${serializeLookBaseUrlState(action.params)}`}
                >
                  {action.label}
                </button>
                <button
                  className="lookbase-step-pill-dismiss"
                  onClick={() => handleDismissQuickStartPill(action.id)}
                  title="Dismiss this Quick-Start pill"
                >
                  ×
                </button>
              </span>
            ))}

            {isAddingCustomQuickStart ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <input
                  style={{
                    height: 20,
                    fontSize: 11,
                    padding: "0 6px",
                    border: "1px solid #2563eb",
                    borderRadius: 3,
                  }}
                  value={newQuickStartLabel}
                  onChange={(e) => setNewQuickStartLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveCustomQuickStart();
                    else if (e.key === "Escape") setIsAddingCustomQuickStart(false);
                  }}
                  placeholder="Label for current view..."
                  autoFocus
                />
                <button className="lookbase-btn primary" onClick={handleSaveCustomQuickStart}>
                  Save
                </button>
                <button
                  className="lookbase-btn"
                  onClick={() => setIsAddingCustomQuickStart(false)}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                className="lookbase-btn"
                onClick={() => setIsAddingCustomQuickStart(true)}
                title="Save current POV, expanded hierarchy branches, and left-hand metrics as a personal Quick-Start pill"
              >
                + Save Current View
              </button>
            )}

            {dismissedQuickStartIds.length > 0 && (
              <button
                className="lookbase-btn"
                onClick={() => applyUrlState({ quickstart: "reset" }, false)}
                title="Restore individually dismissed default Quick-Start pills"
              >
                Restore Pills ({dismissedQuickStartIds.length})
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              className="lookbase-btn tour-btn"
              onClick={() => {
                setShowLeftMetricsPane(true);
                startLookBaseTour({
                  core40SDK,
                  namespace: artifactNamespace,
                });
              }}
            >
              Launch Step-by-Step Tour
            </button>
            <button
              className="lookbase-btn"
              onClick={() => {
                setShowQuickStartBar(false);
                saveUserPrefsArtifact(
                  core40SDK,
                  { quickStartDismissed: true },
                  artifactNamespace,
                );
              }}
              title="Hide Quick-Start bar (re-open anytime with ?quickstart=1)"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Formula Bar */}
      <div id="lookbase-tour-formula-bar" className="lookbase-formula-bar">
        <div className="lookbase-cell-coord">{activeCellCoord}</div>
        <div className="lookbase-fx-badge">fx</div>
        <input
          className="lookbase-formula-input"
          value={formulaText}
          onChange={(e) => setFormulaText(e.target.value)}
          readOnly={false}
        />
      </div>
    </>
  );
};
