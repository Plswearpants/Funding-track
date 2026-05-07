#!/usr/bin/env bash
set -euo pipefail

bucket="${1:-}"
year="${2:-2024}"
if [[ -z "$bucket" ]]; then
  echo "Usage: $0 <raw-data-bucket-name> [fiscal-year]" >&2
  exit 1
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
data_dir="$root_dir"

if [[ ! -f "$data_dir/NSERC_FY${year}_Expenditures.csv" && -f "$root_dir/data/NSERC_FY${year}_Expenditures.csv" ]]; then
  data_dir="$root_dir/data"
fi

aws s3 cp "$data_dir/NSERC_FY${year}_Expenditures.csv" "s3://$bucket/nserc/${year}/expenditures.csv"
aws s3 cp "$data_dir/NSERC_FY${year}_CO-APP.csv" "s3://$bucket/nserc/${year}/co-applicants.csv"
aws s3 cp "$data_dir/NSERC_FY${year}_PARTNER.csv" "s3://$bucket/nserc/${year}/partners.csv"
