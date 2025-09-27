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

// services/api.ts
var api_exports = {};
__export(api_exports, {
  getApiUrl: () => getApiUrl,
  initializeApi: () => initializeApi
});
module.exports = __toCommonJS(api_exports);
var import_meta = {};
var API_BASE_URL = null;
var checkUrl = async (url) => {
  try {
    const healthUrl = new URL("/health", url).toString();
    const response = await fetch(healthUrl, { method: "GET", signal: AbortSignal.timeout(2e3) });
    if (response.ok && await response.text() === "OK") {
      return true;
    }
    return false;
  } catch (error) {
    console.debug(`Health check for ${url} failed.`, error);
    return false;
  }
};
var discoverApiBaseUrl = async () => {
  const envApiUrls = import_meta.env.VITE_API_BASE_URLS;
  if (typeof envApiUrls === "string" && envApiUrls.length > 0) {
    const candidates = envApiUrls.split(",").map((url) => url.trim()).filter(Boolean);
    console.log("Checking for backend API from build-time candidates:", candidates);
    for (const url of candidates) {
      if (await checkUrl(url)) {
        console.log(`Discovered and connected to backend API at: ${url}`);
        return url;
      }
    }
  }
  console.log("No backend found from build-time candidates. Falling back to dynamic discovery.");
  const dynamicCandidates = [];
  const { hostname, protocol } = window.location;
  if (hostname !== "localhost" && !hostname.startsWith("127.0.0.1")) {
    const baseHost = hostname.startsWith("www.") ? hostname.substring(4) : hostname;
    const prefixes = ["k", "c", "v", "n", "a", "g", "m"];
    prefixes.forEach((prefix) => {
      dynamicCandidates.push(`${protocol}//${prefix}.${baseHost}`);
    });
  }
  if (dynamicCandidates.length > 0) {
    console.log("Checking dynamic candidates:", dynamicCandidates);
    for (const url of dynamicCandidates) {
      if (await checkUrl(url)) {
        console.log(`Discovered backend via dynamic discovery at: ${url}`);
        return url;
      }
    }
  }
  console.log("No backend discovered. Falling back to relative API paths.");
  return "";
};
var initializeApi = async () => {
  if (API_BASE_URL === null) {
    API_BASE_URL = await discoverApiBaseUrl();
  }
};
var getApiUrl = (path) => {
  if (API_BASE_URL === null) {
    console.error("getApiUrl() was called before initializeApi() completed. This is not recommended. Falling back to relative path.");
    return path;
  }
  if (API_BASE_URL === "") {
    const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
    return sanitizedPath;
  }
  return new URL(path, API_BASE_URL).toString();
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getApiUrl,
  initializeApi
});
