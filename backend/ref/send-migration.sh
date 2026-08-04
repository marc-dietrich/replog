#!/usr/bin/env bash
# send-migration.sh — POST example.json to the migration endpoint
#
# Usage:
#   ./send-migration.sh                       # sends to gym.made-simple.online
#   ./send-migration.sh http://localhost:8080  # sends to local dev
#
# The response contains a redirectUrl with #token=<uuid> for claiming.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JSON_FILE="${SCRIPT_DIR}/example.json"
BASE_URL="${1:-https://gym.made-simple.online}"

if [[ ! -f "$JSON_FILE" ]]; then
    echo "ERROR: $JSON_FILE not found" >&2
    exit 1
fi

echo "Sending migration payload to ${BASE_URL}/api/migrate ..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d @"$JSON_FILE" \
    "${BASE_URL}/api/migrate")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP $HTTP_CODE"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

if [[ "$HTTP_CODE" == "200" ]]; then
    echo ""
    echo "✅ Migration created. Use the redirectUrl to claim the account."
elif [[ "$HTTP_CODE" == "429" ]]; then
    echo ""
    echo "⛔ Rate limited — too many requests from this IP."
else
    echo ""
    echo "❌ Migration failed (HTTP $HTTP_CODE). Check the error above."
fi
