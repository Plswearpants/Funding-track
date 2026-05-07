#!/usr/bin/env bash
set -euo pipefail

bucket="${1:-}"
prefix="${2:-all}"
if [[ -z "$bucket" ]]; then
  echo "Usage: $0 <raw-data-bucket-name> [s3-prefix]" >&2
  exit 1
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
data_file="$root_dir/data/fdd-report.csv"

if [[ ! -f "$data_file" ]]; then
  echo "Could not find CIHR file at $data_file" >&2
  exit 1
fi

aws s3 cp "$data_file" "s3://$bucket/cihr/${prefix}/awards.csv"
