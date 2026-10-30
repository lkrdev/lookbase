import React from "react";
import {
  BIEngineCandidateTable,
  buildAlterBiCapacitySql,
  LookBaseCurrentUser,
  LookBaseSettingsConfig,
} from "./essbaseEngine";

export interface LookBaseSettingsModalProps {
  isOpen: boolean;
  canUpdateSettings: boolean;
  onClose: () => void;
  currentUser: LookBaseCurrentUser | null;
  isCurrentUserAdmin: boolean;
  settingsDraft: Required<LookBaseSettingsConfig>;
  setSettingsDraft: React.Dispatch<React.SetStateAction<Required<LookBaseSettingsConfig>>>;
  settingsGroupIdsInput: string;
  setSettingsGroupIdsInput: React.Dispatch<React.SetStateAction<string>>;
  settingsUserIdsInput: string;
  setSettingsUserIdsInput: React.Dispatch<React.SetStateAction<string>>;
  rebuildCubeGroupIdsInput: string;
  setRebuildCubeGroupIdsInput: React.Dispatch<React.SetStateAction<string>>;
  rebuildCubeUserIdsInput: string;
  setRebuildCubeUserIdsInput: React.Dispatch<React.SetStateAction<string>>;
  isDiscoveringBiTables: boolean;
  refreshBiEngineTables: () => void;
  biEngineTables: BIEngineCandidateTable[];
  biEngineProjectId: string;
  canRebuildCube: boolean;
  isBusy: boolean;
  handleRebuildCube: (viewToRebuild?: string) => void;
  settingsFormError: string;
  isSavingSettings: boolean;
  handleSaveSettings: () => void;
}

