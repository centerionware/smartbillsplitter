// services/api.ts
let API_BASE_URL: string | null = null;
let apiInitializationPromise: Promise<void> | null = null;

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

/**
 * A wrapper for `checkUrl` that retries on failure.
 * @param url The base URL to check.
 * @param retries Number of attempts.
 * @param delay Initial delay in ms.
 * @returns True if the URL becomes healthy, false otherwise.
 */
const checkUrlWithRetries = async (url: string, retries = 3, delay = 500): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
        if (await checkUrl(url)) {
            return true;
        }
        if (i < retries - 1) {
            console.log(`Health check for ${url} failed. Retrying in ${delay * Math.pow(2, i)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
    return false;
};

const discoverApiBaseUrl = async (): Promise<string> => {
    // --- Phase 1: Check build-time environment variables first ---
    const env = (import.meta as any)?.env;
    const envApiUrls = env?.VITE_API_BASE_URLS;
    if (typeof envApiUrls === 'string' && envApiUrls.length > 0) {
        const candidates = envApiUrls.split(',').map(url => url.trim()).filter(Boolean);
        console.log("Checking for backend API from build-time candidates:", candidates);
        for (const url of candidates) {
            if (await checkUrlWithRetries(url)) {
                console.log(`Discovered and connected to backend API at: ${url}`);
                return url; // Success! Return immediately.
            }
        }
    }

    // --- Phase 2: Fallback to dynamic subdomain discovery ONLY in dev environments ---
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isDev) {
        console.log("No healthy build-time backend found. Falling back to dynamic discovery in dev mode.");
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
                if (await checkUrlWithRetries(url)) {
                    console.log(`Discovered backend via dynamic discovery at: ${url}`);
                    return url; // Success! Return immediately.
                }
            }
        }
    }
    
    // --- Final Fallback ---
    console.log("No backend discovered. Falling back to relative API paths.");
    return '';
};


/**
 * Initializes the API service by discovering the backend URL. This should be called once,
 * without `await`, at application startup to allow it to run in the background.
 * @returns A promise that resolves when discovery is complete.
 */
export const initializeApi = (): Promise<void> => {
    if (!apiInitializationPromise) {
        apiInitializationPromise = (async () => {
            try {
                API_BASE_URL = await discoverApiBaseUrl();
            } catch (e) {
                console.error("API discovery failed:", e);
                // Fallback to relative paths on any discovery failure.
                API_BASE_URL = ''; 
            }
        })();
    }
    return apiInitializationPromise;
};

/**
 * Asynchronously returns the discovered API base URL after initialization.
 * @returns A promise resolving to the base URL string, an empty string for relative paths, or null if not yet initialized.
 */
export const getDiscoveredApiBaseUrl = async (): Promise<string | null> => {
    if (!apiInitializationPromise) {
        initializeApi();
    }
    await apiInitializationPromise;
    return API_BASE_URL;
};

/**
 * Asynchronously constructs a full URL for an API endpoint. It waits for the background
 * API discovery process to complete before resolving.
 * @param path The API endpoint path (e.g., '/scan-receipt').
 * @returns A promise resolving to the full or relative URL for the API endpoint.
 */
export const getApiUrl = async (path: string): Promise<string> => {
    if (!apiInitializationPromise) {
        // This is a safeguard. `initializeApi` should be called at app startup.
        console.warn("initializeApi() was not called at startup. Calling it now.");
        initializeApi();
    }
    
    await apiInitializationPromise;

    if (API_BASE_URL === null) {
        console.error("API base URL is null after initialization. This indicates a discovery failure. Falling back to relative paths.");
        API_BASE_URL = '';
    }
    
    // If API_BASE_URL is an empty string, this means we should use relative paths.
    if (API_BASE_URL === '') {
        const sanitizedPath = path.startsWith('/') ? path : `/${path}`;
        return sanitizedPath;
    }

    // Use the URL constructor for robust joining of the base URL and the path.
    return new URL(path, API_BASE_URL).toString();
};

/**
 * A wrapper around the native `fetch` function that adds automatic retries for transient errors.
 * Retries on network failures or specific server error codes (5xx, 405) that might
 * indicate a temporary issue like a serverless function cold start.
 * @param url The URL to fetch.
 * @param options The standard fetch options.
 * @param retries The number of retry attempts. Defaults to 3.
 * @param backoff The initial backoff delay in milliseconds. Defaults to 500ms.
 * @returns A Promise that resolves with the Response object on success.
 * @throws An error if all fetch attempts fail.
 */
export const fetchWithRetry = async (
    url: RequestInfo | URL,
    options?: RequestInit,
    retries = 3,
    backoff = 500
): Promise<Response> => {
    let lastError: Error | undefined;

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);

            // If the response is OK, we're done.
            if (response.ok) {
                return response;
            }

            // For specific error codes that suggest a temporary server issue, we treat it as a retryable error.
            if (response.status >= 500 || response.status === 405) {
                // Throw an error to trigger the retry logic in the catch block.
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            // For other client errors (4xx), we don't retry and return the response immediately.
            return response;

        } catch (error: any) {
            lastError = error;
            console.warn(`Fetch attempt ${i + 1} for ${url.toString()} failed. Retrying...`, error.message);
            if (i < retries - 1) {
                // Wait with exponential backoff before the next retry.
                await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
            }
        }
    }

    // If all retries have been exhausted, throw the last captured error.
    throw new Error(`All fetch attempts failed for ${url.toString()}. Last error: ${lastError?.message}`);
};