import { parse } from "csv-parse";
import { Readable } from "node:stream";
import { PoolClient } from "pg";
import { FundingSourceParser, ParserContext, ParseResult } from "./types";

type CsvRow = Record<string, string | undefined>;

export const nsercParser: FundingSourceParser = {
  sourceCode: "nserc",
  async ingest(context: ParserContext) {
    const totals: ParseResult = { rowsRead: 0, rowsWritten: 0 };
    const expenditure = await ingestExpenditures(context.client, context.sourceId, context.files.expenditures);
    totals.rowsRead += expenditure.rowsRead;
    totals.rowsWritten += expenditure.rowsWritten;

    if (context.files.coApplicants) {
      const coApps = await ingestCoApplicants(context.client, context.files.coApplicants);
      totals.rowsRead += coApps.rowsRead;
      totals.rowsWritten += coApps.rowsWritten;
    }

    if (context.files.partners) {
      const partners = await ingestPartners(context.client, context.files.partners);
      totals.rowsRead += partners.rowsRead;
      totals.rowsWritten += partners.rowsWritten;
    }

    return totals;
  }
};

async function ingestExpenditures(
  client: PoolClient,
  sourceId: number,
  open: () => Promise<Readable>
): Promise<ParseResult> {
  const totals = { rowsRead: 0, rowsWritten: 0 };
  for await (const row of records(await open())) {
    totals.rowsRead++;
    await upsertOrganization(client, {
      id: text(row.OrganizationID),
      name: text(row["Institution-Établissement"]),
      provinceEn: text(row.ProvinceEN),
      provinceFr: text(row.ProvinceFR),
      countryEn: text(row.CountryEN),
      countryFr: text(row.CountryFR)
    });

    const programId = text(row.ProgramID);
    if (programId) {
      await client.query(
        `INSERT INTO program (program_id, source_id, name_en, name_fr, group_en, group_fr)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (program_id, source_id) DO UPDATE
         SET name_en = EXCLUDED.name_en, name_fr = EXCLUDED.name_fr,
             group_en = EXCLUDED.group_en, group_fr = EXCLUDED.group_fr`,
        [
          programId,
          sourceId,
          text(row.ProgramNameEN),
          text(row.ProgramNameFR),
          text(row.GroupEN),
          text(row.GroupFR)
        ]
      );
    }

    await upsertLookup(client, "committee", "committee_code", text(row.CommitteeCode), {
      name_en: text(row.CommitteeNameEN),
      name_fr: text(row.CommitteeNameFR)
    });
    await upsertLookup(client, "area_of_application", "area_code", text(row.AreaOfApplicationCode), {
      group_en: text(row.AreaOfApplicationGroupEN),
      group_fr: text(row.AreaOfApplicationGroupFR),
      name_en: text(row.AreaOfApplicationEN),
      name_fr: text(row.AreaOfApplicationFR)
    });
    await upsertLookup(client, "research_subject", "subject_code", text(row.ResearchSubjectCode), {
      group_en: text(row.ResearchSubjectGroupEN),
      group_fr: text(row.ResearchSubjectGroupFR),
      name_en: text(row.ResearchSubjectEN),
      name_fr: text(row.ResearchSubjectFR)
    });

    await client.query(
      `INSERT INTO award (
        application_id, fiscal_year, source_id, researcher_name, department, organization_id,
        competition_year, award_amount, program_id, committee_code, area_code, subject_code,
        application_title, keywords, application_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (application_id, fiscal_year) DO UPDATE
      SET source_id = EXCLUDED.source_id,
          researcher_name = EXCLUDED.researcher_name,
          department = EXCLUDED.department,
          organization_id = EXCLUDED.organization_id,
          competition_year = EXCLUDED.competition_year,
          award_amount = EXCLUDED.award_amount,
          program_id = EXCLUDED.program_id,
          committee_code = EXCLUDED.committee_code,
          area_code = EXCLUDED.area_code,
          subject_code = EXCLUDED.subject_code,
          application_title = EXCLUDED.application_title,
          keywords = EXCLUDED.keywords,
          application_summary = EXCLUDED.application_summary,
          updated_at = now()`,
      [
        text(row.ApplicationID),
        int(row["FiscalYear-Exercice financier"]),
        sourceId,
        text(row["Name-Nom"]),
        text(row["Department-Département"]),
        nullIfEmpty(row.OrganizationID),
        int(row["CompetitionYear-Année de concours"]),
        number(row.AwardAmount),
        nullIfEmpty(row.ProgramID),
        nullIfEmpty(row.CommitteeCode),
        nullIfEmpty(row.AreaOfApplicationCode),
        nullIfEmpty(row.ResearchSubjectCode),
        text(row.ApplicationTitle),
        text(row.Keywords),
        text(row.ApplicationSummary)
      ]
    );

    await syncList(
      client,
      "field_of_research",
      "field_code",
      "award_field_of_research",
      "field_code",
      text(row.ApplicationID),
      int(row["FiscalYear-Exercice financier"]),
      splitList(row.FieldOfResearchListCodes),
      splitList(row.FieldOfResearchListNamesEN),
      splitList(row.FieldOfResearchListNamesFR)
    );
    await syncList(
      client,
      "socioeconomic_objective",
      "objective_code",
      "award_socioeconomic_objective",
      "objective_code",
      text(row.ApplicationID),
      int(row["FiscalYear-Exercice financier"]),
      splitList(row.SocioeconomicObjectiveListCodes),
      splitList(row.SocioeconomicObjectiveListNamesEN),
      splitList(row.SocioeconomicObjectiveListNamesFR)
    );

    totals.rowsWritten++;
  }
  return totals;
}

