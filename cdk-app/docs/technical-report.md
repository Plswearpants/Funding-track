# Canadian Funding Tracking Platform Technical Report

## 1. Executive Summary

The Canadian Funding Tracking Platform is a public research funding discovery system that normalizes data from multiple Canadian agencies into one searchable, explorable portal. The current MVP is deployed with AWS CDK in TypeScript and supports a full cloud architecture: networking, PostgreSQL storage, raw file storage, API Gateway, Lambda functions, and a CloudFront-hosted React frontend.

The core product idea is to reduce friction caused by fragmented public funding data. Different agencies publish different files, identifiers, naming conventions, program structures, fiscal-year logic, and researcher lists. The platform addresses this by preserving raw source files in S3, applying source-specific ETL parsers, and writing normalized records into a shared PostgreSQL schema.

The demo currently targets NSERC and CIHR:

- NSERC has separate yearly files for awards/expenditures, co-applicants, and partners. For two fiscal years, this means six NSERC source files.
- CIHR has one wider funding file containing names, institution, program, project title, money fields, competition code, and term information.

The immediate architecture separates two concerns:

```text
Data ingestion:
Agency CSV files -> Raw S3 bucket -> ETL Lambda -> PostgreSQL

User access:
User browser -> CloudFront React app -> API Gateway -> API Lambdas -> PostgreSQL
```

AI/Bedrock, advanced semantic subject derivation, and chat history are future layers. They are not part of the current deployed MVP.

## 2. Repository Layout

The project lives in:

```text
/Users/dchen/Documents/Funding-track/cdk-app
```

Important paths:

```text
bin/app.ts                  CDK app entry point
lib/network-stack.ts        VPC, subnets, security groups, VPC endpoints
lib/database-stack.ts       RDS PostgreSQL and Secrets Manager
lib/storage-stack.ts        Raw data S3 bucket
lib/api-stack.ts            ETL/API Lambdas and API Gateway
lib/frontend-stack.ts       Frontend S3 bucket and CloudFront distribution
lambda/etl/                 ETL Lambda implementation
lambda/etl/parsers/         Source-specific parsers for NSERC and CIHR
lambda/api/                 API Lambda handlers
sql/schema.sql              Normalized PostgreSQL schema
frontend/                   React/Vite frontend
scripts/                    Upload, deploy, and ETL helper scripts
docs/technical-report.md    This report
```

The raw data files currently live one level above the CDK app:

```text
/Users/dchen/Documents/Funding-track/data
```

## 3. AWS Architecture

The application is defined as five CDK stacks. The stacks are intentionally separated by responsibility so that frontend, API, storage, database, and network changes can be deployed independently when appropriate.

### 3.1 FundingNetworkStack

File:

```text
lib/network-stack.ts
```

Responsibilities:

- Creates the VPC.
- Creates public and isolated private subnets.
- Avoids NAT Gateway to reduce cost.
- Creates Lambda and database security groups.
- Allows Lambda security group traffic into PostgreSQL on port `5432`.
- Adds VPC endpoints:
  - S3 gateway endpoint
  - Secrets Manager interface endpoint

Key connection:

```text
LambdaSecurityGroup -> DatabaseSecurityGroup TCP 5432
```

This stack is a dependency for the database and API stacks.

### 3.2 FundingDatabaseStack

File:

```text
lib/database-stack.ts
```

Responsibilities:

- Creates an RDS PostgreSQL database.
- Creates/generated the database secret in AWS Secrets Manager.
- Outputs the database endpoint.

Current database settings:

- Engine: PostgreSQL major version 16
- Instance class: `db.t3.micro`
- Database name: `funding`
- Private isolated subnets
- Encrypted storage
- Seven-day backup retention

Important output:

```text
FundingDatabaseStack.DatabaseEndpoint
```

The Lambda functions do not hardcode credentials. They receive the secret ARN and database host through environment variables.

### 3.3 FundingStorageStack

File:

```text
lib/storage-stack.ts
```

Responsibilities:

- Creates the raw-data S3 bucket.
- Blocks public access.
- Enables S3-managed encryption.
- Enables versioning.
- Retains the raw bucket on stack deletion.

Important output:

```text
FundingStorageStack.RawDataBucketName
```

