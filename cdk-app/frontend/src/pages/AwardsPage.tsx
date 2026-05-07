import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Award } from "../api";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export default function AwardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") ?? 1);
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {};
    for (const key of ["source", "province", "program_id", "min_amount", "max_amount", "sort", "order"]) {
      const v = searchParams.get(key);
      if (v) f[key] = v;
    }
    return f;
  });

  const { data: filterOptions } = useQuery({
    queryKey: ["filters"],
    queryFn: () => api.filters(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["awards", page, filters],
    queryFn: () => api.awards({ ...filters, page, limit: 25 }),
  });

  function updateFilter(key: string, value: string) {
    const next = { ...filters };
    if (value) next[key] = value;
    else delete next[key];
    setFilters(next);
    setSearchParams({ ...next, page: "1" });
  }

  function goToPage(p: number) {
    setSearchParams({ ...filters, page: String(p) });
  }

  return (
    <div className="flex gap-6">
      <aside className="w-56 shrink-0 space-y-4">
        <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Filters</h2>

        <FilterSelect
          label="Source"
          value={filters.source ?? ""}
          onChange={(v) => updateFilter("source", v)}
          options={filterOptions?.sources.map((s) => ({ value: s.source_code, label: s.name_en })) ?? []}
        />
        <FilterSelect
          label="Province"
          value={filters.province ?? ""}
          onChange={(v) => updateFilter("province", v)}
          options={filterOptions?.provinces.map((p) => ({ value: p.province_en, label: p.province_en })) ?? []}
        />
        <FilterSelect
          label="Program"
          value={filters.program_id ?? ""}
          onChange={(v) => updateFilter("program_id", v)}
          options={filterOptions?.programs.map((p) => ({ value: p.program_id, label: p.name_en })) ?? []}
        />

        <div>
          <label className="block text-xs text-gray-500 mb-1">Min Amount</label>
          <input
            type="number"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            value={filters.min_amount ?? ""}
            onChange={(e) => updateFilter("min_amount", e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Max Amount</label>
          <input
            type="number"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            value={filters.max_amount ?? ""}
            onChange={(e) => updateFilter("max_amount", e.target.value)}
            placeholder="No limit"
          />
        </div>

        <FilterSelect
          label="Sort By"
          value={filters.sort ?? "amount"}
          onChange={(v) => updateFilter("sort", v)}
          options={[
            { value: "amount", label: "Award Amount" },
            { value: "fiscal_year", label: "Fiscal Year" },
            { value: "title", label: "Title" },
          ]}
        />
        <FilterSelect
          label="Order"
          value={filters.order ?? "desc"}
          onChange={(v) => updateFilter("order", v)}
          options={[
            { value: "desc", label: "Descending" },
            { value: "asc", label: "Ascending" },
          ]}
        />
      </aside>

      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Awards</h1>

        {isLoading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-600">Failed to load awards.</p>}

        {data && (
          <>
            <div className="space-y-3">
              {data.results.map((award: Award) => (
                <AwardCard key={`${award.application_id}-${award.fiscal_year}`} award={award} />
              ))}
              {data.results.length === 0 && (
                <p className="text-gray-500 py-8 text-center">No awards found matching your filters.</p>
              )}
            </div>

            <div className="flex items-center justify-between mt-6 text-sm text-gray-600">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={data.results.length < data.limit}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AwardCard({ award }: { award: Award }) {
  return (
    <Link
      to={`/awards/${encodeURIComponent(award.application_id)}?fiscal_year=${award.fiscal_year}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900 truncate">
            {award.application_title || award.application_id}
          </h3>
          <p className="text-sm text-gray-600 mt-0.5">
            {award.researcher_name} &middot; {award.organization?.name_en ?? "Unknown"}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
              {award.source_code?.toUpperCase()}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {award.program?.name_en ?? "N/A"}
            </span>
            <span className="text-xs text-gray-500">FY {award.fiscal_year}</span>
          </div>
        </div>
        <span className="text-lg font-semibold text-green-700 whitespace-nowrap">
          {currency.format(award.award_amount)}
        </span>
      </div>
    </Link>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
