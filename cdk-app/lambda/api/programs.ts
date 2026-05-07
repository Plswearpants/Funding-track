import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ok, query, runQuery } from "./http";

export async function handler(event: APIGatewayProxyEventV2) {
  const source = query(event, "source");
  const rows = await runQuery(
    `SELECT p.program_id, fs.source_code, p.name_en, p.name_fr, p.group_en, p.group_fr
     FROM program p
     JOIN funding_source fs ON fs.source_id = p.source_id
     WHERE ($1::text IS NULL OR fs.source_code = $1)
     ORDER BY p.name_en`,
    [source ?? null]
  );
  return ok({ results: rows });
}
