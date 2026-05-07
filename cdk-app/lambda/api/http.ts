import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { QueryResultRow } from "pg";
import { withClient } from "../etl/db-client";

export function ok(body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}

export function badRequest(message: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 400,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ error: message })
  };
}

export async function runQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return withClient(async (client) => {
    const result = await client.query<T>(sql, params);
    return result.rows;
  });
}

export function query(event: APIGatewayProxyEventV2, name: string) {
  return event.queryStringParameters?.[name];
}

export function limitOffset(event: APIGatewayProxyEventV2) {
  const limit = clamp(Number(query(event, "limit") ?? 25), 1, 100);
  const page = clamp(Number(query(event, "page") ?? 1), 1, 10_000);
  return { limit, offset: (page - 1) * limit, page };
}

export function addFilter(
  clauses: string[],
  values: unknown[],
  sqlExpression: string,
  value: unknown
) {
  if (value === undefined || value === null || value === "") return;
  values.push(value);
  clauses.push(sqlExpression.replace("?", `$${values.length}`));
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}
