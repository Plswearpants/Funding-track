import { APIGatewayProxyEventV2 } from "aws-lambda";
import { badRequest, limitOffset, ok, query, runQuery } from "./http";

export async function handler(event: APIGatewayProxyEventV2) {
  const q = query(event, "q");
  if (!q) return badRequest("q is required");
  const { limit, offset, page } = limitOffset(event);
  const rows = await runQuery(
    `SELECT a.application_id, a.fiscal_year, fs.source_code, a.researcher_name,
            a.application_title, a.award_amount, o.name_en AS organization_name_en,
            ts_rank(a.search_document, plainto_tsquery('english', $1)) AS rank
     FROM award a
     JOIN funding_source fs ON fs.source_id = a.source_id
     LEFT JOIN organization o ON o.organization_id = a.organization_id
     WHERE a.search_document @@ plainto_tsquery('english', $1)
     ORDER BY rank DESC, a.award_amount DESC
     LIMIT $2 OFFSET $3`,
    [q, limit, offset]
  );
  return ok({ page, limit, results: rows });
}