Current deployed raw bucket:

```text
fundingstoragestack-rawdatabucket57f26c03-rooeagbmvua0
```

Expected S3 key layout:

```text
nserc/2023/expenditures.csv
nserc/2023/co-applicants.csv
nserc/2023/partners.csv
nserc/2024/expenditures.csv
nserc/2024/co-applicants.csv
nserc/2024/partners.csv
cihr/all/awards.csv
```

### 3.4 FundingApiStack

File:

```text
lib/api-stack.ts
```

Responsibilities:

- Creates the ETL Lambda.
- Creates API Lambda functions.
- Creates API Gateway REST API.
- Grants Lambdas access to:
  - raw S3 bucket
  - database secret
  - VPC network access
- Wires API Gateway routes to Lambda functions.

Current API functions:

```text
lambda/etl/handler.ts          ETL ingestion
lambda/api/awards.ts           GET /api/awards and GET /api/awards/{id}
lambda/api/search.ts           GET /api/search
lambda/api/stats.ts            GET /api/stats and GET /api/stats/trends
lambda/api/organizations.ts    GET /api/organizations
lambda/api/programs.ts         GET /api/programs
lambda/api/filters.ts          GET /api/filters
```

Current deployed API URL:

```text
https://nzev8500u1.execute-api.us-west-2.amazonaws.com/prod/
```

Current deployed ETL Lambda:

```text
FundingApiStack-EtlFunction22ED5A0D-5yQvyBPR2vkj
```

Important implementation detail:

- PostgreSQL connections use SSL because the RDS instance requires encrypted connections.
- The ETL Lambda applies `sql/schema.sql` idempotently before ingestion.

### 3.5 FundingFrontendStack

File:

```text
lib/frontend-stack.ts
```

Responsibilities:

- Creates the private frontend S3 bucket.
- Creates a CloudFront distribution.
- Uses CloudFront Origin Access Control for private S3 access.
- Routes `/api/*` requests to API Gateway.
- Routes all other requests to the React static site.

Important outputs:

```text
FundingFrontendStack.CloudFrontUrl
FundingFrontendStack.FrontendBucketName
FundingFrontendStack.CloudFrontDistributionId
```

Current deployed frontend values:

```text
CloudFront URL: https://d297zx8xpp01hq.cloudfront.net
Frontend bucket: fundingfrontendstack-frontendbucketefe2e19c-3flcbb66qtli
CloudFront distribution: E3DF2G97DYUN2R
```

Originally, the stack used CDK `BucketDeployment`, but that custom resource failed while copying frontend assets from the CDK bootstrap bucket. We simplified the architecture:

- CDK creates the bucket and CloudFront distribution.
- A local script builds and uploads frontend assets with `aws s3 sync`.
- The script then creates a CloudFront invalidation.

Frontend deployment script:

```text
scripts/deploy-frontend-assets.sh
```

## 4. Stack Dependency Graph

Logical dependencies:

```text
FundingNetworkStack
  -> FundingDatabaseStack
  -> FundingStorageStack
  -> FundingApiStack
  -> FundingFrontendStack
```

Practical interpretation:

- The network must exist before RDS and VPC Lambdas can exist.
- The database must exist before API Lambdas can receive DB connection settings.
- The raw S3 bucket must exist before the ETL Lambda can read source files.
- The API must exist before CloudFront can route `/api/*`.
- The frontend distribution depends on the API origin and frontend bucket.

## 5. PostgreSQL Data Model

The database is not CSV. CSV files are only raw inputs. After ETL, records are stored as relational data in PostgreSQL.

Main tables:

```text
funding_source
organization
program
committee
area_of_application
research_subject
field_of_research
socioeconomic_objective
partner_org_type
award
award_field_of_research
award_socioeconomic_objective
co_applicant
partner
ingestion_log
```

Core fact table:

```text
award
```

Primary key:

```text
(application_id, fiscal_year)
```

This supports the idea that one application/project can appear across multiple fiscal years.

Important design points:

