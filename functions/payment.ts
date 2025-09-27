import { HttpRequest, HttpResponse } from '../http-types.ts';

import * as stripe from './stripe.ts';
import * as paypal from './paypal.ts';

const getProvider = () => process.env.PAYMENT_PROVIDER === 'stripe' ? 'stripe' : 'paypal';

/**
 * Handler for creating a checkout session. The provider is determined by the backend's environment variable.
 */
export const createCheckoutSessionHandler = (req: HttpRequest): Promise<HttpResponse> => {
    const provider = getProvider();
    console.log(`Creating checkout session with provider: ${provider}`);
    if (provider === 'stripe') {
        return stripe.createCheckoutSessionHandler(req);
    }
    return paypal.createCheckoutSessionHandler(req);
};

/**
 * Handler for verifying a payment after the user returns from the payment provider's site.
 * The frontend tells us which provider it was and provides the relevant session/subscription ID.
 */
export const verifyPaymentHandler = (req: HttpRequest): Promise<HttpResponse> => {
    const { provider } = req.body;
    if (provider === 'stripe') {
        return stripe.verifyPaymentHandler(req);
    }
    if (provider === 'paypal') {
        return paypal.verifyPaymentHandler(req);
    }
    return Promise.resolve({
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid or missing payment provider specified in the request.' }),
    });
};

/**
 * Handler for redirecting the user to manage their subscription.
 * The frontend provides the provider associated with the user's subscription.
 */
export const manageSubscriptionHandler = (req: HttpRequest): Promise<HttpResponse> => {
    const { provider } = req.body;
    if (provider === 'stripe') {
        return stripe.manageSubscriptionHandler(req);
    }
    if (provider === 'paypal') {
        return paypal.manageSubscriptionHandler(req);
    }
    return Promise.resolve({
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid or missing subscription provider specified in the request.' }),
    });
};

/**
 * Handler for the "last seen" feature. This is currently Stripe-specific.
 * For other providers, it gracefully returns success without performing an action.
 */
export const updateCustomerMetadataHandler = (req: HttpRequest): Promise<HttpResponse> => {
    const { customerId, provider } = req.body;
    if (provider === 'stripe' && customerId) {
        return stripe.updateCustomerMetadataHandler(req);
    }
    return Promise.resolve({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: "Metadata update is only applicable for Stripe subscriptions." }),
    });
};
