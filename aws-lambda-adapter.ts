import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { HttpRequest, HttpHandler, HttpResponse } from './http-types';

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
      // When the 'isBase64Encoded' flag is true, the body is a base64 string.
      // We must decode it back into a UTF-8 string before JSON parsing.
      // FIX: Replace Node.js Buffer with browser-compatible equivalent to resolve type error.
      const bodyString = event.isBase64Encoded
        ? (() => {
            const binaryString = atob(event.body);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return new TextDecoder('utf-8').decode(bytes);
        })()
        : event.body;
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