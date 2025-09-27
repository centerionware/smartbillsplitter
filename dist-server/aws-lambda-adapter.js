var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// aws-lambda-adapter.ts
var aws_lambda_adapter_exports = {};
__export(aws_lambda_adapter_exports, {
  createLambdaAdapter: () => createLambdaAdapter
});
module.exports = __toCommonJS(aws_lambda_adapter_exports);
function toHttpRequest(event) {
  const headers = event.headers || {};
  const query = event.queryStringParameters || {};
  let body = null;
  if (event.body) {
    try {
      const bodyString = event.isBase64Encoded ? new TextDecoder().decode(Uint8Array.from(atob(event.body), (c) => c.charCodeAt(0))) : event.body;
      if (headers["content-type"]?.includes("application/json")) {
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
    method: (event.requestContext.http.method || "GET").toUpperCase(),
    path: event.rawPath || "/",
    headers,
    params: event.pathParameters || {},
    // For potential future use if routing changes
    query,
    body
  };
}
function fromHttpResponse(httpResponse) {
  return {
    statusCode: httpResponse.statusCode,
    headers: {
      "Content-Type": "application/json",
      // Default content type
      ...httpResponse.headers || {}
    },
    body: httpResponse.body,
    isBase64Encoded: false
  };
}
function createLambdaAdapter(handler) {
  return async (event) => {
    try {
      const httpRequest = toHttpRequest(event);
      const httpResponse = await handler(httpRequest, {});
      return fromHttpResponse(httpResponse);
    } catch (error) {
      console.error("Unhandled error in Lambda adapted handler:", error);
      return fromHttpResponse({
        statusCode: 500,
        body: JSON.stringify({ error: "An unexpected internal server error occurred." })
      });
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createLambdaAdapter
});
