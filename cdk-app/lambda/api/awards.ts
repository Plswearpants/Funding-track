import { APIGatewayProxyEventV2 } from "aws-lambda";
import { addFilter, badRequest, limitOffset, ok, query, runQuery } from "./http";

const sortColumns = new Map([
  ["amount", "a.award_amount"],
  ["fiscal_year", "a.fiscal_year"],
  ["title", "a.application_title"],
  ["program", "p.name_en"]
]);

export async function handler(event: APIGatewayProxyEventV2) {
  const id = event.pathParameters?.id;
  if (id) return awardDetail(id, event);
  return awardsList(event);
}

async function awardsList(event: APIGatewayProxyEventV2) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  addFilter(clauses, values, "a.fiscal_year = ?", query(event, "fiscal_year"));
  addFilter(clauses, values, "a.program_id = ?", query(event, "program_id"));
  addFilter(clauses, values, "a.organization_id = ?", query(event, "organization_id"));
  addFilter(clauses, values, "o.province_en = ?", query(event, "province"));
  addFilter(clauses, values, "a.committee_code = ?", query(event, "committee_code"));
  addFilter(clauses, values, "a.area_code = ?", query(event, "area_code"));
  addFilter(clauses, values, "a.subject_code = ?", query(event, "subject_code"));
  addFilter(clauses, values, "fs.source_code = ?", query(event, "source"));
  addFilter(clauses, values, "a.award_amount >= ?", query(event, "min_amount"));
  addFilter(clauses, values, "a.award_amount <= ?", query(event, "max_amount"));

  const q = query(event, "q");
  if (q) {
    values.push(q);
    clauses.push(`a.search_document @@ plainto_tsquery('english', $${values.length})`);
  }

  const { limit, offset, page } = limitOffset(event);
  const sort = sortColumns.get(query(event, "sort") ?? "amount") ?? "a.award_amount";
  const order = query(event, "order")?.toLowerCase() === "asc" ? "ASC" : "DESC";
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  values.push(limit, offset);
  const rows = await runQuery(
    `SELECT a.application_id, a.fiscal_year, fs.source_code, a.researcher_name, a.award_amount,
            a.application_title, a.keywords,
            json_build_object('id', o.organization_id, 'name_en', o.name_en, 'name_fr', o.name_fr,
              'province_en', o.province_en, 'province_fr', o.province_fr) AS organization,
            json_build_object('id', p.program_id, 'name_en', p.name_en, 'name_fr', p.name_fr,
              'group_en', p.group_en, 'group_fr', p.group_fr) AS program
     FROM award a
     JOIN funding_source fs ON fs.source_id = a.source_id
     LEFT JOIN organization o ON o.organization_id = a.organization_id
     LEFT JOIN program p ON p.program_id = a.program_id AND p.source_id = a.source_id
     ${where}
     ORDER BY ${sort} ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return ok({ page, limit, results: rows });
}

async function awardDetail(id: string, event: APIGatewayProxyEventV2) {
  const fiscalYear = query(event, "fiscal_year");
  if (!fiscalYear) return badRequest("fiscal_year is required for award detail");

  const rows = await runQuery(
    `SELECT a.*, fs.source_code,
            row_to_json(o) AS organization,
            row_to_json(p) AS program,
            row_to_json(c) AS committee,
            row_to_json(aoa) AS area_of_application,
            row_to_json(rs) AS research_subject,
            COALESCE((SELECT json_agg(row_to_json(ca)) FROM co_applicant ca
              WHERE ca.application_id = a.application_id AND ca.fiscal_year = a.fiscal_year), '[]') AS co_applicants,
            COALESCE((SELECT json_agg(row_to_json(pa)) FROM partner pa
              WHERE pa.application_id = a.application_id AND pa.fiscal_year = a.fiscal_year), '[]') AS partners
     FROM award a
     JOIN funding_source fs ON fs.source_id = a.source_id
     LEFT JOIN organization o ON o.organization_id = a.organization_id
     LEFT JOIN program p ON p.program_id = a.program_id AND p.source_id = a.source_id
     LEFT JOIN committee c ON c.committee_code = a.committee_code
     LEFT JOIN area_of_application aoa ON aoa.area_code = a.area_code
     LEFT JOIN research_subject rs ON rs.subject_code = a.subject_code
     WHERE a.application_id = $1 AND a.fiscal_year = $2`,
    [id, fiscalYear]
  );
  return rows[0] ? ok(rows[0]) : { statusCode: 404, body: JSON.stringify({ error: "Award not found" }) };
}
