// services/api.ts
let API_BASE_URL: string | null = null;

const discoverApiBaseUrl = async (): Promise<string> => {
    // Vite environment variables can provide a comma-separated list of candidate URLs.
    const envApiUrls = (import.meta as any).env.VITE_API_BASE_URLS;
    
    const candidatesFromEnv = typeof envApiUrls === 'string' 
        ? envApiUrls.split(',').map(url => url.trim()).filter(Boolean) 
        : [];

    const dynamicCandidates: string[] = [];
    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol;
    
    // In a production-like environment (not localhost), try to discover the backend via subdomains.
    if (currentHostname !== 'localhost' && !currentHostname.startsWith('127.0.0.1')) {
        let baseHost = currentHostname;
        if (baseHost.startsWith('www.')) {
            baseHost = baseHost.substring(4);
        }
        
        const prefixes = ['k', 'c', 'v', 'n', 'a', 'g', 'm'];
        prefixes.forEach(prefix => {
            dynamicCandidates.push(`${currentProtocol}//${prefix}.${baseHost}`);
        });
    }

    // Combine all candidates, giving priority to those from the environment variable.
    // Use a Set to ensure there are no duplicates.
    const allCandidates = [...new Set([...candidatesFromEnv, ...dynamicCandidates])];
    
    if (allCandidates.length > 0) {
        console.log("Attempting to discover backend API from candidates:", allCandidates);

        for (const candidateUrl of allCandidates) {
            try {
                // Ping a known, lightweight health check endpoint with a short timeout.
                const response = await fetch(`${candidateUrl}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
                if (response.ok && (await response.text()) === 'OK') {
                    console.log(`Discovered and connected to backend API at: ${candidateUrl}`);
                    return candidateUrl;
                }
            } catch (error: any) {
                let reason = 'unknown error';
                if (error.name === 'AbortError') {
                    reason = 'request timed out';
                } else if (error instanceof TypeError) {
                    reason = 'CORS or network error';
                }
                console.debug(`Check for backend at ${candidateUrl} failed: ${reason}. This is expected if the backend is not hosted at this address.`, error);
            }
        }
    }
    
    // Fallback: If no candidate is found (or on localhost without env var), assume path-based routing on the same host.
    console.log("No backend discovered from candidates. Falling back to relative API paths.");
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