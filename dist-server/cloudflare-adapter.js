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

// cloudflare-adapter.ts
var cloudflare_adapter_exports = {};
__export(cloudflare_adapter_exports, {
  createCloudflareAdapter: () => createCloudflareAdapter
});
module.exports = __toCommonJS(cloudflare_adapter_exports);
async function toHttpRequest(req) {
  const url = new URL(req.url);
  let body = null;
  if (req.method !== "GET" && req.method !== "HEAD" && req.headers.get("content-type")?.includes("application/json")) {
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }
  }
  const query = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }
  return {
    method: req.method.toUpperCase(),
    path: url.pathname,
    headers: Object.fromEntries(req.headers),
    params: {},
    // Cloudflare Workers doesn't have path params in the same way, router-dependent
    query,
    body
  };
}
function fromHttpResponse(httpResponse) {
  return new Response(httpResponse.body, {
    status: httpResponse.statusCode,
    headers: httpResponse.headers
  });
}
function createCloudflareAdapter(handler) {
  return async (req, env) => {
    try {
      const httpRequest = await toHttpRequest(req);
      const httpResponse = await handler(httpRequest, env);
      return fromHttpResponse(httpResponse);
    } catch (error) {
      console.error("Unhandled error in Cloudflare adapted handler:", error);
      return new Response(JSON.stringify({ error: "An unexpected internal server error occurred." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createCloudflareAdapter
});
