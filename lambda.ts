// lambda.ts
import { createLambdaAdapter } from './aws-lambda-adapter';
import { mainHandler } from './serverless';

/**
 * This is the entrypoint for AWS Lambda.
 * It takes the generic mainHandler and wraps it in the Lambda-specific adapter.
 * The exported 'handler' is what will be configured in the AWS Lambda console or IaC setup.
 */
export const handler = createLambdaAdapter(mainHandler);
