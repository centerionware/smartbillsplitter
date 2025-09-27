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

// vercel-adapter.ts
var vercel_adapter_exports = {};
__export(vercel_adapter_exports, {
  createVercelAdapter: () => createVercelAdapter
});
module.exports = __toCommonJS(vercel_adapter_exports);
function toHttpRequest(req) {
  return {
    method: (req.method || "GET").toUpperCase(),
    path: req.url || "/",
    headers: req.headers,
    params: req.query,
    query: req.query,
    body: req.body
  };
}
function applyHttpResponse(res, httpResponse) {
  if (httpResponse.headers) {
    for (const [key, value] of Object.entries(httpResponse.headers)) {
      res.setHeader(key, value);
    }
  }
  res.status(httpResponse.statusCode);
  if (httpResponse.body) {
    res.send(httpResponse.body);
  } else {
    res.end();
  }
}
function createVercelAdapter(handler) {
  return async (req, res) => {
    try {
      const httpRequest = toHttpRequest(req);
      const httpResponse = await handler(httpRequest, {});
      applyHttpResponse(res, httpResponse);
    } catch (error) {
      console.error("Unhandled error in Vercel adapted handler:", error);
      res.status(500).json({ error: "An unexpected internal server error occurred." });
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createVercelAdapter
});
