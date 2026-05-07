import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { withClient, getSourceId } from "./db-client";
import { cihrParser } from "./parsers/cihr";
import { nsercParser } from "./parsers/nserc";
import { FundingSourceParser, SourceFileMap } from "./parsers/types";
import schemaSql from "../../sql/schema.sql";

type EtlEvent = {
  source?: string;
  fiscalYear?: number;
  keys?: Partial<Record<"expenditures" | "coApplicants" | "partners", string>>;
};

const s3 = new S3Client({});
const parsers = new Map<string, FundingSourceParser>([
  [nsercParser.sourceCode, nsercParser],
  [cihrParser.sourceCode, cihrParser]
]);

export async function handler(event: EtlEvent = {}) {
  const sourceCode = event.source ?? "nserc";
  const fiscalYear = event.fiscalYear ?? (sourceCode === "cihr" ? 0 : 2024);
  const parser = parsers.get(sourceCode);
  if (!parser) throw new Error(`No parser registered for source ${sourceCode}`);

  const bucket = requiredEnv("RAW_DATA_BUCKET");
  const keys = event.keys ?? defaultKeys(sourceCode, fiscalYear);

  return withClient(async (client) => {
    await client.query("SELECT pg_advisory_lock(hashtext('funding-tracker-etl'))");
    let ingestionId: number | undefined;

    try {
      await client.query(schemaSql);
      const sourceId = await getSourceId(client, sourceCode);
      const log = await client.query<{ ingestion_id: string }>(
        `INSERT INTO ingestion_log (source_id, fiscal_year, input_files, status)
         VALUES ($1, $2, $3, 'running')
         RETURNING ingestion_id`,
        [sourceId, fiscalYear || null, JSON.stringify(keys)]
      );
      ingestionId = Number(log.rows[0].ingestion_id);

      await client.query("BEGIN");
      const result = await parser.ingest({
        client,
        sourceId,
        fiscalYear,
        files: fileOpeners(bucket, keys)
      });
      await client.query(
        `UPDATE ingestion_log
         SET status = 'succeeded', rows_read = $2, rows_written = $3, finished_at = now()
         WHERE ingestion_id = $1`,
        [ingestionId, result.rowsRead, result.rowsWritten]
      );
      await client.query("COMMIT");
      return { source: sourceCode, fiscalYear, ...result };
    } catch (error) {
      await client.query("ROLLBACK");
      if (ingestionId) {
        await client.query(
          `UPDATE ingestion_log
           SET status = 'failed', error_message = $2, finished_at = now()
           WHERE ingestion_id = $1`,
          [ingestionId, error instanceof Error ? error.message : String(error)]
        );
      }
      throw error;
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext('funding-tracker-etl'))");
    }
  });
}

function fileOpeners(bucket: string, keys: EtlEvent["keys"]): SourceFileMap {
  if (!keys?.expenditures) throw new Error("Missing expenditures key");
  return {
    expenditures: () => openS3Object(bucket, keys.expenditures!),
    coApplicants: keys.coApplicants ? () => openS3Object(bucket, keys.coApplicants!) : undefined,
    partners: keys.partners ? () => openS3Object(bucket, keys.partners!) : undefined
  };
}

async function openS3Object(bucket: string, key: string) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!(response.Body instanceof Readable)) {
    throw new Error(`S3 object ${key} did not return a readable stream`);
  }
  return response.Body;
}

function defaultKeys(sourceCode: string, fiscalYear: number) {
  if (sourceCode === "nserc") {
    return {
      expenditures: `nserc/${fiscalYear}/expenditures.csv`,
      coApplicants: `nserc/${fiscalYear}/co-applicants.csv`,
      partners: `nserc/${fiscalYear}/partners.csv`
    };
  }
  if (sourceCode === "cihr") {
    return {
      expenditures: "cihr/all/awards.csv"
    };
  }
  return {
    expenditures: `${sourceCode}/${fiscalYear}/awards.csv`
  };
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}
