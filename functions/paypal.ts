import { HttpRequest, HttpResponse } from '../http-types.ts';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_PLAN_ID_MONTHLY = process.env.PAYPAL_PLAN_ID_MONTHLY;
const PAYPAL_PLAN_ID_YEARLY = process.env.PAYPAL_PLAN_ID_YEARLY;

// Use the correct PayPal API endpoint based on the environment
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox'; // Default to sandbox for safety
const PAYPAL_API_BASE = PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

const assertPayPalConfig = () => {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !PAYPAL_PLAN_ID_MONTHLY || !PAYPAL_PLAN_ID_YEARLY) {
        throw new Error("PayPal integration is not configured on the server.");
    }
};

/**
 * Gets a short-lived access token from PayPal to authorize API requests.
 */
async function getPayPalAccessToken(): Promise<string> {
    assertPayPalConfig();
    // FIX: Use btoa for Base64 encoding to ensure compatibility with non-Node.js server-side environments.
    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
    
    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
        let errorBody = await response.text();
        try {
            const errorJson = JSON.parse(errorBody);
            errorBody = errorJson.error_description || errorJson.error || JSON.stringify(errorJson);
        } catch (e) {
            // Not a JSON response, use the raw text.
        }
        console.error(`PayPal Auth Error (${response.status}):`, errorBody);
        throw new Error(`Failed to get PayPal access token: ${errorBody}`);
    }

    const data = await response.json();
    return data.access_token;
}

/**
 * Creates a new PayPal subscription and returns an approval URL for the user to visit.
 */
export const createCheckoutSessionHandler = async (req: HttpRequest): Promise<HttpResponse> => {
    try {
        const { plan, origin } = req.body;
        if (!plan || (plan !== 'monthly' && plan !== 'yearly') || !origin) {
            throw new Error("Invalid request. 'plan' (monthly/yearly) and 'origin' are required.");
        }
        
        const planId = plan === 'monthly' ? PAYPAL_PLAN_ID_MONTHLY : PAYPAL_PLAN_ID_YEARLY;
        const accessToken = await getPayPalAccessToken();

        const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                plan_id: planId,
                application_context: {
                    return_url: `${origin}`,
                    cancel_url: `${origin}`,
                }
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('PayPal API Error on Subscription Creation:', errorBody); // Log the full body
            let errorMessage = 'Failed to create PayPal subscription.';
            try {
                const errorJson = JSON.parse(errorBody);
                if (errorJson.name === 'UNPROCESSABLE_ENTITY' && Array.isArray(errorJson.details) && errorJson.details.some((d: any) => d.field === '/plan_id' && d.issue === 'INVALID_RESOURCE_ID')) {
                    errorMessage = `The PayPal Plan ID ('${planId}') is invalid or does not exist in the current environment (${PAYPAL_MODE}). Please check your server configuration.`;
                } else {
                    errorMessage = errorJson.details?.[0]?.description || errorJson.message || errorMessage;
                }
            } catch (e) {
                // Not JSON, use the default error message. The raw body is already logged.
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();

        const approvalLink = data.links.find((link: any) => link.rel === 'approve');
        if (!approvalLink) {
            throw new Error('Could not find PayPal approval link in the API response.');
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify({ url: approvalLink.href })
        };
    } catch (error: any) {
        console.error("PayPal Checkout Error:", { message: error.message, stack: error.stack });
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify({ error: "An internal server error occurred while creating the checkout session.", details: error.message })
        };
    }
};

/**
 * Verifies a PayPal subscription after the user approves it and is redirected back to the app.
 */
export const verifyPaymentHandler = async (req: HttpRequest): Promise<HttpResponse> => {
    try {
        const { sessionId: subscriptionId } = req.body;
        if (!subscriptionId) {
            throw new Error("Missing 'sessionId' (PayPal Subscription ID).");
        }
        
        const accessToken = await getPayPalAccessToken();
        const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            let errorBody = await response.text();
            try {
                const errorJson = JSON.parse(errorBody);
                errorBody = errorJson.details?.[0]?.description || errorJson.message || JSON.stringify(errorJson);
            } catch (e) {
                // Response was not JSON.
            }
            console.error(`PayPal Subscription Fetch Error (${response.status}):`, errorBody);
            throw new Error(`Failed to verify PayPal subscription details. The server responded: ${errorBody}`);
        }
        
        const data = await response.json();

        if ((data.status === 'ACTIVE' || data.status === 'APPROVED') && data.plan_id) {
            let duration: 'monthly' | 'yearly' | null = null;
            if (data.plan_id === PAYPAL_PLAN_ID_MONTHLY) duration = 'monthly';
            else if (data.plan_id === PAYPAL_PLAN_ID_YEARLY) duration = 'yearly';

            if (!duration) throw new Error('Could not determine subscription duration from PayPal plan ID.');
            if (!data.subscriber?.payer_id) throw new Error('Could not find customer ID in PayPal response.');
            
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
                body: JSON.stringify({
                    status: 'success',
                    provider: 'paypal',
                    duration,
                    subscriptionId: data.id,
                    customerId: data.subscriber.payer_id,
                })
            };
        } else {
            throw new Error(`The server returned an invalid response during payment verification. Status: ${data.status}`);
        }
    } catch (error: any) {
        console.error("PayPal Verification Error:", { message: error.message, stack: error.stack });
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify({ error: "An internal server error occurred during payment verification.", details: error.message })
        };
    }
};

/**
 * Provides a URL for the user to manage their PayPal subscription.
 * Note: This handler is not used by the primary in-app management flow but is kept for completeness.
 */
export const manageSubscriptionHandler = async (req: HttpRequest): Promise<HttpResponse> => {
    // PayPal doesn't have a customer portal like Stripe. The best we can do is
    // redirect them to the automatic payments section of their account.
    const url = PAYPAL_MODE === 'live' 
        ? 'https://www.paypal.com/myaccount/autopay/'
        : 'https://www.sandbox.paypal.com/myaccount/autopay/';
    
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ url })
    };
};

/**
 * Cancels a PayPal subscription via the API.
 */
export const cancelSubscriptionHandler = async (req: HttpRequest): Promise<HttpResponse> => {
    try {
        const { subscriptionId } = req.body;
        if (!subscriptionId) {
            throw new Error("Missing 'subscriptionId' in request body.");
        }
        
        const accessToken = await getPayPalAccessToken();

        const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                reason: "User requested cancellation from within the application."
            })
        });

        // PayPal returns 204 No Content on successful cancellation.
        if (response.status === 204) {
            return {
                statusCode: 204,
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            };
        } else {
             const errorBody = await response.text();
             console.error(`PayPal Subscription Cancellation Error (${response.status}):`, errorBody);
             throw new Error("Failed to cancel subscription on PayPal's end.");
        }
    } catch (error: any) {
        console.error("PayPal Cancellation Error:", { message: error.message, stack: error.stack });
        const statusCode = error.message.includes("Missing 'subscriptionId'") ? 400 : 500;
        return {
            statusCode: statusCode,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify({ error: "An internal server error occurred during subscription cancellation.", details: error.message })
        };
    }
};