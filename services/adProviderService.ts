// services/adProviderService.ts

// The `env` constant using import.meta.env is no longer needed, as variables
// will be accessed via `process.env` which is defined by Vite at build time.

interface AdResult {
    content: string | null;
    error: string | null;
}

/**
 * Generates the iframe content for A-ADS (Anonymous Ads).
 * @param unitId The ad unit ID from A-ADS.
 * @returns The HTML content for the ad iframe.
 */
const getAAdsContent = (unitId: string): string => {
  // Use a responsive size and the 'acceptable' ad network for better compatibility and performance.
  // The outer document ensures the ad iframe can fill its container within the app's ad components.
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Advertisement</title>
      <style>
        html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; display: flex; align-items: center; justify-content: center; background-color: transparent; }
        iframe { border: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: transparent; }
      </style>
    </head>
    <body>
      <iframe data-aa="${unitId}" src="//acceptable.a-ads.com/${unitId}?size=responsive"></iframe>
    </body>
    </html>
  `;
};

/**
 * Decodes Base64 encoded custom ad HTML.
 * @param encodedHtml The Base64 encoded HTML string.
 * @returns An AdResult object with the decoded HTML or an error message.
 */
const getCustomAdContent = (encodedHtml: string): AdResult => {
    try {
        // Using atob is sufficient here as this runs on the client.
        const decodedHtml = atob(encodedHtml);
        if (!decodedHtml.trim()) {
            const errorMsg = "Ad provider is 'custom' but VITE_CUSTOM_AD_HTML_BASE64 is an empty string. Ads will not be displayed.";
            console.warn(errorMsg);
            return { content: null, error: errorMsg };
        }
        return { content: decodedHtml, error: null };
    } catch (e) {
        const errorMsg = "Ad provider is 'custom' but VITE_CUSTOM_AD_HTML_BASE64 is not valid Base64. Ads will not be displayed.";
        console.error(errorMsg, e);
        return { content: null, error: errorMsg };
    }
};

/**
 * Returns the appropriate ad content and any configuration errors.
 * This is the central function for the ad provider system.
 * @returns An AdResult object with the HTML string for the ad iframe, and a potential error message.
 */
export const getAdConfig = (): AdResult => {
    // Read from `process.env` which is replaced by Vite's `define` config.
    const AD_PROVIDER = process.env.VITE_AD_PROVIDER || 'a-ads';
    const AADS_ID = process.env.VITE_AADS_ID;
    const CUSTOM_AD_HTML_BASE64 = process.env.VITE_CUSTOM_AD_HTML_BASE64;

    switch (AD_PROVIDER) {
        case 'a-ads':
            if (!AADS_ID || AADS_ID.trim() === '') {
                const errorMsg = "Ad provider is 'a-ads' but the required VITE_AADS_ID environment variable is missing. Ads will not be displayed.";
                console.warn(errorMsg);
                return { content: null, error: errorMsg };
            }
            return { content: getAAdsContent(AADS_ID), error: null };
        case 'custom':
             if (!CUSTOM_AD_HTML_BASE64) {
                const errorMsg = "Ad provider is 'custom' but the required VITE_CUSTOM_AD_HTML_BASE64 environment variable is missing. Ads will not be displayed.";
                console.warn(errorMsg);
                return { content: null, error: errorMsg };
            }
            return getCustomAdContent(CUSTOM_AD_HTML_BASE64);
        case 'admob':
            const errorMsgAdmob = "Ad provider 'AdMob' is configured but is not yet supported in this version. Ads will not be displayed.";
            console.warn(errorMsgAdmob);
            return { content: null, error: errorMsgAdmob };
        case 'none':
            return { content: null, error: null }; // No error if ads are intentionally disabled
        default:
            const errorMsg = `Unknown ad provider '${AD_PROVIDER}' is configured in VITE_AD_PROVIDER. Ads will not display. Valid options are 'a-ads', 'custom', or 'none'.`;
            console.warn(errorMsg);
            return { content: null, error: errorMsg };
    }
};
