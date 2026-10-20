# LookBase Tour & User Preferences Artifact Reset Script (lkr-dev-cli code-mode sandbox)
# Usage:
#   Current user (delete full artifact):
#     uv run --env-file=.env --with "lkr-dev-cli[code-mode]" lkr-dev-cli code-mode sandbox \
#       --file=.agents/skills/lookbase-reset-tour/scripts/reset_tour_artifact.py
#   Specific user_id:
#     uv run --env-file=.env --with "lkr-dev-cli[code-mode]" lkr-dev-cli code-mode sandbox \
#       --file=.agents/skills/lookbase-reset-tour/scripts/reset_tour_artifact.py --var user_id=123
#   Specific guide UUID only (removes just that UUID from dismissedGuideIds):
#     uv run --env-file=.env --with "lkr-dev-cli[code-mode]" lkr-dev-cli code-mode sandbox \
#       --file=.agents/skills/lookbase-reset-tour/scripts/reset_tour_artifact.py --var guide_id=6f8a1c30-4e2b-4d9a-9c11-100000000001

import json

target_uid = ""
target_guide_id = ""
user_email = None

try:
    if user_id is not None and str(user_id).strip() != "":
        target_uid = str(user_id).strip()
except NameError:
    target_uid = ""

try:
    if guide_id is not None and str(guide_id).strip() != "":
        target_guide_id = str(guide_id).strip()
except NameError:
    target_guide_id = ""

if not target_uid:
    current_user = me()
    if not current_user or not current_user.get("id"):
        return {"error": "Unable to resolve current Looker user via me()."}
    target_uid = str(current_user["id"])
    user_email = current_user.get("email")
else:
    try:
        u = user(target_uid)
        if u:
            user_email = u.get("email")
    except Exception:
        user_email = None

key = f"user_{target_uid}_lookbase_prefs"
namespaces = ["lookbase::lookbase", "lookbase"]
deleted_from = []
updated_in = []
not_found_in = []
errors = []

for ns in namespaces:
    try:
        existing = artifact(namespace=ns, key=key)
    except Exception:
        existing = []

    if existing:
        try:
            if target_guide_id:
                rec = existing[0]
                raw_val = rec.get("value", "{}")
                prefs = json.loads(raw_val) if isinstance(raw_val, str) else (raw_val or {})
                dismissed = [g for g in prefs.get("dismissedGuideIds", []) if g != target_guide_id]
                prefs["dismissedGuideIds"] = dismissed
                prefs["tourDismissed"] = False
                update_artifacts(
                    namespace=ns,
                    body=[
                        {
                            "key": key,
                            "value": json.dumps(prefs),
                            "content_type": "application/json",
                            "version": rec.get("version"),
                        }
                    ],
                )
                updated_in.append(ns)
            else:
                delete_artifact(namespace=ns, key=key)
                deleted_from.append(ns)
        except Exception as exc:
            errors.append({"namespace": ns, "error": str(exc)})
    else:
        not_found_in.append(ns)

return {
    "target_user_id": target_uid,
    "user_email": user_email,
    "artifact_key": key,
    "guide_id_removed": target_guide_id or "ALL",
    "deleted_from_namespaces": deleted_from,
    "updated_in_namespaces": updated_in,
    "not_found_in_namespaces": not_found_in,
    "errors": errors,
}
