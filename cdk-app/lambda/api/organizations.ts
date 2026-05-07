import { APIGatewayProxyEventV2 } from "aws-lambda";
import { limitOffset, ok, query, runQuery } from "./http";

export async function handler(event: APIGatewayProxyEventV2) {
  const { limit, offset, page } = limitOffset(event);
  const q = query(event, "q");
  const values: unknown[] = [];
  const where = q ? "WHERE name_en ILIKE $1" : "";
  if (q) values.push(`%${q}%`);
  values.push(limit, offset);
  const rows = await runQuery(
    `SELECT organization_id, name_en, name_fr, province_en, province_fr, country_en, country_fr
     FROM organization
     ${where}
     ORDER BY name_en
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return ok({ page, limit, results: rows });
}
