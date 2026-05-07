import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ok, query, runQuery } from "./http";

const groups = new Map([
  ["program", { select: "p.program_id AS key, p.name_en, p.name_fr", join: "LEFT JOIN program p ON p.program_id = a.program_id AND p.source_id = a.source_id", group: "p.program_id, p.name_en, p.name_fr" }],
  ["province", { select: "o.province_en AS key, o.province_fr AS name_fr", join: "LEFT JOIN organization o ON o.organization_id = a.organization_id", group: "o.province_en, o.province_fr" }],
  ["org", { select: "o.organization_id AS key, o.name_en, o.name_fr", join: "LEFT JOIN organization o ON o.organization_id = a.organization_id", group: "o.organization_id, o.name_en, o.name_fr" }],
  ["committee", { select: "c.committee_code AS key, c.name_en, c.name_fr", join: "LEFT JOIN committee c ON c.committee_code = a.committee_code", group: "c.committee_code, c.name_en, c.name_fr" }]
]);

export async function handler(event: APIGatewayProxyEventV2) {
  if (event.rawPath?.endsWith("/trends")) {
    const rows = await runQuery(
      `SELECT fiscal_year, COUNT(*)::int AS awards, SUM(award_amount)::numeric AS total_amount
       FROM award GROUP BY fiscal_year ORDER BY fiscal_year`
    );
    return ok({ results: rows });
  }

  const groupBy = query(event, "group_by") ?? "program";
  const group = groups.get(groupBy) ?? groups.get("program")!;
  const rows = await runQuery(
    `SELECT ${group.select}, COUNT(*)::int AS awards, SUM(a.award_amount)::numeric AS total_amount
     FROM award a
     ${group.join}
     GROUP BY ${group.group}
     ORDER BY total_amount DESC NULLS LAST
     LIMIT 100`
  );
  return ok({ group_by: groupBy, results: rows });
}
