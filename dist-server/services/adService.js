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

// services/adService.ts
var adService_exports = {};
__export(adService_exports, {
  AD_IFRAME_CONTENT: () => AD_IFRAME_CONTENT
});
module.exports = __toCommonJS(adService_exports);
var AD_IFRAME_CONTENT = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Advertisement</title>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
        overflow: hidden;
        background-color: transparent;
      }
    </style>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7626920066448337" crossorigin="anonymous"></script>
  </head>
  <body>
    <!-- Responsive Ad Unit. This will fill the body, which fills the iframe. -->
    <ins class="adsbygoogle"
         style="display:block; width:100%; height:100%;"
         data-ad-client="ca-pub-7626920066448337"
         data-ad-slot="8267308457"
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
    <script>
      (adsbygoogle = window.adsbygoogle || []).push({});
    </script>
  </body>
  </html>
`;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AD_IFRAME_CONTENT
});
