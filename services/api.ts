// services/api.ts
let API_BASE_URL: string | null = null;

const discoverApiBaseUrl = async (): Promise<string> => {
    // Vite replaces this with a string literal during build, or `undefined` if not set.
    // FIX: Cast `import.meta` to `any` to access Vite-specific environment variables without causing a TypeScript type error when Vite's client types are not globally available.
    const envApiUrls = (import.meta as any).env.VITE_API_BASE_URLS;
    
    const candidates: string[] = [];

    // 1. Add candidates from the build-time environment variable first. This is the highest priority.
    if (typeof envApiUrls === 'string' && envApiUrls.length > 0) {
        const urlsFromEnv = envApiUrls.split(',').map(url => url.trim()).filter(Boolean);
        candidates.push(...urlsFromEnv);
    }

    // 2. Add dynamically generated candidates based on the current hostname as a fallback.
    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol;
    
    if (currentHostname !== 'localhost' && !currentHostname.startsWith('127.0.0.1')) {
        let baseHost = currentHostname;
        if (baseHost.startsWith('www.')) {
            baseHost = baseHost.substring(4);
        }
        
        const prefixes = ['k', 'c', 'v', 'n', 'a', 'g', 'm'];
        prefixes.forEach(prefix => {
            const dynamicUrl = `${currentProtocol}//${prefix}.${baseHost}`;
            // Avoid adding duplicates if they were somehow also in the env var
            if (!candidates.includes(dynamicUrl)) {
                candidates.push(dynamicUrl);
            }
        });
    }

    if (candidates.length === 0) {
        console.log("No API candidates found. Falling back to relative API paths.");
        return '';
    }
    
    console.log("Attempting to discover backend API from candidates:", candidates);
    
    for (const candidateUrl of candidates) {
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
    
    // Fallback: If no candidate is found, assume path-based routing on the same host.
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