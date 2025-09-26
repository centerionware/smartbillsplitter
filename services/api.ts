// services/api.ts
// FIX: Cast `import.meta` to `any` to resolve TypeScript error when Vite types are not available.
const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || '';

/**
 * Constructs a full URL for an API endpoint.
 * If VITE_API_BASE_URL is set, it prepends it to the path.
 * Otherwise, it returns the path as-is for relative requests.
 * @param path The API endpoint path (e.g., '/scan-receipt').
 * @returns The full or relative URL for the API endpoint.
 */
export const getApiUrl = (path: string): string => {
    // Ensure path starts with a slash for consistency.
    const sanitizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // If API_BASE_URL is an empty string, this correctly returns just the path (e.g., /scan-receipt),
    // which the browser interprets as a relative URL. If it's set, it returns the full URL.
    return `${API_BASE_URL}${sanitizedPath}`;
};