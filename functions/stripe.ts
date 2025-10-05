import Stripe from 'stripe';
import { HttpRequest, HttpResponse } from '../http-types';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID_MONTHLY = process.env.STRIPE_PRICE_ID_MONTHLY;
const STRIPE_PRICE_ID_YEARLY = process.env.STRIPE_PRICE_ID_YEARLY;

if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID_MONTHLY || !STRIPE_PRICE_ID_YEARLY) {
  console.error("Stripe environment variables are not set. Payment functionality will be disabled.");
}

// Initialize Stripe only if the secret key is available.
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const assertStripeConfig = () => {
    if (!stripe || !STRIPE_PRICE_ID_MONTHLY || !STRIPE_PRICE_ID_YEARLY) {
        throw new Error("Stripe integration is not configured on the server.");
    }
};

// --- Business Logic ---
// These functions contain the core logic for Stripe interactions and are independent of the server framework.

async function createCheckoutSession(plan: 'monthly' | 'yearly', origin: string): Promise<{ url: string | null }> {
    assertStripeConfig();
    if (!plan || (plan !== 'monthly' && plan !== 'yearly') || !origin) {
        throw new Error("Invalid request. 'plan' (monthly/yearly) and 'origin' are required.");
    }
    
    const priceId = plan === 'monthly' ? STRIPE_PRICE_ID_MONTHLY! : STRIPE_PRICE_ID_YEARLY!;
    
    try {
        const session = await stripe!.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: `${origin}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}`,
        });
        return { url: session.url };
    } catch (error: any) {
        console.error("Stripe checkout session creation failed:", error);
        throw new Error(`Failed to create checkout session: ${error.message}`);
    }
}

async function verifyPaymentSession(sessionId: string) {
    assertStripeConfig();
    if (!sessionId) {
        throw new Error("Missing 'sessionId'.");
    }

    try {
        const session = await stripe!.checkout.sessions.retrieve(sessionId, {
            expand: ['subscription', 'line_items']
        });

        if (session.payment_status === 'paid' && session.subscription && session.customer) {
            const subscription = session.subscription as Stripe.Subscription;
            const priceId = session.line_items?.data[0]?.price?.id;
            let duration: 'monthly' | 'yearly' | null = null;
            
            if (priceId === STRIPE_PRICE_ID_MONTHLY) duration = 'monthly';
            else if (priceId === STRIPE_PRICE_ID_YEARLY) duration = 'yearly';
            
            if (!duration) {
                throw new Error('Could not determine subscription duration from checkout session.');
            }
            // FIX: Handle case where session.customer is a string (ID) vs an object
            const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
            return { 
                status: 'success', 
                provider: 'stripe',
                duration,
                subscriptionId: subscription.id,
                customerId: customerId,
            };
        } else {
            throw new Error('Payment not completed successfully or subscription not found.');
        }
    } catch (error: any) {
        console.error("Stripe session verification failed:", error);
        throw new Error(`Failed to verify checkout session: ${error.message}`);
    }
}

async function createCustomerPortalSession(customerId: string, origin: string): Promise<{ url: string }> {
    assertStripeConfig();
    if (!customerId) {
        throw new Error("Missing 'customerId'.");
    }
    try {
        const portalSession = await stripe!.billingPortal.sessions.create({
            customer: customerId,
            return_url: origin,
        });
        return { url: portalSession.url };
    } catch (error: any) {
        console.error("Stripe customer portal session creation failed:", error);
        throw new Error(`Failed to create customer portal session: ${error.message}`);
    }
}

async function updateCustomerMetadata(customerId: string): Promise<{ id: string; metadata: Stripe.Metadata }> {
    assertStripeConfig();
    if (!customerId) {
        throw new Error("Missing 'customerId'.");
    }
    try {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const customer = await stripe!.customers.update(customerId, {
            metadata: {
                last_seen_at: timestamp,
            },
        });
        return { id: customer.id, metadata: customer.metadata };
    } catch (error: any) {
        console.error("Stripe customer update failed:", error);
        if (error.type === 'StripeInvalidRequestError' && error.code === 'resource_missing') {
             throw new Error(`Customer with ID ${customerId} not found.`);
        }
        throw new Error(`Failed to update customer metadata: ${error.message}`);
    }
}


// --- Framework-Agnostic Handlers ---

export const createCheckoutSessionHandler = async (req: HttpRequest): Promise<HttpResponse> => {
    try {
        const { plan, origin } = req.body;
        const result = await createCheckoutSession(plan, origin);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify(result)
        };
    } catch (error: any) {
        const statusCode = error.message.includes("Invalid request") ? 400 : 500;
        return {
            statusCode: statusCode,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

export const verifyPaymentHandler = async (req: HttpRequest): Promise<HttpResponse> => {
    try {
        // The client sends the session_id as `sessionId` in the body
        const { sessionId } = req.body;
        const result = await verifyPaymentSession(sessionId);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify(result)
        };
    } catch (error: any) {
        let statusCode = 500;
        if (error.message.includes("Missing 'sessionId'")) {
            statusCode = 400;
        } else if (error.message.includes("Payment not completed")) {
            statusCode = 402;
        }
        return {
            statusCode: statusCode,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

export const manageSubscriptionHandler = async (req: HttpRequest): Promise<HttpResponse> => {
    try {
        const { customerId, origin } = req.body;
        const result = await createCustomerPortalSession(customerId, origin);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify(result)
        };
    } catch (error: any) {
        const statusCode = error.message.includes("Missing 'customerId'") ? 400 : 500;
        return {
            statusCode: statusCode,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

export const updateCustomerMetadataHandler = async (req: HttpRequest): Promise<HttpResponse> => {
    try {
        const { customerId } = req.body;
        const result = await updateCustomerMetadata(customerId);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify(result)
        };
    } catch (error: any) {
        let statusCode = 500;
        if (error.message.includes("Missing 'customerId'")) {
            statusCode = 400;
        } else if (error.message.includes("not found")) {
            statusCode = 404;
        }
        return {
            statusCode: statusCode,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify({ error: error.message })
        };
    }
};