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

// services/cloudflareKV.ts
var cloudflareKV_exports = {};
__export(cloudflareKV_exports, {
  createCloudflareKVStore: () => createCloudflareKVStore
});
module.exports = __toCommonJS(cloudflareKV_exports);
var createCloudflareKVStore = (namespace) => {
  if (!namespace) {
    throw new Error("Cloudflare KV Namespace was not provided.");
  }
  return {
    async get(key) {
      return namespace.get(key);
    },
    async set(key, value, options) {
      await namespace.put(key, value, { expirationTtl: options?.EX });
    },
    async del(key) {
      await namespace.delete(key);
    },
    async exists(key) {
      const value = await namespace.get(key);
      return value !== null;
    }
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createCloudflareKVStore
});
