import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { Pool, PoolClient } from "pg";

let pool: Pool | undefined;

type DbSecret = {
  username: string;
  password: string;
  host?: string;
  port?: number;
  dbname?: string;
};

export async function getPool() {
  if (pool) return pool;

  const secretArn = requiredEnv("DB_SECRET_ARN");
  const secret = await new SecretsManagerClient({}).send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );
  const value = JSON.parse(secret.SecretString ?? "{}") as DbSecret;

  pool = new Pool({
    host: process.env.DB_HOST ?? value.host,
    port: value.port ?? 5432,
    database: process.env.DB_NAME ?? value.dbname ?? "funding",
    user: value.username,
    password: value.password,
    ssl: {
      rejectUnauthorized: false
    },
    max: 2,
    idleTimeoutMillis: 10_000
  });

  return pool;
}

export async function withClient<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await (await getPool()).connect();
  try {
    return await work(client);
  } finally {
    client.release();
  }
}

export async function getSourceId(client: PoolClient, sourceCode: string) {
  const result = await client.query<{ source_id: string }>(
    "SELECT source_id FROM funding_source WHERE source_code = $1",
    [sourceCode]
  );
  if (!result.rowCount) {
    throw new Error(`Unknown funding source: ${sourceCode}`);
  }
  return Number(result.rows[0].source_id);
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}