- `funding_source` distinguishes NSERC, CIHR, and future agencies.
- `organization` is shared across awards, co-applicants, and partners.
- `program` is source-specific because program codes and program names are agency-specific.
- NSERC semicolon-separated fields are split into lookup and junction tables.
- `award.metadata JSONB` stores source-specific fields that do not belong in the shared normalized columns.
- PostgreSQL full-text search is enabled through a generated `search_document` column on `award`.

## 6. Source Data Reality

The workbook `funding tracker metadata description.xlsx` clarifies the data normalization problem. It has three sheets:

- Sheet 1: canonical `meta_name` fields and how to derive them from NSERC and CIHR.
- Sheet 2: NSERC data tables, linkable IDs, and variables of interest.
- Sheet 3: CIHR variables and notes.

### 6.1 NSERC Source Shape

NSERC uses three files per fiscal year:

```text
NSERC_FY2023_Expenditures.csv
NSERC_FY2023_CO-APP.csv
NSERC_FY2023_PARTNER.csv
NSERC_FY2024_Expenditures.csv
NSERC_FY2024_CO-APP.csv
NSERC_FY2024_PARTNER.csv
```

The key link field is:

```text
ApplicationID
```

The expenditures file is the core award file. It contains:

```text
ApplicationID
Name-Nom
OrganizationID
Institution-Établissement
FiscalYear-Exercice financier
CompetitionYear-Année de concours
AwardAmount
ProgramID
ProgramNameEN
ProgramNameFR
CommitteeCode
AreaOfApplication...
ResearchSubject...
FieldOfResearch...
SocioeconomicObjective...
ApplicationTitle
Keywords
ApplicationSummary
```

The co-applicant file is a long-format extension:

```text
ApplicationID
CoApplicantName-NomCoApplicant
CoAppOrganizationID
CoAppInstitution-Établissement
FiscalYear-Exercice financier
```

The partner file is also a long-format extension:

```text
ApplicationID
PartOrganizationID
PartInstitution-Établissement
OrgType
OrgTypeFR
FiscalYear-Exercice financier
```

### 6.2 CIHR Source Shape

CIHR currently uses one file:

```text
fdd-report.csv
```

Relevant columns:

```text
Name
Institution_Paid
Program_Name
Competition_CD
PRC_Name
Project_Title
CIHR_Contribution
CIHR_Equipment
Term_Years_Months
```

CIHR differs from NSERC in several ways:

- It does not have the same `ApplicationID` model.
- Names are stored as a semicolon-separated list in one `Name` column.
- The first name is treated as PI.
- Remaining names are treated as co-PIs/co-applicants.
- Funding amount is split into contribution and equipment.
- Fiscal-year coverage must be derived from competition code plus term length.
- Subject classifications are not directly equivalent to NSERC fields.

## 7. Cross-Agency Metadata Bridge

The most important layer is the canonical metadata bridge. This is how the platform turns agency-specific exports into a common query surface.

### 7.1 Canonical Fields From Workbook

The first sheet defines these canonical fields:

```text
researcher name
Project name/title
flag_PI_co-PI
fiscal year
money/asset
allocation (derived)
subject1 (area)
subject2 (subject group)
subject3 (subject)
funding agent
```

These are not necessarily one-to-one database columns. Some map directly to columns, some map to related tables, and some are future derived fields.

### 7.2 NSERC Canonical Mapping

```text
researcher name
  PI: Name-Nom from NSERC award/expenditures file
  co-PI: CoApplicantName-NomCoApplicant from NSERC co-applicant file

Project name/title
  ApplicationTitle

flag_PI_co-PI
  PI when record comes from Name-Nom in award/expenditures file
  co-PI when record comes from CoApplicantName-NomCoApplicant in co-applicant file

fiscal year
  FiscalYear-Exercice financier

money/asset
  AwardAmount

subject1 (area)
  AreaOfApplicationGroupEN

subject2 (subject group)
  ResearchSubjectGroupEN

subject3 (subject)
  ResearchSubjectEN

funding agent
  nserc
```

Current implementation:

- `Name-Nom` becomes `award.researcher_name`.
- `CoApplicantName-NomCoApplicant` becomes rows in `co_applicant`.
- `AwardAmount` becomes `award.award_amount`.
- `ApplicationTitle` becomes `award.application_title`.
- Program, committee, area, subject, organization, partner, field of research, and socioeconomic objective are normalized into related tables.

