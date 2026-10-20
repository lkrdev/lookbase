---
name: lookbase-reset-tour
description: >
  Remove the LookBase onboarding tour and user preferences artifact (`user_<id>_lookbase_prefs`)
  for the current authenticated Looker user or an optional `user_id` using `lkr-dev-cli` and `code-mode`.
  Use when asked to reset the LookBase tour, clear a user's saved LookBase preferences artifact,
  or re-enable the guided tour for yourself or another user.
---

# Skill: Reset LookBase Tour & User Preferences Artifact (`lookbase-reset-tour`)

LookBase persists each user's dismissed guide UUIDs (`dismissedGuideIds: string[]`, `lastDismissedGuideId: string`, `tourDismissed: boolean`, `quickStartDismissed: boolean`), saved outline expansions (`savedExpandedMemberIds`, `savedExpandedPaths`), left-hand metrics (`leftHandMetricIds`), and POV selections in the **Looker Artifacts API**:

- **Artifact Key:** `user_<user_id>_lookbase_prefs`
- **Artifact Namespaces:** `"lookbase::lookbase"` (mounted Looker extension ID) and `"lookbase"` (standalone fallback)
- **Built-in Guide UUIDs:**
  - `6f8a1c30-4e2b-4d9a-9c11-100000000001` — *Guide 1: LookBase Core & Outline Hierarchy*
  - `6f8a1c30-4e2b-4d9a-9c11-100000000002` — *Guide 2: Left-Hand Metrics, Formula Bar & Sandboxes*

Removing this artifact (or removing a specific `guide_id` UUID from `dismissedGuideIds`) causes the unseen guide to launch again on the user's next visit (at most 1 unseen guide per refresh).

---

## Step 1: Check for `.env` File (or OAuth Fallback)

Always check whether a `.env` file exists in the repository root first:

```bash
ls -la .env
```

- **If `.env` exists** (containing `LOOKERSDK_BASE_URL`, `LOOKERSDK_CLIENT_ID`, `LOOKERSDK_CLIENT_SECRET`), run `lkr-dev-cli` with `uv run --env-file=.env --with "lkr-dev-cli[code-mode]" lkr-dev-cli code-mode sandbox ...` (or `uvx --env-file=.env --from "lkr-dev-cli[codemode]" lkr-dev-cli code-mode sandbox ...`).
- **If `.env` does not exist**, list configured OAuth accounts (`uv run --with "lkr-dev-cli[code-mode]" lkr-dev-cli auth list`) and pass `--oauth-account=<account>`.

---

## Step 2: Remove the Tour Artifact (Bundled Script)

Use the bundled Monty sandbox script [scripts/reset_tour_artifact.py](./scripts/reset_tour_artifact.py), which automatically:
1. Uses `--var user_id=<id>` if provided, or calls `me()["id"]` to look up the current authenticated user's ID.
2. Checks both `"lookbase::lookbase"` and `"lookbase"` namespaces for `user_<id>_lookbase_prefs`.
3. Deletes the entire artifact (or, if `--var guide_id=<uuid>` is passed, removes only that UUID from `dismissedGuideIds` while preserving saved metrics/POV) and returns a structured JSON summary.

### A. Reset Current User's Tour Artifact (Looks up `me()["id"]`)

```bash
# Using .env file:
uv run --env-file=.env --with "lkr-dev-cli[code-mode]" lkr-dev-cli code-mode sandbox \
  --file=.agents/skills/lookbase-reset-tour/scripts/reset_tour_artifact.py

# Or reset only a single Guide UUID from dismissedGuideIds:
uv run --env-file=.env --with "lkr-dev-cli[code-mode]" lkr-dev-cli code-mode sandbox \
  --file=.agents/skills/lookbase-reset-tour/scripts/reset_tour_artifact.py \
  --var guide_id=6f8a1c30-4e2b-4d9a-9c11-100000000001
```

### B. Reset Another User's Tour Artifact (Optional `--var user_id=<id>`)

Pass `--var user_id=<id>` (or `-v user_id=<id>`) to remove a specific user's artifact instead of the current user's:

```bash
# Using .env file with optional user_id:
uv run --env-file=.env --with "lkr-dev-cli[code-mode]" lkr-dev-cli code-mode sandbox \
  --file=.agents/skills/lookbase-reset-tour/scripts/reset_tour_artifact.py \
  --var user_id=123
```

---

## Step 3: Inline `--code` One-Liner (Alternative)

If you prefer running inline code without a script file:

```bash
# Current user (via me()["id"]):
uv run --env-file=.env --with "lkr-dev-cli[code-mode]" lkr-dev-cli code-mode sandbox \
  --code='
uid = str(me()["id"])
key = f"user_{uid}_lookbase_prefs"
deleted = []
for ns in ["lookbase::lookbase", "lookbase"]:
    if artifact(namespace=ns, key=key):
        delete_artifact(namespace=ns, key=key)
        deleted.append(ns)
return {"user_id": uid, "key": key, "deleted_from": deleted}
'

# Specific user (passing --var user_id=123):
uv run --env-file=.env --with "lkr-dev-cli[code-mode]" lkr-dev-cli code-mode sandbox \
  --var user_id=123 \
  --code='
try:
    uid = str(user_id).strip()
except NameError:
    uid = ""
if not uid:
    uid = str(me()["id"])
key = f"user_{uid}_lookbase_prefs"
deleted = []
for ns in ["lookbase::lookbase", "lookbase"]:
    if artifact(namespace=ns, key=key):
        delete_artifact(namespace=ns, key=key)
        deleted.append(ns)
return {"user_id": uid, "key": key, "deleted_from": deleted}
'
```

---

## Optional: Inspect Existing LookBase Artifacts Before Deleting

To list all stored user preference artifacts in the `"lookbase::lookbase"` namespace (for example, to find which `user_id`s currently have a dismissed tour artifact):

```bash
uv run --env-file=.env --with "lkr-dev-cli[code-mode]" lkr-dev-cli code-mode sandbox \
  --code='return search_artifacts(namespace="lookbase::lookbase", key="user_%_lookbase_prefs")'
```
