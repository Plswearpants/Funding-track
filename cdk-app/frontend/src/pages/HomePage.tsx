import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const sourceLanes = [
  {
    code: "NSERC",
    name: "Natural sciences and engineering",
    state: "Demo data",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    code: "CIHR",
    name: "Health research",
    state: "Parser scaffolded",
    tone: "border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    code: "SSHRC",
    name: "Social sciences and humanities",
    state: "Next source",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
];

const frictionPoints = [
  "Different agency portals",
  "Different award identifiers",
  "Different program taxonomies",
  "Different update cycles",
];

export default function HomePage() {
  const stats = useQuery({
    queryKey: ["home-stats"],
    queryFn: () => api.stats("program"),
  });
  const trends = useQuery({
    queryKey: ["home-trends"],
    queryFn: () => api.trends(),
  });
  const filters = useQuery({
    queryKey: ["home-filters"],
    queryFn: () => api.filters(),
  });

  const topPrograms = stats.data?.results.slice(0, 5) ?? [];
  const latestTrend = trends.data?.results.at(-1);
  const totalAmount = stats.data?.results.reduce((sum, row) => sum + Number(row.total_amount), 0) ?? 0;
  const loadedSources = filters.data?.sources.length ?? 0;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase text-emerald-700">Canadian research funding portal</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-slate-950">
            One dashboard across fragmented public funding data.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            FundingTrack reduces the friction of moving between agencies, branches, program codes, and award matching systems by normalizing public records into one searchable view.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/awards"
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Browse Awards
            </Link>
            <Link
              to="/search"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Search Funding
            </Link>
            <Link
              to="/stats"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              View Stats
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-xs uppercase text-slate-400">Portal Snapshot</p>
              <h2 className="mt-1 text-xl font-semibold">Unified index</h2>
            </div>
            <span className="rounded-md bg-emerald-400 px-2 py-1 text-xs font-bold text-emerald-950">
              MVP
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 py-5">
            <Metric label="Loaded sources" value={loadedSources || sourceLanes.length} />
            <Metric label="Latest fiscal year" value={latestTrend?.fiscal_year ?? "2024"} />
            <Metric label="Program groups" value={stats.data?.results.length ?? "-"} />
            <Metric label="Tracked funding" value={totalAmount ? currency.format(totalAmount) : "Pending ETL"} wide />
          </div>
          <div className="space-y-2">
            {sourceLanes.map((source) => (
              <div key={source.code} className="flex items-center justify-between rounded-md bg-white/8 px-3 py-2">
                <div>
                  <p className="font-semibold">{source.code}</p>
                  <p className="text-xs text-slate-400">{source.name}</p>
                </div>
                <span className="text-xs text-slate-300">{source.state}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {frictionPoints.map((point, index) => (
          <div key={point} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-2xl font-bold text-slate-300">0{index + 1}</p>
            <p className="mt-3 font-semibold text-slate-900">{point}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Normalized into shared sources, organizations, programs, classifications, and awards.</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Live data lens</p>
              <h2 className="text-lg font-semibold text-slate-950">Top programs by funding</h2>
            </div>
            <Link to="/stats" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
              Open stats
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.isLoading && <p className="p-5 text-sm text-slate-500">Loading program totals...</p>}
            {!stats.isLoading && topPrograms.length === 0 && (
              <p className="p-5 text-sm text-slate-500">Program totals will appear after the first ETL run.</p>
            )}
            {topPrograms.map((program, index) => (
              <div key={program.key ?? index} className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{program.name_en ?? program.key}</p>
                  <p className="mt-1 text-sm text-slate-500">{program.awards} awards</p>
                </div>
                <p className="text-left font-semibold text-emerald-700 sm:text-right">
                  {currency.format(Number(program.total_amount))}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Direct portal</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">What becomes easier</h2>
          <div className="mt-5 space-y-4">
            <Outcome title="Students" body="Find grants by topic, institution, province, and program without knowing every agency system first." />
            <Outcome title="Professors" body="Track collaborators, program fit, partner patterns, and comparable awards across sources." />
            <Outcome title="Public" body="See where public research dollars go using one consistent vocabulary." />
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, wide = false }: { label: string; value: string | number; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 rounded-md bg-white/8 p-3" : "rounded-md bg-white/8 p-3"}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function Outcome({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l-4 border-emerald-500 pl-3">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}
