#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────
# Proposal job poller
# Polls the proposal_jobs table for pending jobs, then sends each
# to Fishtail (OpenClaw) via the local hook endpoint.
#
# Usage:
#   ./automations/proposal-poller.sh
#
# Runs in a loop, checking every 15 seconds. Ctrl-C to stop.
# ───────────────────────────────────────────────────────────────────

SUPABASE_URL="https://oirnxlidjgsbcyhtxkse.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s"

FISHTAIL_URL="http://127.0.0.1:18789/hooks/agent"
FISHTAIL_TOKEN="hooks_so4aVe1uQVE6kq1kGj32uEngOlJ0KsGI"

POLL_INTERVAL=15

echo "Proposal poller started. Checking every ${POLL_INTERVAL}s..."

while true; do
  # Fetch pending jobs
  JOBS=$(curl -s \
    "${SUPABASE_URL}/rest/v1/proposal_jobs?status=eq.pending&order=created_at.asc&limit=5" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}")

  # Skip if empty or error
  if [ "$JOBS" = "[]" ] || [ -z "$JOBS" ]; then
    sleep "$POLL_INTERVAL"
    continue
  fi

  # Process each job
  echo "$JOBS" | python3 -c "
import json, sys
jobs = json.load(sys.stdin)
for j in jobs:
    print(json.dumps(j))
" | while read -r JOB; do
    JOB_ID=$(echo "$JOB" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
    DOC_URL=$(echo "$JOB" | python3 -c "import json,sys; print(json.load(sys.stdin)['doc_url'])")
    SLUG=$(echo "$JOB" | python3 -c "import json,sys; print(json.load(sys.stdin)['slug'])")

    echo "[$(date '+%H:%M:%S')] Processing job ${JOB_ID}: slug=${SLUG}"

    # Mark as processing
    curl -s -o /dev/null \
      "${SUPABASE_URL}/rest/v1/proposal_jobs?id=eq.${JOB_ID}" \
      -X PATCH \
      -H "apikey: ${SUPABASE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_KEY}" \
      -H "Content-Type: application/json" \
      -d '{"status": "processing", "updated_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'

    # Send to Fishtail
    MESSAGE="Build a proposal from this Google Doc URL: ${DOC_URL}
Slug: ${SLUG}
Use the canonical locked About Us and Results sections from the proposal template.
Commit the result to the proposal-template repo at /${SLUG}/index.html and push.
When done, update the proposal_jobs row with id=${JOB_ID} status to 'done' via the Supabase API."

    RESPONSE=$(curl -s -w "\n%{http_code}" \
      "${FISHTAIL_URL}" \
      -X POST \
      -H "Authorization: Bearer ${FISHTAIL_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$(python3 -c "
import json
print(json.dumps({
    'name': 'Proposal Builder',
    'agentId': 'main',
    'wakeMode': 'now',
    'deliver': False,
    'message': '''${MESSAGE}'''
}))
")")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "202" ]; then
      echo "[$(date '+%H:%M:%S')] Job ${JOB_ID} sent to Fishtail successfully"
    else
      echo "[$(date '+%H:%M:%S')] Job ${JOB_ID} failed to send (HTTP ${HTTP_CODE})"
      # Mark as error
      curl -s -o /dev/null \
        "${SUPABASE_URL}/rest/v1/proposal_jobs?id=eq.${JOB_ID}" \
        -X PATCH \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"status": "error", "error": "Failed to reach Fishtail (HTTP '"${HTTP_CODE}"')", "updated_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'
    fi
  done

  sleep "$POLL_INTERVAL"
done