### 7.3 CIHR Canonical Mapping

```text
researcher name
  Name, split on ";"

Project name/title
  Project_Title

flag_PI_co-PI
  PI = first name in Name list
  co-PI = remaining names in Name list

fiscal year
  Start year parsed from Competition_CD
  Expanded by Term_Years_Months

money/asset
  CIHR_Contribution + CIHR_Equipment

subject1/subject2/subject3
  Not directly available as NSERC-equivalent fields
  Future derivation from Program_Name, PRC_Name, Project_Title, and possibly AI/manual taxonomy

funding agent
  cihr
```

Current implementation:

- First CIHR name becomes `award.researcher_name`.
- Remaining CIHR names become rows in `co_applicant`.
- `Project_Title` becomes `award.application_title`.
- `CIHR_Contribution + CIHR_Equipment` becomes `award.award_amount`.
- The total project amount is divided across derived fiscal years.
- `Competition_CD`, `PRC_Name`, `Term_Years_Months`, original contribution, equipment, and total project amount are stored in `award.metadata`.
- A stable synthetic `CIHR-...` application ID is generated from competition code, institution, title, and names.

## 8. Why This Bridge Matters

The bridge is the heart of the platform because the agencies do not agree on:

- identifiers
- file structures
- researcher representation
- program taxonomies
- subject taxonomies
- fiscal-year representation
- money fields
- partner and co-applicant formats

Without the bridge, a user has to know which agency to search, what file to download, what column names to inspect, and how to interpret the data model. With the bridge, the public user gets a consistent search and dashboard surface:

```text
Who received funding?
For what project?
From which agency?
In what fiscal year?
How much money?
At which institution?
Under which program or subject?
With which collaborators or partners?
```

This is the product advantage: the platform does not merely host files. It converts incompatible public datasets into a shared funding intelligence layer.

## 9. Current ETL Behavior

ETL entry point:

```text
lambda/etl/handler.ts
```

The handler receives:

```json
{
  "source": "nserc",
  "fiscalYear": 2024
}
```

or:

```json
{
  "source": "cihr",
  "fiscalYear": 2025
}
```

It then:

1. Determines the source parser.
2. Resolves default S3 keys for that source and year.
3. Opens a PostgreSQL connection over SSL.
4. Applies `schema.sql` idempotently.
5. Creates an `ingestion_log` row.
6. Runs the parser.
7. Updates the ingestion log as succeeded or failed.

NSERC parser:

```text
lambda/etl/parsers/nserc.ts
```

CIHR parser:

```text
lambda/etl/parsers/cihr.ts
```

## 10. API Layer

The API exposes normalized data, not raw CSV rows.

Endpoints:

```text
GET /api/awards
GET /api/awards/{id}?fiscal_year=
GET /api/search?q=
GET /api/stats?group_by=
GET /api/stats/trends
GET /api/organizations
GET /api/programs
GET /api/filters
```

Important filters on awards:

```text
fiscal_year
program_id
organization_id
province
min_amount
max_amount
committee_code
area_code
subject_code
source
q
sort
order
page
limit
```

This API design allows the frontend to remain source-agnostic. The frontend can ask for `source=nserc` or `source=cihr`, but it does not need to know how each source was parsed.

## 11. Frontend Status

Frontend path:

```text
frontend/
```

Technology:

- React
- Vite
- TanStack Query
- Tailwind CSS
- React Router

Current pages:

```text
/           Portal/demo homepage
/awards     Browse/filter awards
/awards/:id Award detail
/search     Full-text search
/stats      Aggregations and trends
```

The homepage now communicates the main demo concept:

```text
One dashboard across fragmented public funding data.
```

It highlights:

- NSERC demo data
- CIHR parser/data bridge
- future SSHRC source
- portal snapshot metrics
- top programs once data is loaded

Future PNG UI figures can refine this frontend. The likely next frontend work will be:

- richer visual dashboards
- agency comparison components
- interactive filtering controls
- drill-down views for researchers, institutions, and programs
- chart components for funding over time, province, program, and agency

## 12. Deployment and Operations

Build checks:

```bash
npm run test
npm run synth
npm --prefix frontend run build
```

Deploy infrastructure:

