import { getAdContent } from './adProviderService.ts';

/**
 * The ad content to be displayed in iframes.
 * This is determined at build time by the ad provider service based on environment variables.
 * If no provider is configured, this will be null.
 */
export const AD_IFRAME_CONTENT = getAdContent();
