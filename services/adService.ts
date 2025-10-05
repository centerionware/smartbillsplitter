import { getAdConfig } from './adProviderService';

const adConfig = getAdConfig();

/**
 * The ad content to be displayed in iframes.
 * This is determined at build time by the ad provider service based on environment variables.
 * If no provider is configured or an error occurs, this will be null.
 */
export const AD_IFRAME_CONTENT = adConfig.content;

/**
 * A message describing why ads might not be working, if there's a configuration issue.
 * This will be null if ads are working correctly or are intentionally disabled ('none').
 */
export const AD_ERROR_MESSAGE = adConfig.error;