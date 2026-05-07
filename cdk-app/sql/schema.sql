CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS funding_source (
  source_id BIGSERIAL PRIMARY KEY,
  source_code VARCHAR(20) NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  homepage_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization (
  organization_id VARCHAR(50) PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_fr TEXT,
  province_en TEXT,
  province_fr TEXT,
  country_en TEXT,
  country_fr TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS program (
  program_id VARCHAR(50) NOT NULL,
  source_id BIGINT NOT NULL REFERENCES funding_source(source_id),
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  group_en TEXT,
  group_fr TEXT,
  PRIMARY KEY (program_id, source_id)
);

CREATE TABLE IF NOT EXISTS committee (
  committee_code VARCHAR(50) PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS area_of_application (
  area_code VARCHAR(50) PRIMARY KEY,
  group_en TEXT,
  group_fr TEXT,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS research_subject (
  subject_code VARCHAR(50) PRIMARY KEY,
  group_en TEXT,
  group_fr TEXT,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS field_of_research (
  field_code VARCHAR(50) PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS socioeconomic_objective (
  objective_code VARCHAR(50) PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partner_org_type (
  org_type_code TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS award (
  application_id VARCHAR(30) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  source_id BIGINT NOT NULL REFERENCES funding_source(source_id),
  researcher_name TEXT,
  department TEXT,
  organization_id VARCHAR(50) REFERENCES organization(organization_id),
  competition_year INTEGER,
  award_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  program_id VARCHAR(50),
  committee_code VARCHAR(50) REFERENCES committee(committee_code),
  area_code VARCHAR(50) REFERENCES area_of_application(area_code),
  subject_code VARCHAR(50) REFERENCES research_subject(subject_code),
  application_title TEXT,
  keywords TEXT,
  application_summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_document TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(application_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(keywords, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(application_summary, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(researcher_name, '')), 'B')
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id, fiscal_year),
  FOREIGN KEY (program_id, source_id) REFERENCES program(program_id, source_id)
);

CREATE TABLE IF NOT EXISTS award_field_of_research (
  application_id VARCHAR(30) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  field_code VARCHAR(50) NOT NULL REFERENCES field_of_research(field_code),
  PRIMARY KEY (application_id, fiscal_year, field_code),
  FOREIGN KEY (application_id, fiscal_year) REFERENCES award(application_id, fiscal_year) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS award_socioeconomic_objective (
  application_id VARCHAR(30) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  objective_code VARCHAR(50) NOT NULL REFERENCES socioeconomic_objective(objective_code),
  PRIMARY KEY (application_id, fiscal_year, objective_code),
  FOREIGN KEY (application_id, fiscal_year) REFERENCES award(application_id, fiscal_year) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS co_applicant (
  co_applicant_id BIGSERIAL PRIMARY KEY,
  application_id VARCHAR(30) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  name TEXT NOT NULL,
  organization_id VARCHAR(50) REFERENCES organization(organization_id),
  UNIQUE (application_id, fiscal_year, name, organization_id),
  FOREIGN KEY (application_id, fiscal_year) REFERENCES award(application_id, fiscal_year) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS partner (
  partner_id BIGSERIAL PRIMARY KEY,
  application_id VARCHAR(30) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  organization_id VARCHAR(50) NOT NULL REFERENCES organization(organization_id),
  org_type_code TEXT REFERENCES partner_org_type(org_type_code),
  UNIQUE (application_id, fiscal_year, organization_id, org_type_code),
  FOREIGN KEY (application_id, fiscal_year) REFERENCES award(application_id, fiscal_year) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingestion_log (
  ingestion_id BIGSERIAL PRIMARY KEY,
  source_id BIGINT REFERENCES funding_source(source_id),
  fiscal_year INTEGER,
  input_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  rows_read INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_award_source_year ON award(source_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_award_program ON award(program_id);
CREATE INDEX IF NOT EXISTS idx_award_org ON award(organization_id);
CREATE INDEX IF NOT EXISTS idx_award_amount ON award(award_amount);
CREATE INDEX IF NOT EXISTS idx_award_search ON award USING GIN(search_document);
CREATE INDEX IF NOT EXISTS idx_award_title_trgm ON award USING GIN(application_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_org_name_trgm ON organization USING GIN(name_en gin_trgm_ops);

INSERT INTO funding_source (source_code, name_en, name_fr, homepage_url)
VALUES
  ('nserc', 'Natural Sciences and Engineering Research Council of Canada', 'Conseil de recherches en sciences naturelles et en genie du Canada', 'https://www.nserc-crsng.gc.ca/'),
  ('cihr', 'Canadian Institutes of Health Research', 'Instituts de recherche en sante du Canada', 'https://cihr-irsc.gc.ca/')
ON CONFLICT (source_code) DO UPDATE
SET name_en = EXCLUDED.name_en,
    name_fr = EXCLUDED.name_fr,
    homepage_url = EXCLUDED.homepage_url;
