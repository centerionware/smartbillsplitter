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

// express-adapter.ts
var express_adapter_exports = {};
__export(express_adapter_exports, {
  createExpressAdapter: () => createExpressAdapter
});
module.exports = __toCommonJS(express_adapter_exports);
function toHttpRequest(req) {
  const url = new URL(req.originalUrl, `${req.protocol}://${req.get("host")}`);
  return {
    method: req.method.toUpperCase(),
    path: url.pathname,
    // Use pathname to exclude query params
    headers: req.headers,
    params: req.params,
    query: req.query,
    body: req.body
  };
}
function createExpressAdapter(handler) {
  return async (req, res) => {
    try {
      const httpRequest = toHttpRequest(req);
      const httpResponse = await handler(httpRequest, {});
      if (httpResponse.headers) {
        res.set(httpResponse.headers);
      }
      res.status(httpResponse.statusCode);
      if (httpResponse.body) {
        res.send(httpResponse.body);
      } else {
        res.end();
      }
    } catch (error) {
      console.error("Unhandled error in adapted handler:", error);
      res.status(500).json({ error: "An unexpected internal server error occurred." });
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createExpressAdapter
});