async function ingestCoApplicants(client: PoolClient, open: () => Promise<Readable>): Promise<ParseResult> {
  const totals = { rowsRead: 0, rowsWritten: 0 };
  for await (const row of records(await open())) {
    totals.rowsRead++;
    await upsertOrganization(client, {
      id: text(row.CoAppOrganizationID),
      name: text(row["CoAppInstitution-Établissement"]),
      provinceEn: text(row.ProvinceEN),
      provinceFr: text(row.ProvinceFR),
      countryEn: text(row.CountryEN),
      countryFr: text(row.CountryFR)
    });
    const result = await client.query(
      `INSERT INTO co_applicant (application_id, fiscal_year, name, organization_id)
       SELECT $1, $2, $3, $4
       WHERE EXISTS (SELECT 1 FROM award WHERE application_id = $1 AND fiscal_year = $2)
       ON CONFLICT (application_id, fiscal_year, name, organization_id) DO NOTHING`,
      [text(row.ApplicationID), int(row["FiscalYear-Exercice financier"]), text(row["CoApplicantName-NomCoApplicant"]), text(row.CoAppOrganizationID)]
    );
    totals.rowsWritten += result.rowCount ?? 0;
  }
  return totals;
}

async function ingestPartners(client: PoolClient, open: () => Promise<Readable>): Promise<ParseResult> {
  const totals = { rowsRead: 0, rowsWritten: 0 };
  for await (const row of records(await open())) {
    totals.rowsRead++;
    await upsertOrganization(client, {
      id: text(row.PartOrganizationID),
      name: text(row["PartInstitution-Établissement"]),
      provinceEn: text(row.ProvinceEN),
      provinceFr: text(row.ProvinceFR),
      countryEn: text(row.CountryEN),
      countryFr: text(row.CountryFR)
    });
    await client.query(
      `INSERT INTO partner_org_type (org_type_code, name_en, name_fr)
       VALUES ($1, $2, $3)
       ON CONFLICT (org_type_code) DO UPDATE SET name_en = EXCLUDED.name_en, name_fr = EXCLUDED.name_fr`,
      [text(row.OrgType).toLowerCase(), text(row.OrgType), text(row.OrgTypeFR)]
    );
    const result = await client.query(
      `INSERT INTO partner (application_id, fiscal_year, organization_id, org_type_code)
       SELECT $1, $2, $3, $4
       WHERE EXISTS (SELECT 1 FROM award WHERE application_id = $1 AND fiscal_year = $2)
       ON CONFLICT (application_id, fiscal_year, organization_id, org_type_code) DO NOTHING`,
      [text(row.ApplicationID), int(row["FiscalYear-Exercice financier"]), text(row.PartOrganizationID), text(row.OrgType).toLowerCase()]
    );
    totals.rowsWritten += result.rowCount ?? 0;
  }
  return totals;
}

async function* records(stream: Readable): AsyncGenerator<CsvRow> {
  const parser = stream.pipe(parse({ columns: true, bom: true, trim: true, relax_quotes: true }));
  for await (const record of parser) {
    yield record as CsvRow;
  }
}

async function upsertOrganization(
  client: PoolClient,
  org: { id: string; name: string; provinceEn: string; provinceFr: string; countryEn: string; countryFr: string }
) {
  if (!org.id) return;
  await client.query(
    `INSERT INTO organization (organization_id, name_en, name_fr, province_en, province_fr, country_en, country_fr)
     VALUES ($1, $2, $2, $3, $4, $5, $6)
     ON CONFLICT (organization_id) DO UPDATE
     SET name_en = EXCLUDED.name_en,
         name_fr = EXCLUDED.name_fr,
         province_en = EXCLUDED.province_en,
         province_fr = EXCLUDED.province_fr,
         country_en = EXCLUDED.country_en,
         country_fr = EXCLUDED.country_fr,
         updated_at = now()`,
    [org.id, org.name, org.provinceEn, org.provinceFr, org.countryEn, org.countryFr]
  );
}

async function upsertLookup(client: PoolClient, table: string, key: string, code: string, values: Record<string, string>) {
  if (!code) return;
  const columns = Object.keys(values);
  const params = [code, ...columns.map((column) => values[column])];
  const assignments = columns.map((column) => `${column} = EXCLUDED.${column}`).join(", ");
  await client.query(
    `INSERT INTO ${table} (${key}, ${columns.join(", ")})
     VALUES (${params.map((_, index) => `$${index + 1}`).join(", ")})
     ON CONFLICT (${key}) DO UPDATE SET ${assignments}`,
    params
  );
}

async function syncList(
  client: PoolClient,
  lookupTable: string,
  lookupKey: string,
  junctionTable: string,
  junctionKey: string,
  applicationId: string,
  fiscalYear: number,
  codes: string[],
  namesEn: string[],
  namesFr: string[]
) {
  for (const [index, code] of codes.entries()) {
    if (!code) continue;
    await upsertLookup(client, lookupTable, lookupKey, code, {
      name_en: namesEn[index] ?? code,
      name_fr: namesFr[index] ?? namesEn[index] ?? code
    });
    await client.query(
      `INSERT INTO ${junctionTable} (application_id, fiscal_year, ${junctionKey})
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [applicationId, fiscalYear, code]
    );
  }
}

function splitList(value: string | undefined) {
  return text(value)
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !/^not available$/i.test(part) && !/^non disponible$/i.test(part));
}

function text(value: string | undefined) {
  return (value ?? "").trim();
}

function nullIfEmpty(value: string | undefined) {
  const next = text(value);
  return next ? next : null;
}

function int(value: string | undefined) {
  return Number.parseInt(text(value), 10) || 0;
}

function number(value: string | undefined) {
  return Number.parseFloat(text(value)) || 0;
}
