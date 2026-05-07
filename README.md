# Canadian Funding Tracker

AWS CDK TypeScript app for browsing Canadian research funding data. The MVP path deploys PostgreSQL, S3, Lambda/API Gateway, CloudFront, and a static React frontend.

## Current Scope

- NSERC FY2024 ingestion is implemented for expenditures, co-applicants, and partners.
- CIHR is registered as a funding source and has a parser placeholder ready for schema mapping.
- The ETL Lambda applies `sql/schema.sql` idempotently before ingestion.

## Local Checks

```bash
npm run test
npm --prefix frontend run build
npm run synth
```

## Deploy Flow

```bash
npm install
npm --prefix frontend install
npm --prefix frontend run build
npm run cdk -- deploy --all
```

After deploy, note the `RawDataBucketName`, `EtlFunctionName`, `ApiUrl`, and `CloudFrontUrl` stack outputs.

Upload the NSERC FY2024 files using the raw-data bucket output:

```bash
./scripts/upload-nserc-2024.sh <raw-data-bucket-name>
```

Invoke ETL:

```bash
aws lambda invoke \
  --function-name <etl-function-name> \
  --payload '{"source":"nserc","fiscalYear":2024}' \
  response.json
```

The default ETL keys are:

- `nserc/2024/expenditures.csv`
- `nserc/2024/co-applicants.csv`
- `nserc/2024/partners.csv`

## Main Paths

- CDK stacks: `lib/`
- ETL Lambda: `lambda/etl/`
- API Lambdas: `lambda/api/`
- Database schema: `sql/schema.sql`
- Frontend: `frontend/`

<img width="1490" height="1439" alt="image" src="https://github.com/user-attachments/assets/3cc40141-cbb9-4c48-985e-cd79327740c2" />
