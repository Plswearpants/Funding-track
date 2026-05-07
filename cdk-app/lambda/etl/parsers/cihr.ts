import { createHash } from "node:crypto";
import { parse } from "csv-parse";
import { Readable } from "node:stream";
import { PoolClient } from "pg";
import { FundingSourceParser, ParserContext, ParseResult } from "./types";

type CsvRow = Record<string, string | undefined>;

export const cihrParser: FundingSourceParser = {
  sourceCode: "cihr",
  async ingest(context: ParserContext) {
    return ingestAwards(context);
  }
};

async function ingestAwards(context: ParserContext): Promise<ParseResult> {
  const totals = { rowsRead: 0, rowsWritten: 0 };
  for await (const row of records(await context.files.expenditures())) {
    totals.rowsRead++;

    const names = splitNames(row.Name);
    const principalInvestigator = names[0] ?? "";
    const organizationName = text(row.Institution_Paid);
    const organizationId = organizationKey(organizationName);
    const programId = programKey(row.Program_Name);
    const competitionYear = competitionStartYear(row.Competition_CD);
    const fiscalYears = fiscalYearsForTerm(competitionYear, row.Term_Years_Months);
    const applicationId = applicationKey(row);
    const totalAmount = money(row.CIHR_Contribution) + money(row.CIHR_Equipment);
    const annualAmount = fiscalYears.length ? totalAmount / fiscalYears.length : totalAmount;

    await upsertOrganization(context.client, organizationId, organizationName);
    await context.client.query(
      `INSERT INTO program (program_id, source_id, name_en, name_fr, group_en, group_fr)
       VALUES ($1, $2, $3, $3, $4, $4)
       ON CONFLICT (program_id, source_id) DO UPDATE
       SET name_en = EXCLUDED.name_en,
           name_fr = EXCLUDED.name_fr,
           group_en = EXCLUDED.group_en,
           group_fr = EXCLUDED.group_fr`,
      [programId, context.sourceId, text(row.Program_Name), text(row.PRC_Name)]
    );

    for (const fiscalYear of fiscalYears) {
      await context.client.query(
        `INSERT INTO award (
          application_id, fiscal_year, source_id, researcher_name, organization_id,
          competition_year, award_amount, program_id, application_title, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        ON CONFLICT (application_id, fiscal_year) DO UPDATE
        SET source_id = EXCLUDED.source_id,
            researcher_name = EXCLUDED.researcher_name,
            organization_id = EXCLUDED.organization_id,
            competition_year = EXCLUDED.competition_year,
            award_amount = EXCLUDED.award_amount,
            program_id = EXCLUDED.program_id,
            application_title = EXCLUDED.application_title,
            metadata = EXCLUDED.metadata,
            updated_at = now()`,
        [
          applicationId,
          fiscalYear,
          context.sourceId,
          principalInvestigator,
          organizationId,
          competitionYear,
          annualAmount,
          programId,
          text(row.Project_Title),
          JSON.stringify({
            raw_source: "fdd-report.csv",
            competition_cd: text(row.Competition_CD),
            prc_name: text(row.PRC_Name),
            term_years_months: text(row.Term_Years_Months),
            cihr_contribution: money(row.CIHR_Contribution),
            cihr_equipment: money(row.CIHR_Equipment),
            total_project_amount: totalAmount,
            pi_flag_source: "first name in CIHR Name list"
          })
        ]
      );

      for (const coApplicantName of names.slice(1)) {
        await context.client.query(
          `INSERT INTO co_applicant (application_id, fiscal_year, name, organization_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (application_id, fiscal_year, name, organization_id) DO NOTHING`,
          [applicationId, fiscalYear, coApplicantName, organizationId]
        );
      }
      totals.rowsWritten++;
    }
  }
  return totals;
}

async function* records(stream: Readable): AsyncGenerator<CsvRow> {
  const parser = stream.pipe(parse({ columns: true, bom: true, trim: true, relax_quotes: true }));
  for await (const record of parser) {
    yield record as CsvRow;
  }
}

async function upsertOrganization(client: PoolClient, organizationId: string, name: string) {
  await client.query(
    `INSERT INTO organization (organization_id, name_en, name_fr, country_en, country_fr)
     VALUES ($1, $2, $2, 'CANADA', 'CANADA')
     ON CONFLICT (organization_id) DO UPDATE
     SET name_en = EXCLUDED.name_en,
         name_fr = EXCLUDED.name_fr,
         updated_at = now()`,
    [organizationId, name]
  );
}

function splitNames(value: string | undefined) {
  return text(value)
    .split(";")
    .map((name) => name.trim())
    .filter(Boolean);
}

function fiscalYearsForTerm(startYear: number, term: string | undefined) {
  const years = Math.max(1, Number.parseInt(text(term).match(/(\d+)\s*yr/i)?.[1] ?? "1", 10));
  return Array.from({ length: years }, (_, index) => startYear + index);
}

function competitionStartYear(value: string | undefined) {
  const year = Number.parseInt(text(value).slice(0, 4), 10);
  return Number.isFinite(year) && year > 1900 ? year : new Date().getUTCFullYear();
}

function applicationKey(row: CsvRow) {
  const naturalKey = [row.Competition_CD, row.Institution_Paid, row.Project_Title, row.Name].map(text).join("|");
  return `CIHR-${createHash("sha256").update(naturalKey).digest("hex").slice(0, 18)}`;
}

function organizationKey(name: string) {
  return `CIHR-ORG-${createHash("sha256").update(name.toLowerCase()).digest("hex").slice(0, 12)}`;
}

function programKey(value: string | undefined) {
  return `CIHR-${createHash("sha256").update(text(value).toLowerCase()).digest("hex").slice(0, 12)}`;
}

function money(value: string | undefined) {
  return Number.parseFloat(text(value).replace(/[$,\s]/g, "")) || 0;
}

function text(value: string | undefined) {
  return (value ?? "").trim();
}