```bash
npm run cdk -- deploy --all --require-approval never
```

Deploy only API changes:

```bash
npm run cdk -- deploy FundingApiStack --require-approval never
```

Deploy only frontend infrastructure:

```bash
npm run cdk -- deploy FundingFrontendStack --require-approval never
```

Upload frontend assets:

```bash
./scripts/deploy-frontend-assets.sh \
  fundingfrontendstack-frontendbucketefe2e19c-3flcbb66qtli \
  E3DF2G97DYUN2R
```

Upload all current demo source data:

```bash
./scripts/upload-demo-data.sh \
  fundingstoragestack-rawdatabucket57f26c03-rooeagbmvua0
```

Invoke ETL:

```bash
./scripts/invoke-etl.sh FundingApiStack-EtlFunction22ED5A0D-5yQvyBPR2vkj nserc 2023
./scripts/invoke-etl.sh FundingApiStack-EtlFunction22ED5A0D-5yQvyBPR2vkj nserc 2024
./scripts/invoke-etl.sh FundingApiStack-EtlFunction22ED5A0D-5yQvyBPR2vkj cihr
```

## 13. Known Gaps and Next Steps

### 13.1 Data Model Refinements

The database currently supports normalized award exploration, but the canonical metadata bridge should become more explicit.

Recommended next step:

- Add a SQL view or table for canonical researcher/project records.
- Make PI/co-PI status directly queryable instead of inferred from `award` versus `co_applicant`.
- Consider a `researcher` table later if deduplication becomes important.

Potential canonical view:

```text
funding_person_role_view
  source
  application_id
  fiscal_year
  researcher_name
  role: PI | CO_PI
  project_title
  amount
  organization
  program
```

### 13.2 CIHR Subject Derivation

CIHR does not provide NSERC-style subject columns in the current file. The workbook suggests deriving field and subject based on title and program name.

Possible approaches:

- rules-based mapping from `Program_Name` and `PRC_Name`
- manual taxonomy table
- later Bedrock-assisted classification
- hybrid model with human-reviewable classification outputs

This should be treated as a derived metadata layer, not as raw source truth.

### 13.3 Allocation Logic

`allocation (derived)` is listed in the workbook but not fully specified yet.

Questions to resolve:

- Does allocation mean annualized amount?
- Does allocation mean distribution among PI/co-PIs?
- Does allocation mean institution/program/agency allocation?
- Should CIHR total project funding be divided evenly across term years, or stored as full project amount on start year?

Current CIHR implementation annualizes total amount evenly across derived fiscal years.

### 13.4 Better Ingestion Observability

The ingestion log exists, but the frontend does not yet expose it.

Useful next additions:

- ingestion status page
- row counts by source/year
- failed row sample capture
- schema validation report
- source freshness indicator

### 13.5 Frontend Visualizations

Once UI PNG mockups are available, the frontend should add charts and interactions around:

- funding by agency
- funding by fiscal year
- top institutions
- top programs
- province distribution
- PI/co-PI collaboration graph
- partner organization type
- search-to-detail drilldowns

### 13.6 Future AI Layer

AI should be added after the normalized data layer is stable.

Likely future architecture:

```text
Normalized PostgreSQL data
  -> derived text corpus / embeddings
  -> Bedrock or knowledge-base layer
  -> natural-language funding assistant
```

The AI layer should not replace the relational database. It should sit beside it and help users interpret, summarize, classify, and compare funding records.

## 14. Current Status

Completed:

- CDK infrastructure scaffold
- VPC, security groups, RDS, raw S3, API Gateway, Lambda, CloudFront
- normalized PostgreSQL schema
- NSERC parser for expenditures, co-applicants, partners
- CIHR parser based on workbook metadata
- frontend portal and dashboard shell
- upload and invoke helper scripts
- manual frontend asset deployment path

In progress:

- deploying the latest API stack with SSL database connections and CIHR parser
- loading NSERC 2023, NSERC 2024, and CIHR source files
- validating first full multi-source ingestion

Most important next milestone:

```text
Successfully ingest NSERC 2023 + NSERC 2024 + CIHR, then verify the frontend displays cross-agency results through the same awards, search, stats, and filters interface.
```
