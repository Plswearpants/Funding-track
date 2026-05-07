#!/usr/bin/env bash
set -euo pipefail

bucket="${1:-}"
if [[ -z "$bucket" ]]; then
  echo "Usage: $0 <raw-data-bucket-name>" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$script_dir/upload-nserc-2024.sh" "$bucket" 2023
"$script_dir/upload-nserc-2024.sh" "$bucket" 2024
"$script_dir/upload-cihr.sh" "$bucket" all
