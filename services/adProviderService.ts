// services/adProviderService.ts

// --- Ad Provider Plugin System ---

// Safely access env to prevent crashes in environments where import.meta.env might not be defined.
const env = (import.meta as any)?.env;

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
  // A-ADS uses an iframe. This HTML makes it responsive and transparent.
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Advertisement</title>
      <style>
        html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background-color: transparent; display: flex; align-items: center; justify-content: center; }
        iframe { border: 0; }
      </style>
    </head>
    <body>
      <iframe data-aa="${unitId}" src="//ad.a-ads.com/${unitId}?size=300x100&background_color=00000000&text_color=333333" style="width:300px; height:100px; border:0px; padding:0;overflow:hidden;background-color: transparent;"></iframe>
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
    const AD_PROVIDER = env?.VITE_AD_PROVIDER || 'a-ads';
    const AADS_ID = env?.VITE_AADS_ID;
    const CUSTOM_AD_HTML_BASE64 = env?.VITE_CUSTOM_AD_HTML_BASE64;

    switch (AD_PROVIDER) {
        case 'a-ads':
            if (!AADS_ID) {
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
        default:
            return { content: null, error: null }; // No error if ads are intentionally disabled
    }
};