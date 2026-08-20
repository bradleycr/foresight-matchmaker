#!/usr/bin/env bash
# One-off: create a production listing for an email via Resend → claim → POST /profiles.
set -euo pipefail

BASE="${BASE:-https://foresightmatchmaker.app}"
EMAIL="${1:?usage: setup-prod-listing.sh <email>}"

if [[ -z "${RESEND_API_KEY:-}" ]]; then
  echo "RESEND_API_KEY required" >&2
  exit 1
fi

echo "→ request-link for $EMAIL"
curl -sf -X POST "$BASE/api/v1/auth/request-link" \
  -H "content-type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"next\":\"/register\"}" >/dev/null

sleep 6

EMAIL_ID=$(curl -sf -G "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  --data-urlencode "limit=10" \
  | python3 -c "
import json, sys
target = sys.argv[1]
for e in json.load(sys.stdin).get('data', []):
    if target in str(e.get('to', [])):
        print(e['id'])
        break
else:
    raise SystemExit('email not found in Resend')
" "$EMAIL")

echo "→ Resend message $EMAIL_ID"
curl -sf "https://api.resend.com/emails/$EMAIL_ID" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  > /tmp/rmm-setup-email.json

TOKEN=$(python3 - "$EMAIL" <<'PY'
import re, sys
from urllib.parse import urlparse, unquote
blob = open("/tmp/rmm-setup-email.json").read()
m = re.search(r"https://foresightmatchmaker\.app/claim/[^\"'\s<>]+", blob)
if not m:
    raise SystemExit("claim URL not found in email")
print(unquote(urlparse(m.group(0)).path.split("/claim/", 1)[1]))
PY
)

JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT

echo "→ claim"
curl -sf -c "$JAR" -X POST "$BASE/api/v1/auth/claim" \
  -H "content-type: application/json" \
  -d "$(python3 -c "import json,sys; print(json.dumps({'token': sys.stdin.read()}))" <<<"$TOKEN")" | python3 -m json.tool

echo "→ create listing"
CREATE=$(curl -sf -c "$JAR" -b "$JAR" -X POST "$BASE/api/v1/profiles" \
  -H "content-type: application/json" \
  -d @- <<'JSON'
{
  "kind": "individual",
  "org_name": "Foresight Institute",
  "org_type": "other",
  "org_type_other": "Research institute",
  "country": "DE",
  "one_liner": "Operator listing for live production testing.",
  "summary": "Bradley Royes — Foresight Institute. Test account for sign-in, directory, and matchmaking on foresightmatchmaker.app.",
  "languages": ["en", "de"],
  "looking_for": ["dataset_access", "ai_partner"],
  "application_status": "intend_to_apply",
  "parallel_public_funding": "no",
  "attending": ["event_sept_1"],
  "open_to_intros": true,
  "visibility": "authenticated_only",
  "contact_name": "Bradley Royes",
  "contact_email": "ignored@foresight.org",
  "contact_role": "Programme lead",
  "methods": ["computer_vision"],
  "application_target": ["diagnostics"],
  "domain_expertise": ["oncology"],
  "clinical_partner": "have",
  "regulatory_experience": ["gdpr_dpia"],
  "compute": "cloud_budget",
  "privacy_capability": ["can_work_in_tre"],
  "team_size": "2_5",
  "track_record": [],
  "affiliation": "Foresight Institute, Berlin",
  "data_needs": {
    "modality": ["imaging_mri"],
    "disease_area": ["oncology"],
    "min_n_subjects": "1k_10k",
    "linkage_required": ["outcomes"],
    "standards_preferred": ["dicom"]
  }
}
JSON
)

echo "$CREATE" | python3 -c "
import json, sys
d = json.load(sys.stdin)
p = d['profile']
print('OK — listing created')
print('  org:', p['org_name'])
print('  slug:', p['slug'])
print('  visibility:', p['visibility'])
"

curl -sf "$BASE/api/v1/stats" | python3 -m json.tool
echo "→ Sign in at $BASE/signin with $EMAIL (check inbox for link)"
