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

// services/geminiService.ts
var geminiService_exports = {};
__export(geminiService_exports, {
  parseReceipt: () => parseReceipt
});
module.exports = __toCommonJS(geminiService_exports);

// services/api.ts
var API_BASE_URL = null;
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

// services/geminiService.ts
var parseReceipt = async (base64Image, mimeType) => {
  try {
    const response = await fetch(getApiUrl("/scan-receipt"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ base64Image, mimeType })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `Failed to analyze receipt. The server responded with status: ${response.status}`;
      throw new Error(errorMessage);
    }
    const parsedJson = await response.json();
    if (parsedJson && parsedJson.description && Array.isArray(parsedJson.items)) {
      return parsedJson;
    } else {
      throw new Error("Invalid JSON structure received from the server.");
    }
  } catch (error) {
    console.error("Error calling receipt parsing service:", error);
    if (error instanceof Error) {
      throw new Error(error.message || "Failed to analyze receipt. Please try another image or enter items manually.");
    }
    throw new Error("An unknown error occurred while analyzing the receipt.");
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parseReceipt
});
