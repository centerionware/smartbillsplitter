// services/api.ts
let API_BASE_URL: string | null = null;

const discoverApiBaseUrl = async (): Promise<string> => {
    // For local development, rely on the Vite environment variable if it's set.
    const devApiUrl = (import.meta as any).env.VITE_API_BASE_URL;
    if (typeof devApiUrl === 'string') {
        console.log(`Using development API base URL: "${devApiUrl}"`);
        return devApiUrl;
    }

    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol;
    
    // In a production-like environment (not localhost), try to discover the backend.
    if (currentHostname !== 'localhost' && !currentHostname.startsWith('127.0.0.1')) {
        const hostnameParts = currentHostname.split('.');
        
        // Derive the main domain. Handles 'sub.domain.com' -> 'domain.com' and 'domain.com' -> 'domain.com'.
        const mainDomain = hostnameParts.length > 2
            ? hostnameParts.slice(1).join('.')
            : currentHostname;

        const prefixes = ['k', 'c', 'v', 'n', 'a', 'g', 'm'];
        
        for (const prefix of prefixes) {
            const candidateHost = `${prefix}.${mainDomain}`;
            const candidateUrl = `${currentProtocol}//${candidateHost}`;
            
            try {
                // Ping a known, lightweight health check endpoint with a short timeout.
                const response = await fetch(`${candidateUrl}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
                if (response.ok && (await response.text()) === 'OK') {
                    console.log(`Discovered backend API at: ${candidateUrl}`);
                    return candidateUrl;
                }
            } catch (error) {
                // Ignore errors (timeout, CORS, network error) and try the next prefix.
                console.debug(`Check for backend at ${candidateUrl} failed.`);
            }
        }
    }
    
    // Fallback: If no subdomain is found (or on localhost without env var), assume path-based routing on the same host.
    console.log("No backend subdomain discovered. Falling back to relative API paths.");
    return '';
};

/**
 * Initializes the API service by discovering the backend URL.
 * This must be called once when the application starts up.
 */
export const initializeApi = async (): Promise<void> => {
    if (API_BASE_URL === null) {
        API_BASE_URL = await discoverApiBaseUrl();
    }
};

/**
 * Constructs a full URL for an API endpoint using the discovered base URL.
 * Throws a warning if called before `initializeApi` has completed.
 * @param path The API endpoint path (e.g., '/scan-receipt').
 * @returns The full or relative URL for the API endpoint.
 */
export const getApiUrl = (path: string): string => {
    if (API_BASE_URL === null) {
        // This indicates a programming error where `getApiUrl` is used before initialization.
        // Fallback to a relative path but warn the developer.
        console.error("getApiUrl() was called before initializeApi() completed. This is not recommended. Falling back to relative path.");
        return path;
    }
    // Ensure path starts with a slash for consistency.
    const sanitizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // If API_BASE_URL is an empty string, this correctly returns just the path (e.g., /scan-receipt),
    // which the browser interprets as a relative URL. If it's set, it returns the full URL.
    return `${API_BASE_URL}${sanitizedPath}`;
};