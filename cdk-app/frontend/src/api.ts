const BASE = "/api";

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export type Award = {
  application_id: string;
  fiscal_year: number;
  source_code: string;
  researcher_name: string;
  award_amount: number;
  application_title: string;
  keywords: string;
  organization: { id: string; name_en: string; name_fr: string; province_en: string; province_fr: string };
  program: { id: string; name_en: string; name_fr: string; group_en: string; group_fr: string };
};

export type AwardDetail = Award & {
  department: string;
  competition_year: number;
  application_summary: string;
  committee: { committee_code: string; name_en: string; name_fr: string } | null;
  area_of_application: { area_code: string; name_en: string; group_en: string } | null;
  research_subject: { subject_code: string; name_en: string; group_en: string } | null;
  co_applicants: { name: string; organization_id: string }[];
  partners: { organization_id: string; org_type_code: string }[];
};

export type ListResponse<T> = { page: number; limit: number; results: T[] };

export type Filters = {
  sources: { source_code: string; name_en: string; name_fr: string }[];
  programs: { program_id: string; name_en: string; name_fr: string; group_en: string }[];
  provinces: { province_en: string; province_fr: string }[];
  committees: { committee_code: string; name_en: string }[];
  areas: { area_code: string; name_en: string; group_en: string }[];
  subjects: { subject_code: string; name_en: string; group_en: string }[];
};

export type StatGroup = {
  key: string;
  name_en?: string;
  name_fr?: string;
  awards: number;
  total_amount: number;
};

export const api = {
  awards: (params: Record<string, string | number | undefined>) =>
    get<ListResponse<Award>>("/awards", params),
  award: (id: string, fiscalYear: number) =>
    get<AwardDetail>(`/awards/${encodeURIComponent(id)}`, { fiscal_year: fiscalYear }),
  search: (q: string, page = 1, limit = 25) =>
    get<ListResponse<Award>>("/search", { q, page, limit }),
  stats: (groupBy: string) =>
    get<{ group_by: string; results: StatGroup[] }>("/stats", { group_by: groupBy }),
  trends: () =>
    get<{ results: { fiscal_year: number; awards: number; total_amount: number }[] }>("/stats/trends"),
  filters: () => get<Filters>("/filters"),
  programs: (source?: string) =>
    get<{ results: Filters["programs"] }>("/programs", { source }),
  organizations: (params?: Record<string, string | number | undefined>) =>
    get<ListResponse<{ organization_id: string; name_en: string; province_en: string }>>("/organizations", params),
};
