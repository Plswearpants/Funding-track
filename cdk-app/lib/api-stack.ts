import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface ApiStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  rawDataBucket: s3.IBucket;
  databaseSecret: secretsmanager.ISecret;
  databaseEndpoint: string;
}

export class ApiStack extends cdk.Stack {
  readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const environment = {
      RAW_DATA_BUCKET: props.rawDataBucket.bucketName,
      DB_SECRET_ARN: props.databaseSecret.secretArn,
      DB_HOST: props.databaseEndpoint,
      DB_NAME: "funding"
    };

    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.lambdaSecurityGroup],
      environment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      bundling: {
        externalModules: ["@aws-sdk/*"]
      }
    };

    const etl = new NodejsFunction(this, "EtlFunction", {
      ...commonLambdaProps,
      entry: "lambda/etl/handler.ts",
      handler: "handler",
      bundling: {
        ...commonLambdaProps.bundling,
        loader: {
          ".sql": "text"
        }
      },
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      reservedConcurrentExecutions: 1
    });

    const awards = this.apiFunction("AwardsFunction", "lambda/api/awards.ts", commonLambdaProps);
    const search = this.apiFunction("SearchFunction", "lambda/api/search.ts", commonLambdaProps);
    const stats = this.apiFunction("StatsFunction", "lambda/api/stats.ts", commonLambdaProps);
    const organizations = this.apiFunction("OrganizationsFunction", "lambda/api/organizations.ts", commonLambdaProps);
    const programs = this.apiFunction("ProgramsFunction", "lambda/api/programs.ts", commonLambdaProps);
    const filters = this.apiFunction("FiltersFunction", "lambda/api/filters.ts", commonLambdaProps);

    props.rawDataBucket.grantRead(etl);
    props.databaseSecret.grantRead(etl);
    for (const fn of [awards, search, stats, organizations, programs, filters]) {
      props.databaseSecret.grantRead(fn);
    }

    this.api = new apigateway.RestApi(this, "FundingApi", {
      restApiName: "Canadian Funding Tracking API",
      deployOptions: {
        cachingEnabled: true,
        cacheTtl: cdk.Duration.minutes(5),
        metricsEnabled: true,
        tracingEnabled: true,
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });

    const apiRoot = this.api.root.addResource("api");
    const awardsResource = apiRoot.addResource("awards");
    awardsResource.addMethod("GET", new apigateway.LambdaIntegration(awards));
    awardsResource.addResource("{id}").addMethod("GET", new apigateway.LambdaIntegration(awards));
    apiRoot.addResource("search").addMethod("GET", new apigateway.LambdaIntegration(search));
    const statsResource = apiRoot.addResource("stats");
    statsResource.addMethod("GET", new apigateway.LambdaIntegration(stats));
    statsResource.addResource("trends").addMethod("GET", new apigateway.LambdaIntegration(stats));
    apiRoot.addResource("organizations").addMethod("GET", new apigateway.LambdaIntegration(organizations));
    apiRoot.addResource("programs").addMethod("GET", new apigateway.LambdaIntegration(programs));
    apiRoot.addResource("filters").addMethod("GET", new apigateway.LambdaIntegration(filters));

    new cdk.CfnOutput(this, "EtlFunctionName", { value: etl.functionName });
    new cdk.CfnOutput(this, "ApiUrl", { value: this.api.url });
  }

  private apiFunction(id: string, entry: string, props: ConstructorParameters<typeof NodejsFunction>[2]) {
    return new NodejsFunction(this, id, {
      ...props,
      entry,
      handler: "handler"
    });
  }
}
