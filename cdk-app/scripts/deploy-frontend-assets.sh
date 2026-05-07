#!/usr/bin/env bash
set -euo pipefail

bucket="${1:-}"
distribution_id="${2:-}"

if [[ -z "$bucket" || -z "$distribution_id" ]]; then
  echo "Usage: $0 <frontend-bucket-name> <cloudfront-distribution-id>" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_dir="$(cd "$script_dir/.." && pwd)"

npm --prefix "$app_dir/frontend" run build
aws s3 sync "$app_dir/frontend/dist/" "s3://$bucket/" --delete
aws cloudfront create-invalidation --distribution-id "$distribution_id" --paths "/*"
