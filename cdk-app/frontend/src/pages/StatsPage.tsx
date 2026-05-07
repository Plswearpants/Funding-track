import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const groupOptions = [
  { value: "program", label: "Program" },
  { value: "province", label: "Province" },
  { value: "org", label: "Organization" },
  { value: "committee", label: "Committee" },
];

export default function StatsPage() {
  const [groupBy, setGroupBy] = useState("program");
  const stats = useQuery({
    queryKey: ["stats", groupBy],
    queryFn: () => api.stats(groupBy),
  });
  const trends = useQuery({
    queryKey: ["trends"],
    queryFn: () => api.trends(),
  });

  const max = Math.max(1, ...((stats.data?.results ?? []).map((row) => Number(row.total_amount))));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Stats</h1>
        <select
          className="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
          value={groupBy}
          onChange={(event) => setGroupBy(event.target.value)}
        >
          {groupOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Awards by {groupOptions.find((o) => o.value === groupBy)?.label}</h2>
        </div>
        {stats.isLoading && <p className="text-gray-500 p-4">Loading...</p>}
        <div className="divide-y divide-gray-100">
          {(stats.data?.results ?? []).slice(0, 25).map((row) => (
            <div key={row.key ?? row.name_en} className="grid grid-cols-[minmax(0,1fr)_160px] gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{row.name_en ?? row.key ?? "Unknown"}</p>
                <div className="h-2 bg-gray-100 rounded mt-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${Math.max(3, (Number(row.total_amount) / max) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-700">{currency.format(Number(row.total_amount))}</p>
                <p className="text-xs text-gray-500">{row.awards} awards</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Yearly Trends</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(trends.data?.results ?? []).map((row) => (
            <div key={row.fiscal_year} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium text-gray-900">FY {row.fiscal_year}</span>
              <span className="text-sm text-gray-600">
                {row.awards} awards · {currency.format(Number(row.total_amount))}
              </span>
            </div>
          ))}
          {!trends.isLoading && trends.data?.results.length === 0 && (
            <p className="text-gray-500 p-4">No trend data loaded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
