// services/api.ts
let API_BASE_URL: string | null = null;

/**
 * A self-contained helper to check if a backend URL is live.
 * @param url The base URL to check.
 * @returns A promise that resolves to true if the backend is healthy, false otherwise.
 */
const checkUrl = async (url: string): Promise<boolean> => {
    try {
        // Ping a known, lightweight health check endpoint with a short timeout.
        // Use URL constructor to safely join paths and avoid double slashes.
        const healthUrl = new URL('/health', url).toString();
        const response = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
        // Ensure the response is OK (status 200-299) and the body is exactly "OK".
        if (response.ok && (await response.text()) === 'OK') {
            return true;
        }
        return false;
    } catch (error) {
        // Any failure (network error, CORS, timeout, etc.) is caught here.
        console.debug(`Health check for ${url} failed.`, error);
        return false;
    }
};


const discoverApiBaseUrl = async (): Promise<string> => {
    // --- Phase 1: Check build-time environment variables first ---
    const envApiUrls = (import.meta as any).env.VITE_API_BASE_URLS;
    if (typeof envApiUrls === 'string' && envApiUrls.length > 0) {
        const candidates = envApiUrls.split(',').map(url => url.trim()).filter(Boolean);
        console.log("Checking for backend API from build-time candidates:", candidates);
        for (const url of candidates) {
            if (await checkUrl(url)) {
                console.log(`Discovered and connected to backend API at: ${url}`);
                return url; // Success! Return immediately.
            }
        }
    }

    // --- Phase 2: Fallback to dynamic subdomain discovery ---
    console.log("No backend found from build-time candidates. Falling back to dynamic discovery.");
    const dynamicCandidates: string[] = [];
    const { hostname, protocol } = window.location;
    
    if (hostname !== 'localhost' && !hostname.startsWith('127.0.0.1')) {
        const baseHost = hostname.startsWith('www.') ? hostname.substring(4) : hostname;
        const prefixes = ['k', 'c', 'v', 'n', 'a', 'g', 'm'];
        prefixes.forEach(prefix => {
            dynamicCandidates.push(`${protocol}//${prefix}.${baseHost}`);
        });
    }

    if (dynamicCandidates.length > 0) {
        console.log("Checking dynamic candidates:", dynamicCandidates);
        for (const url of dynamicCandidates) {
            if (await checkUrl(url)) {
                console.log(`Discovered backend via dynamic discovery at: ${url}`);
                return url; // Success! Return immediately.
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
        // This indicates a programming error where `getApiUrl` is used before `initializeApi` has completed.
        // Fallback to a relative path but warn the developer.
        console.error("getApiUrl() was called before initializeApi() completed. This is not recommended. Falling back to relative path.");
        return path;
    }
    
    // If API_BASE_URL is an empty string, this means we should use relative paths.
    if (API_BASE_URL === '') {
        const sanitizedPath = path.startsWith('/') ? path : `/${path}`;
        return sanitizedPath;
    }

    // Use the URL constructor for robust joining of the base URL and the path.
    // This correctly handles cases where the base URL may or may not have a trailing slash.
    return new URL(path, API_BASE_URL).toString();
};