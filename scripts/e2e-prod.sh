#!/usr/bin/env bash
# Production smoke: Resend email → claim → create listing → delete → recreate.
# Requires RESEND_API_KEY in the environment. Uses @foresight.org only.
set -euo pipefail

BASE="${BASE:-https://foresightmatchmaker.app}"
EMAIL="${EMAIL:-e2e-$(date +%s)@foresight.org}"

if [[ -z "${RESEND_API_KEY:-}" ]]; then
  echo "RESEND_API_KEY required" >&2
  exit 1
fi

echo "→ request-link for $EMAIL"
curl -sf -X POST "$BASE/api/v1/auth/request-link" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"next\":\"/register\"}" >/dev/null

sleep 5

EMAIL_ID=$(curl -sf -G "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  --data-urlencode "limit=20" \
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
  > /tmp/rmm-e2e-email.json

TOKEN=$(python3 <<'PY'
import re
from urllib.parse import urlparse, unquote
blob = open("/tmp/rmm-e2e-email.json").read()
m = re.search(r"https://foresightmatchmaker\.app/claim/[^\"'\s<>]+", blob)
if not m:
    raise SystemExit("claim URL not found in email")
print(unquote(urlparse(m.group(0)).path.split("/claim/", 1)[1]))
PY
)

JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT

echo "→ claim token"
CLAIM=$(curl -sf -c "$JAR" -X POST "$BASE/api/v1/auth/claim" \
  -H 'content-type: application/json' \
  -d "$(python3 -c "import json; print(json.dumps({'token': open('/dev/stdin').read()}))" <<<"$TOKEN")")
echo "$CLAIM" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('signed_in') and d.get('profile_id') is None"

PROFILE='{
  "kind":"individual",
  "org_name":"E2E Smoke Lab",
  "org_type":"startup",
  "country":"DE",
  "one_liner":"Automated production smoke test.",
  "summary":"Synthetic individual listing for e2e verification.",
  "languages":["en"],
  "looking_for":["dataset_access"],
  "application_status":"intend_to_apply",
  "parallel_public_funding":"no",
  "attending":["webinar_2026_08_20"],
  "open_to_intros":true,
  "visibility":"authenticated_only",
  "contact_name":"E2E Bot",
  "contact_email":"ignored@foresight.org",
  "contact_role":"Tester",
  "methods":["computer_vision"],
  "application_target":["diagnostics"],
  "domain_expertise":["oncology"],
  "clinical_partner":"need",
  "regulatory_experience":["gdpr_dpia"],
  "compute":"own_cluster",
  "privacy_capability":["can_work_in_tre"],
  "team_size":"2_5",
  "track_record":[],
  "data_needs":{"modality":["imaging_mri"],"disease_area":["oncology"],"min_n_subjects":"1k_10k","linkage_required":["outcomes"],"standards_preferred":["dicom"]}
}'

echo "→ create listing"
CREATE=$(curl -sf -c "$JAR" -b "$JAR" -X POST "$BASE/api/v1/profiles" \
  -H 'content-type: application/json' -d "$PROFILE")
PID=$(echo "$CREATE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['profile']['id'])")
echo "   id $PID"

echo "→ delete listing"
curl -sf -c "$JAR" -b "$JAR" -X DELETE "$BASE/api/v1/profiles/$PID" \
  -H 'content-type: application/json' \
  -d '{"confirm_org_name":"E2E Smoke Lab"}' >/dev/null

PROFILE2='{
  "kind":"ai_team",
  "org_name":"E2E Smoke Lab v2",
  "org_type":"startup",
  "country":"DE",
  "one_liner":"Recreated after delete without re-email.",
  "summary":"AI team listing after type switch e2e.",
  "languages":["en"],
  "looking_for":["dataset_access"],
  "application_status":"intend_to_apply",
  "parallel_public_funding":"no",
  "attending":["webinar_2026_08_20"],
  "open_to_intros":true,
  "visibility":"authenticated_only",
  "contact_name":"E2E Bot",
  "contact_email":"ignored@foresight.org",
  "contact_role":"Tester",
  "methods":["computer_vision"],
  "application_target":["diagnostics"],
  "domain_expertise":["oncology"],
  "clinical_partner":"need",
  "regulatory_experience":["gdpr_dpia"],
  "compute":"own_cluster",
  "privacy_capability":["can_work_in_tre"],
  "team_size":"6_15",
  "track_record":[],
  "data_needs":{"modality":["imaging_mri"],"disease_area":["oncology"],"min_n_subjects":"1k_10k","linkage_required":["outcomes"],"standards_preferred":["dicom"]}
}'

echo "→ recreate without new magic link"
CREATE2=$(curl -sf -c "$JAR" -b "$JAR" -X POST "$BASE/api/v1/profiles" \
  -H 'content-type: application/json' -d "$PROFILE2")
PID2=$(echo "$CREATE2" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['profile']['id'])")
echo "   id $PID2"

echo "→ cleanup delete"
curl -sf -c "$JAR" -b "$JAR" -X DELETE "$BASE/api/v1/profiles/$PID2" \
  -H 'content-type: application/json' \
  -d '{"confirm_org_name":"E2E Smoke Lab v2"}' >/dev/null

echo "E2E PASS ($EMAIL)"
