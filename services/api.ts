// services/api.ts
let API_BASE_URL: string | null = null;

const discoverApiBaseUrl = async (): Promise<string> => {
    // Vite replaces this with a string literal during build, or `undefined` if not set.
    const envApiUrls = (import.meta as any).env.VITE_API_BASE_URLS;
    
    // --- Phase 1: Check build-time environment variables first ---
    if (typeof envApiUrls === 'string' && envApiUrls.length > 0) {
        const candidatesFromEnv = envApiUrls.split(',').map(url => url.trim()).filter(Boolean);
        console.log("Checking for backend API from build-time candidates:", candidatesFromEnv);
        for (const candidateUrl of candidatesFromEnv) {
            try {
                // Ping a known, lightweight health check endpoint with a short timeout.
                const response = await fetch(`${candidateUrl}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
                if (response.ok && (await response.text()) === 'OK') {
                    console.log(`Discovered and connected to backend API at: ${candidateUrl}`);
                    return candidateUrl;
                }
            } catch (error: any) {
                // This is an expected failure if the URL is not the active backend, so we log it at a debug level.
                console.debug(`Check for backend at ${candidateUrl} failed.`, error);
            }
        }
        console.log("No backend found from build-time candidates.");
    }

    // --- Phase 2: Fallback to dynamic subdomain discovery ---
    const dynamicCandidates: string[] = [];
    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol;
    
    if (currentHostname !== 'localhost' && !currentHostname.startsWith('127.0.0.1')) {
        const baseHost = currentHostname.startsWith('www.') ? currentHostname.substring(4) : currentHostname;
        const prefixes = ['k', 'c', 'v', 'n', 'a', 'g', 'm'];
        prefixes.forEach(prefix => {
            dynamicCandidates.push(`${currentProtocol}//${prefix}.${baseHost}`);
        });
    }

    if (dynamicCandidates.length > 0) {
        console.log("Falling back to dynamic discovery. Checking candidates:", dynamicCandidates);
        for (const candidateUrl of dynamicCandidates) {
            try {
                const response = await fetch(`${candidateUrl}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
                if (response.ok && (await response.text()) === 'OK') {
                    console.log(`Discovered backend via dynamic discovery at: ${candidateUrl}`);
                    return candidateUrl;
                }
            } catch (error: any) {
                console.debug(`Dynamic check for backend at ${candidateUrl} failed.`, error);
            }
        }
    }
    
    // --- Final Fallback ---
    console.log("No backend discovered. Falling back to relative API paths.");
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