import React from "react";
import {
  CalculationsConfig,
  deriveExpandedPathsFromMemberIds,
  fetchHierarchyModalChildren,
  getHierarchyNodeTriState,
  getHierarchyRowStickyStyle,
  getOutlineIndentationPx,
  getVisibleHierarchyModalNodes,
  LookBaseHierarchyDef,
  OutlineNodeMeta,
  ParentChildHierarchyConfig,
  sortOutlineNodesTreeOrder,
  toggleHierarchyNodeTriState,
} from "./essbaseEngine";

export interface LookBaseHierarchyModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeHierarchyDef: LookBaseHierarchyDef;
  allHierarchyNodes: OutlineNodeMeta[];
  allHierarchyNodeMap: Record<string, OutlineNodeMeta>;
  effectiveAvailableHierarchies: LookBaseHierarchyDef[];
  effectiveEnabledHierarchyIds: string[];
  effectiveActiveHierarchyId: string;
  setEnabledHierarchyIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleSwitchHierarchy: (nextHierarchyId: string) => void;
  exploreHierarchyToAdd: string;
  setExploreHierarchyToAdd: React.Dispatch<React.SetStateAction<string>>;
  persistSavedExpansion: (memberIds: string[], paths: string[]) => void;
  setExpandedPaths: React.Dispatch<React.SetStateAction<string[]>>;
  modalUnfoldedIds: string[];
  setModalUnfoldedIds: React.Dispatch<React.SetStateAction<string[]>>;
  modalLoadingParentIds: string[];
  handleToggleModalUnfold: (node: OutlineNodeMeta) => void;
  core40SDK: any;
  effectiveModelRef: React.MutableRefObject<string>;
  pcConfig: ParentChildHierarchyConfig;
  activeHierarchyId: string;
  calcConfigRef: React.MutableRefObject<CalculationsConfig>;
  setHierarchyCatalogNodes: React.Dispatch<React.SetStateAction<OutlineNodeMeta[]>>;
  loadStandaloneOutline: (
    versionOverride?: string,
    timeframeOverride?: string,
    sourceOverride?: string,
    yearOverride?: string,
    expandedMemberIdsOverride?: string[],
    hierarchyOverride?: string,
  ) => Promise<void>;
  povVersion: string;
  povTimeframe: string;
  povSource: string;
  povYear: string;
  hierarchyFilterSearch: string;
  setHierarchyFilterSearch: React.Dispatch<React.SetStateAction<string>>;
  savedExpandedMemberIds: string[];
}

