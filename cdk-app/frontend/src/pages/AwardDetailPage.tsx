import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export default function AwardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const fiscalYear = Number(searchParams.get("fiscal_year") ?? 2024);

  const { data, isLoading, error } = useQuery({
    queryKey: ["award", id, fiscalYear],
    queryFn: () => api.award(id!, fiscalYear),
    enabled: !!id,
  });

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (error || !data) return <p className="text-red-600">Award not found.</p>;

  const a = data;

  return (
    <div>
      <Link to="/" className="text-sm text-blue-600 hover:underline">&larr; Back to Awards</Link>

      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {a.application_title || a.application_id}
            </h1>
            <p className="text-gray-600 mt-1">{a.researcher_name}</p>
          </div>
          <span className="text-2xl font-bold text-green-700">{currency.format(a.award_amount)}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="Application ID" value={a.application_id} />
          <Field label="Source" value={a.source_code?.toUpperCase()} />
          <Field label="Fiscal Year" value={String(a.fiscal_year)} />
          <Field label="Competition Year" value={String(a.competition_year)} />
          <Field label="Department" value={a.department} />
          <Field label="Institution" value={a.organization?.name_en} />
          <Field label="Province" value={a.organization?.province_en} />
          <Field label="Program" value={a.program?.name_en} />
          <Field label="Program Group" value={a.program?.group_en} />
          <Field label="Committee" value={a.committee?.name_en} />
          <Field label="Area of Application" value={a.area_of_application?.name_en} />
          <Field label="Research Subject" value={a.research_subject?.name_en} />
        </div>

        {a.keywords && (
          <div className="mt-4">
            <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-1">Keywords</h3>
            <div className="flex flex-wrap gap-1">
              {a.keywords.split(";").map((kw, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                  {kw.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {a.application_summary && (
          <div className="mt-4">
            <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-1">Summary</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{a.application_summary}</p>
          </div>
        )}
      </div>

      {a.co_applicants && a.co_applicants.length > 0 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Co-Applicants ({a.co_applicants.length})</h2>
          <div className="space-y-2">
            {a.co_applicants.map((ca, i) => (
              <div key={i} className="text-sm text-gray-700">
                {ca.name} <span className="text-gray-400">&middot; Org #{ca.organization_id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {a.partners && a.partners.length > 0 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Partners ({a.partners.length})</h2>
          <div className="space-y-2">
            {a.partners.map((p, i) => (
              <div key={i} className="text-sm text-gray-700">
                Org #{p.organization_id}
                <span className="text-gray-400 ml-2">{p.org_type_code}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium">{value || "N/A"}</dd>
    </div>
  );
}
