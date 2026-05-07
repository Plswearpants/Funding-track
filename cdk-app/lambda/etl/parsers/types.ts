import { Readable } from "node:stream";
import { PoolClient } from "pg";

export type SourceFileMap = {
  expenditures: () => Promise<Readable>;
  coApplicants?: () => Promise<Readable>;
  partners?: () => Promise<Readable>;
};

export type ParserContext = {
  client: PoolClient;
  sourceId: number;
  fiscalYear: number;
  files: SourceFileMap;
};

export type ParseResult = {
  rowsRead: number;
  rowsWritten: number;
};

export interface FundingSourceParser {
  sourceCode: string;
  ingest(context: ParserContext): Promise<ParseResult>;
}