export const LookBaseHierarchyModal: React.FC<LookBaseHierarchyModalProps> = ({
  isOpen,
  onClose,
  activeHierarchyDef,
  allHierarchyNodes,
  allHierarchyNodeMap,
  effectiveAvailableHierarchies,
  effectiveEnabledHierarchyIds,
  effectiveActiveHierarchyId,
  setEnabledHierarchyIds,
  handleSwitchHierarchy,
  exploreHierarchyToAdd,
  setExploreHierarchyToAdd,
  persistSavedExpansion,
  setExpandedPaths,
  modalUnfoldedIds,
  setModalUnfoldedIds,
  modalLoadingParentIds,
  handleToggleModalUnfold,
  core40SDK,
  effectiveModelRef,
  pcConfig,
  activeHierarchyId,
  calcConfigRef,
  setHierarchyCatalogNodes,
  loadStandaloneOutline,
  povVersion,
  povTimeframe,
  povSource,
  povYear,
  hierarchyFilterSearch,
  setHierarchyFilterSearch,
  savedExpandedMemberIds,
}) => {
  if (!isOpen) return null;

  const unenabledHierarchies = effectiveAvailableHierarchies.filter(
    (h) => !effectiveEnabledHierarchyIds.includes(h.id),
  );
  const targetToAdd =
    (unenabledHierarchies.find((h) => h.id === exploreHierarchyToAdd) || unenabledHierarchies[0])
      ?.id || "";

  return (
    <div className="lookbase-modal-backdrop" onClick={onClose}>
      <div
        className="lookbase-modal"
        style={{ maxWidth: 680 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lookbase-modal-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
              Hierarchy Selector — {activeHierarchyDef.label}
            </div>
            <div style={{ fontSize: 11, color: "#475569" }}>
              Active Hierarchy: <strong>{activeHierarchyDef.shortLabel}</strong> · Levels:{" "}
              <code>{activeHierarchyDef.levelLabels.join(" → ")}</code> (
              {allHierarchyNodes.length} total nodes)
            </div>
          </div>
          <button className="lookbase-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="lookbase-modal-body">
          {/* Section A: Active Hierarchy Tabs + Add/Remove Explore Hierarchies */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "6px 8px",
              marginBottom: 8,
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1e3a8a" }}>
                Hierarchies:
              </span>
              {effectiveAvailableHierarchies
                .filter((h) => effectiveEnabledHierarchyIds.includes(h.id))
                .map((h) => {
                  const isActive = h.id === effectiveActiveHierarchyId;
                  return (
                    <span
                      key={`tab-${h.id}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 4,
                        border: isActive ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
                        background: isActive ? "#1d4ed8" : "#ffffff",
                        color: isActive ? "#ffffff" : "#1e293b",
                        overflow: "hidden",
                      }}
                    >
                      <button
                        type="button"
                        data-testid={`hierarchy-tab-${h.id}`}
                        onClick={() => handleSwitchHierarchy(h.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          fontSize: 11,
                          fontWeight: isActive ? 700 : 600,
                          padding: "3px 8px",
                          cursor: "pointer",
                        }}
                      >
                        {h.shortLabel}
                      </button>
                      {effectiveEnabledHierarchyIds.length > 1 && (
                        <button
                          type="button"
                          title={`Remove ${h.shortLabel} from active selector`}
                          onClick={() => {
                            const remaining = effectiveEnabledHierarchyIds.filter(
                              (id) => id !== h.id,
                            );
                            setEnabledHierarchyIds(remaining);
                            if (effectiveActiveHierarchyId === h.id && remaining.length > 0) {
                              handleSwitchHierarchy(remaining[0]);
                            }
                          }}
                          style={{
                            border: "none",
                            borderLeft: isActive
                              ? "1px solid rgba(255,255,255,0.3)"
                              : "1px solid #e2e8f0",
                            background: "transparent",
                            color: "inherit",
                            fontSize: 10,
                            padding: "3px 5px",
                            cursor: "pointer",
                          }}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
            </div>

            {/* Add Hierarchy from Looker Explore */}
            {unenabledHierarchies.length > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <select
                  aria-label="Add Hierarchy from Looker Explore"
                  style={{
                    height: 22,
                    fontSize: 11,
                    border: "1px solid #cbd5e1",
                    borderRadius: 3,
                    padding: "0 4px",
                  }}
                  value={targetToAdd}
                  onChange={(e) => setExploreHierarchyToAdd(e.target.value)}
                >
                  {unenabledHierarchies.map((h) => (
                    <option key={`add-opt-${h.id}`} value={h.id}>
                      + {h.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="lookbase-btn primary"
                  onClick={() => targetToAdd && handleSwitchHierarchy(targetToAdd)}
                >
                  + Add &amp; Switch
                </button>
              </div>
            )}
          </div>

          {/* Section B: Level Filter Quick-Pills (Expand / Filter by Hierarchy Level) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
              marginBottom: 8,
              fontSize: 11,
            }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, color: "#334155" }}>Filter / Expand Level:</span>
              {activeHierarchyDef.levelLabels.map((lvlLabel, lvlIdx) => (
                <button
                  key={`lvl-pill-${lvlIdx}`}
                  type="button"
                  className="lookbase-btn"
                  onClick={async () => {
                    const parentIdsUpToLevel = allHierarchyNodes
                      .filter((n) => !n.isLeaf && n.level < lvlIdx)
                      .map((n) => n.memberId);
                    const nextIds = Array.from(new Set(["ROOT", "ALL", ...parentIdsUpToLevel]));
                    const nextPaths = deriveExpandedPathsFromMemberIds(
                      nextIds,
                      allHierarchyNodeMap,
                    );
                    persistSavedExpansion(nextIds, nextPaths);
                    setExpandedPaths(nextPaths);
                    setModalUnfoldedIds(nextIds);
                    if (core40SDK && lvlIdx >= 5) {
                      const l5Parents = allHierarchyNodes
                        .filter((n) => !n.isLeaf && n.level === 5)
                        .slice(0, 40)
                        .map((n) => n.memberId);
                      if (l5Parents.length > 0) {
                        const children = await fetchHierarchyModalChildren(
                          core40SDK,
                          effectiveModelRef.current,
                          l5Parents,
                          pcConfig,
                          5000,
                          activeHierarchyId,
                          calcConfigRef.current,
                        );
                        if (children.length > 0) {
                          setHierarchyCatalogNodes((prev) => {
                            const byId = new Map<string, OutlineNodeMeta>();
                            for (const existing of prev) byId.set(existing.memberId, existing);
                            for (const child of children) byId.set(child.memberId, child);
                            return sortOutlineNodesTreeOrder(Array.from(byId.values()));
                          });
                        }
                      }
                    }
                    loadStandaloneOutline(
                      povVersion,
                      povTimeframe,
                      povSource,
                      povYear,
                      nextIds.slice(0, 60),
                      activeHierarchyId,
                    );
                  }}
                  title={`Expand hierarchy down to L${lvlIdx}: ${lvlLabel}`}
                >
                  L{lvlIdx}: {lvlLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Section C: Search & Bulk Branch Selection */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
            <input
              className="lookbase-autocomplete-input"
              value={hierarchyFilterSearch}
              onChange={(e) => setHierarchyFilterSearch(e.target.value)}
              placeholder={`Search ${activeHierarchyDef.shortLabel} levels & members...`}
            />
            <button
              className="lookbase-btn"
              title="Select all branches across the entire hierarchy"
              onClick={() => {
                const allNonLeafIds = allHierarchyNodes
                  .filter((n) => !n.isLeaf)
                  .map((n) => n.memberId);
                const nextIds = Array.from(new Set(["ROOT", "ALL", ...allNonLeafIds]));
                const nextPaths = deriveExpandedPathsFromMemberIds(nextIds, allHierarchyNodeMap);
                persistSavedExpansion(nextIds, nextPaths);
                setExpandedPaths(nextPaths);
              }}
            >
              Select All
            </button>
            <button
              className="lookbase-btn"
              title="Select default L0-L1 branches (Some)"
              onClick={() => {
                const initIds = activeHierarchyDef.defaultExpandedIds || ["ROOT", "ALL"];
                const initPaths = deriveExpandedPathsFromMemberIds(
                  initIds,
                  allHierarchyNodeMap,
                  activeHierarchyDef.defaultExpandedPaths || [activeHierarchyDef.rootLabel],
                );
                persistSavedExpansion(initIds, initPaths);
                setExpandedPaths(initPaths);
              }}
            >
              Select Default
            </button>
            <button
              className="lookbase-btn"
              title="Collapse all branches (Select None)"
              onClick={() => {
                const nextIds = ["ROOT"];
                const nextPaths: string[] = [];
                persistSavedExpansion(nextIds, nextPaths);
                setExpandedPaths(nextPaths);
              }}
            >
              Select None
            </button>
          </div>
          <div
            data-testid="hierarchy-modal-scroll"
            style={{
              maxHeight: 340,
              overflowY: "auto",
              border: "1px solid #cbd5e1",
              position: "relative",
            }}
          >
            {(() => {
              const visibleNodes = getVisibleHierarchyModalNodes(
                allHierarchyNodes,
                modalUnfoldedIds,
                hierarchyFilterSearch,
              );
              const childrenByParent: Record<string, OutlineNodeMeta[]> = {};
              const roots: OutlineNodeMeta[] = [];

              for (const n of visibleNodes) {
                if (n.level === 0 || n.parentId === "ROOT") {
                  roots.push(n);
                } else {
                  if (!childrenByParent[n.parentId]) {
                    childrenByParent[n.parentId] = [];
                  }
                  childrenByParent[n.parentId].push(n);
                }
              }

              const renderRow = (node: OutlineNodeMeta) => {
                const triState = getHierarchyNodeTriState(
                  node,
                  allHierarchyNodes,
                  savedExpandedMemberIds,
                );
                const stickyStyle = getHierarchyRowStickyStyle(node.level, 30);
                const isUnfolded =
                  Boolean(hierarchyFilterSearch.trim()) ||
                  modalUnfoldedIds.includes(node.memberId);
                const isLoadingChildren = modalLoadingParentIds.includes(node.memberId);

                return (
                  <div
                    key={`row:${node.memberId}`}
                    data-tree-row={node.memberId}
                    data-level={node.level}
                    style={{
                      ...stickyStyle,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 8px",
                      paddingLeft: 8 + getOutlineIndentationPx(node.level, 16),
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {!node.isLeaf ? (
                        <button
                          type="button"
                          data-tree-chevron={node.memberId}
                          onClick={() => handleToggleModalUnfold(node)}
                          style={{
                            width: 18,
                            height: 18,
                            padding: 0,
                            border: "1px solid #cbd5e1",
                            borderRadius: 3,
                            background: isUnfolded ? "#eff6ff" : "#ffffff",
                            color: "#334155",
                            fontSize: 10,
                            lineHeight: "16px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          title={isUnfolded ? `Collapse ${node.label}` : `Expand ${node.label}`}
                        >
                          {isLoadingChildren ? "…" : isUnfolded ? "▾" : "▸"}
                        </button>
                      ) : (
                        <span style={{ width: 18, display: "inline-block" }} />
                      )}
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                        }}
                        title={
                          node.isLeaf
                            ? `Toggle ${node.label}`
                            : `Click to cycle selection for ${node.label}`
                        }
                      >
                        <input
                          type="checkbox"
                          data-tree-checkbox={node.memberId}
                          checked={triState === "all"}
                          ref={(el) => {
                            if (el) {
                              el.indeterminate = triState === "some";
                            }
                          }}
                          onChange={() => {
                            const nextIds = toggleHierarchyNodeTriState(
                              node,
                              allHierarchyNodes,
                              savedExpandedMemberIds,
                            );
                            const nextPaths = deriveExpandedPathsFromMemberIds(
                              nextIds,
                              allHierarchyNodeMap,
                            );
                            persistSavedExpansion(nextIds, nextPaths);
                            setExpandedPaths(nextPaths);
                          }}
                        />
                        <span style={{ fontWeight: node.isLeaf ? 400 : 600 }}>
                          {node.label}
                        </span>
                      </label>
                    </div>
                    <span style={{ fontSize: 10, color: "#64748b" }}>{node.memberId}</span>
                  </div>
                );
              };

              const renderBranch = (node: OutlineNodeMeta): React.ReactNode => {
                const visibleChildren = childrenByParent[node.memberId] || [];
                if (node.isLeaf || visibleChildren.length === 0) {
                  return renderRow(node);
                }
                return (
                  <div
                    key={`branch:${node.memberId}`}
                    data-tree-branch={node.memberId}
                    data-level={node.level}
                  >
                    {renderRow(node)}
                    <div data-tree-children={node.memberId}>
                      {visibleChildren.map((child) => renderBranch(child))}
                    </div>
                  </div>
                );
              };

              return roots.length > 0
                ? roots.map((r) => renderBranch(r))
                : visibleNodes.map((n) => renderRow(n));
            })()}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 10,
            }}
          >
            <span style={{ fontSize: 11, color: "#475569" }}>
              Saved expanded parent IDs: <strong>{savedExpandedMemberIds.join(", ")}</strong>
            </span>
            <button
              className="lookbase-btn primary"
              onClick={() => {
                onClose();
                loadStandaloneOutline(
                  povVersion,
                  povTimeframe,
                  povSource,
                  povYear,
                  savedExpandedMemberIds,
                  activeHierarchyId,
                );
              }}
            >
              Run Consolidated Batch Query Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
