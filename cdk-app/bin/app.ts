#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { DatabaseStack } from "../lib/database-stack";
import { StorageStack } from "../lib/storage-stack";
import { ApiStack } from "../lib/api-stack";
import { FrontendStack } from "../lib/frontend-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "ca-central-1"
};

const network = new NetworkStack(app, "FundingNetworkStack", { env });
const database = new DatabaseStack(app, "FundingDatabaseStack", {
  env,
  vpc: network.vpc,
  databaseSecurityGroup: network.databaseSecurityGroup
});
database.addDependency(network);

const storage = new StorageStack(app, "FundingStorageStack", { env });
storage.addDependency(database);

const api = new ApiStack(app, "FundingApiStack", {
  env,
  vpc: network.vpc,
  lambdaSecurityGroup: network.lambdaSecurityGroup,
  rawDataBucket: storage.rawDataBucket,
  databaseSecret: database.databaseSecret,
  databaseEndpoint: database.databaseEndpoint
});
api.addDependency(storage);

const frontend = new FrontendStack(app, "FundingFrontendStack", {
  env,
  api: api.api
});
frontend.addDependency(api);
