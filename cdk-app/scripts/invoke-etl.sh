#!/usr/bin/env bash
set -euo pipefail

function_name="${1:-}"
source="${2:-nserc}"
year="${3:-}"
output="${4:-response-${source}-${year}.json}"

if [[ -z "$function_name" ]]; then
  echo "Usage: $0 <etl-function-name> [source] [year] [output-json]" >&2
  exit 1
fi

if [[ -z "$year" ]]; then
  if [[ "$source" == "cihr" ]]; then
    payload="{\"source\":\"$source\"}"
    output="${4:-response-${source}-all.json}"
  else
    year="2024"
    payload="{\"source\":\"$source\",\"fiscalYear\":$year}"
    output="${4:-response-${source}-${year}.json}"
  fi
else
  payload="{\"source\":\"$source\",\"fiscalYear\":$year}"
fi

aws lambda invoke \
  --function-name "$function_name" \
  --cli-read-timeout 900 \
  --cli-connect-timeout 30 \
  --cli-binary-format raw-in-base64-out \
  --payload "$payload" \
  "$output"

cat "$output"
