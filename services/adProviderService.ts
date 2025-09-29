// --- Ad Provider Plugin System ---

// Read the ad provider configuration from build-time environment variables.
// Safely access env to prevent crashes in environments where import.meta.env might not be defined.
const env = (import.meta as any)?.env;

const AD_PROVIDER = env?.VITE_AD_PROVIDER || 'a-ads';
const AADS_ID = env?.VITE_AADS_ID;
const CUSTOM_AD_HTML_BASE64 = env?.VITE_CUSTOM_AD_HTML_BASE64;
// const ADMOB_ID = env?.VITE_ADMOB_ID; // For future use

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
 * @returns The decoded HTML string, or an error message if decoding fails.
 */
const getCustomAdContent = (encodedHtml: string): string => {
    try {
        // Using atob is sufficient here as this runs on the client.
        return atob(encodedHtml);
    } catch (e) {
        console.error("Failed to decode VITE_CUSTOM_AD_HTML_BASE64:", e);
        return `<p style="color: red; font-family: sans-serif; text-align: center;">Error: Custom ad HTML is not valid Base64.</p>`;
    }
};

/**
 * Returns the appropriate ad content based on the configured provider.
 * This is the central function for the ad provider system.
 * @returns The HTML string for the ad iframe, or null if ads are disabled.
 */
export const getAdContent = (): string | null => {
    switch (AD_PROVIDER) {
        case 'a-ads':
            if (!AADS_ID) {
                console.warn("VITE_AD_PROVIDER is 'a-ads' but VITE_AADS_ID is not set.");
                return null;
            }
            return getAAdsContent(AADS_ID);
        case 'custom':
             if (!CUSTOM_AD_HTML_BASE64) {
                console.warn("VITE_AD_PROVIDER is 'custom' but VITE_CUSTOM_AD_HTML_BASE64 is not set.");
                return null;
            }
            return getCustomAdContent(CUSTOM_AD_HTML_BASE64);
        case 'admob':
            // This is disabled for now, as per the requirements.
            console.warn("AdMob provider is configured but not yet supported in this version.");
            return `<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-family: sans-serif; color: #555; background-color: #f0f0f0;">AdMob Ads (Not Implemented)</div>`;
        case 'none':
        default:
            return null;
    }
};