export const LookBaseSettingsModal: React.FC<LookBaseSettingsModalProps> = ({
  isOpen,
  canUpdateSettings,
  onClose,
  currentUser,
  isCurrentUserAdmin,
  settingsDraft,
  setSettingsDraft,
  settingsGroupIdsInput,
  setSettingsGroupIdsInput,
  settingsUserIdsInput,
  setSettingsUserIdsInput,
  rebuildCubeGroupIdsInput,
  setRebuildCubeGroupIdsInput,
  rebuildCubeUserIdsInput,
  setRebuildCubeUserIdsInput,
  isDiscoveringBiTables,
  refreshBiEngineTables,
  biEngineTables,
  biEngineProjectId,
  canRebuildCube,
  isBusy,
  handleRebuildCube,
  settingsFormError,
  isSavingSettings,
  handleSaveSettings,
}) => {
  if (!isOpen || !canUpdateSettings) return null;

  const renderIdListInputs = (
    groupLabel: string,
    groupValue: string,
    onGroupChange: (v: string) => void,
    userLabel: string,
    userValue: string,
    onUserChange: (v: string) => void,
    userPlaceholder: string,
  ) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
      {[
        { label: groupLabel, value: groupValue, onChange: onGroupChange, placeholder: "e.g., 1, 2, 3" },
        { label: userLabel, value: userValue, onChange: onUserChange, placeholder: userPlaceholder },
      ].map((f) => (
        <div key={f.label}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 3,
            }}
          >
            {f.label}
          </label>
          <input
            className="lookbase-autocomplete-input"
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            placeholder={f.placeholder}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="lookbase-modal-backdrop" onClick={onClose}>
      <div
        className="lookbase-modal"
        style={{ maxWidth: 620 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lookbase-modal-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
              Configuration Settings
            </div>
            <div style={{ fontSize: 11, color: "#475569" }}>
              Manage who can edit LookBase Configuration Settings and who can trigger Rebuild Cube.
            </div>
          </div>
          <button className="lookbase-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="lookbase-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Current User Identity & Group Membership Helper Banner */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              padding: "8px 10px",
              fontSize: 11,
              color: "#334155",
            }}
          >
            <div>
              <strong>Current User:</strong>{" "}
              {currentUser?.display_name || currentUser?.email || "Authenticated User"}{" "}
              (ID: <code>{currentUser?.id != null ? String(currentUser.id) : "N/A"}</code>
              {currentUser?.email ? `, Email: ${currentUser.email}` : ""})
            </div>
            <div style={{ marginTop: 3 }}>
              <strong>Role:</strong>{" "}
              <span
                style={{
                  fontWeight: 600,
                  color: isCurrentUserAdmin ? "#15803d" : "#475569",
                }}
              >
                {isCurrentUserAdmin ? "Looker Admin (Role ID 2)" : "Standard User"}
              </span>{" "}
              · <strong>Your Group IDs:</strong>{" "}
              <code>
                {currentUser?.group_ids?.length
                  ? currentUser.group_ids.join(", ")
                  : "None"}
              </code>
            </div>
          </div>

          {/* Section 1: Who Can Edit Settings */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              padding: 12,
              background: "#ffffff",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a", marginBottom: 6 }}>
              1. Settings Access Control (Who Can Edit Settings)
            </div>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#1e293b",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={settingsDraft.restrict_settings}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    restrict_settings: e.target.checked,
                  }))
                }
              />
              <span>Restrict Settings Access</span>
            </label>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              When enabled, only Looker Admins (Role ID 2), users in the specified Group IDs, or
              specified User IDs / Emails can access and save Configuration Settings.
            </div>

            {settingsDraft.restrict_settings &&
              renderIdListInputs(
                "Allowed Group IDs (comma-separated)",
                settingsGroupIdsInput,
                setSettingsGroupIdsInput,
                "Allowed User IDs or Emails (comma-separated)",
                settingsUserIdsInput,
                setSettingsUserIdsInput,
                "e.g., 42, planner@company.com",
              )}
          </div>

          {/* Section 2: Who Can Rebuild Cube */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              padding: 12,
              background: "#ffffff",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a", marginBottom: 6 }}>
              2. Rebuild Cube Access Control (Who Can Rebuild Cube)
            </div>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#1e293b",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={settingsDraft.restrict_rebuild_cube}
                onChange={(e) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    restrict_rebuild_cube: e.target.checked,
                  }))
                }
              />
              <span>Restrict Rebuild Cube Access</span>
            </label>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              When enabled, only Looker Admins (Role ID 2), users in the specified Group IDs, or
              specified User IDs / Emails can see and trigger <strong>Calc All (Rebuild Cube)</strong>{" "}
              and <strong>Calc Sales PDT</strong>.
            </div>

            {settingsDraft.restrict_rebuild_cube &&
              renderIdListInputs(
                "Allowed Group IDs for Rebuild Cube (comma-separated)",
                rebuildCubeGroupIdsInput,
                setRebuildCubeGroupIdsInput,
                "Allowed User IDs or Emails for Rebuild Cube (comma-separated)",
                rebuildCubeUserIdsInput,
                setRebuildCubeUserIdsInput,
                "e.g., 42, fpa-lead@company.com",
              )}
          </div>

          {/* Section 3: BigQuery BI Engine Pinning — List All Candidate Shared Tables */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              padding: 12,
              background: "#ffffff",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>
                  3. BigQuery BI Engine Pinning (<code>ALTER BI_CAPACITY</code>)
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  All shared LookBase PDT tables listed below are pinned to BigQuery BI Engine
                  memory when the base cube is built or rebuilt.
                </div>
              </div>
              <button
                type="button"
                className="lookbase-btn"
                disabled={isDiscoveringBiTables}
                onClick={refreshBiEngineTables}
              >
                {isDiscoveringBiTables ? "Refreshing..." : "Refresh Table List"}
              </button>
            </div>

            <div
              style={{
                maxHeight: 150,
                overflowY: "auto",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                background: "#f8fafc",
                padding: 6,
                fontSize: 11,
              }}
            >
              {biEngineTables.map((tbl, idx) => (
                <div
                  key={tbl.viewName}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "3px 4px",
                    borderBottom:
                      idx < biEngineTables.length - 1 ? "1px solid #e2e8f0" : "none",
                  }}
                >
                  <span>
                    <strong>{tbl.viewName}</strong>{" "}
                    <span style={{ color: "#64748b" }}>({tbl.label})</span>
                  </span>
                  <code style={{ fontSize: 10, color: "#0f172a" }}>{tbl.datasetTable}</code>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: 3,
                }}
              >
                Generated BigQuery DDL (<code>preferred_tables</code>):
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: "6px 8px",
                  fontSize: 10,
                  background: "#0f172a",
                  color: "#f8fafc",
                  borderRadius: 4,
                  overflowX: "auto",
                  maxHeight: 110,
                }}
              >
                {buildAlterBiCapacitySql(biEngineProjectId, biEngineTables, "us")}
              </pre>
            </div>

            {canRebuildCube && (
              <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="lookbase-btn"
                  disabled={isBusy}
                  onClick={() => handleRebuildCube("long_metrics_base")}
                >
                  Rebuild Base Cube &amp; Pin All Listed Tables to BI Engine
                </button>
              </div>
            )}
          </div>

          {settingsFormError && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                borderRadius: 4,
                padding: "8px 10px",
                fontSize: 11,
              }}
            >
              {settingsFormError}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 4,
            }}
          >
            <button
              className="lookbase-btn"
              disabled={isSavingSettings}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="lookbase-btn primary"
              disabled={isSavingSettings}
              onClick={handleSaveSettings}
            >
              {isSavingSettings ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
