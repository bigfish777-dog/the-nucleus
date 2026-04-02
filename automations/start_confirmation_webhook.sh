#!/usr/bin/env bash
set -euo pipefail
cd /data/.openclaw/workspace/the-nucleus/automations
if pgrep -f "confirmation_webhook.py" >/dev/null 2>&1; then
  echo "confirmation_webhook.py already running"
  exit 0
fi
nohup python3 /data/.openclaw/workspace/the-nucleus/automations/confirmation_webhook.py >> /tmp/nucleus-confirmation-webhook.log 2>&1 &
echo $! > /tmp/nucleus-confirmation-webhook.pid
echo "started confirmation_webhook.py"
