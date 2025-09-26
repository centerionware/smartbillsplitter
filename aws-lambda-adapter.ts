import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { HttpRequest, HttpHandler, HttpResponse } from './http-types.ts';

/**
 * Transforms an AWS Lambda Function URL event (APIGatewayProxyEventV2)
 * into a framework-agnostic HttpRequest.
 */
function toHttpRequest(event: APIGatewayProxyEventV2): HttpRequest {
  const headers = event.headers || {};
  const query = event.queryStringParameters || {};
  let body: any = null;

  if (event.body) {
    try {
      // Lambda body is base64 encoded if isBase64Encoded is true
      // FIX: Replaced Node.js `Buffer` with platform-agnostic `atob` and `TextDecoder`
      // to correctly handle Base64 encoded bodies in environments without Node.js types.
      const bodyString = event.isBase64Encoded ? new TextDecoder().decode(Uint8Array.from(atob(event.body), c => c.charCodeAt(0))) : event.body;
      if (headers['content-type']?.includes('application/json')) {
        body = JSON.parse(bodyString);
      } else {
        body = bodyString;
      }
    } catch (e) {
      console.error("Failed to parse Lambda event body:", e);
      body = {};
    }
  }

  return {
    method: (event.requestContext.http.method || 'GET').toUpperCase() as HttpRequest['method'],
    path: event.rawPath || '/',
    headers: headers,
    params: event.pathParameters || {}, // For potential future use if routing changes
    query: query,
    body: body,
  };
}

/**
 * Creates an AWS Lambda compatible response from a framework-agnostic HttpResponse.
 */
function fromHttpResponse(httpResponse: HttpResponse): APIGatewayProxyResultV2 {
  return {
    statusCode: httpResponse.statusCode,
    headers: {
      'Content-Type': 'application/json', // Default content type
      ...(httpResponse.headers || {}),
    },
    body: httpResponse.body,
    isBase64Encoded: false,
  };
}

/**
 * Creates an AWS Lambda handler from a framework-agnostic HttpHandler.
 */
export function createLambdaAdapter(handler: HttpHandler): (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2> {
  return async (event: APIGatewayProxyEventV2) => {
    try {
      const httpRequest = toHttpRequest(event);
      // AWS Lambda configuration comes from process.env, so the `env` parameter is not used.
      const httpResponse = await handler(httpRequest, {});
      return fromHttpResponse(httpResponse);
    } catch (error) {
      console.error('Unhandled error in Lambda adapted handler:', error);
      return fromHttpResponse({
        statusCode: 500,
        body: JSON.stringify({ error: 'An unexpected internal server error occurred.' }),
      });
    }
  };
}
