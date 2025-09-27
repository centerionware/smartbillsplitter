import { HttpRequest, HttpResponse } from '../http-types.ts';

import * as stripe from './stripe.ts';
import * as paypal from './paypal.ts';

const getProvider = () => process.env.PAYMENT_PROVIDER === 'stripe' ? 'stripe' : 'paypal';

export const createCheckoutSessionHandler = (req: HttpRequest): Promise<HttpResponse> => {
    const provider = getProvider();
    console.log(`Creating checkout session with provider: ${provider}`);
    if (provider === 'stripe') {
        return stripe.createCheckoutSessionHandler(req);
    }
    return paypal.createCheckoutSessionHandler(req);
};

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

export const getPayPalSubscriptionDetailsHandler = (req: HttpRequest): Promise<HttpResponse> => {
    // This is a PayPal-specific feature for the management portal
    return paypal.getSubscriptionDetailsHandler(req);
};

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

export const cancelSubscriptionHandler = (req: HttpRequest): Promise<HttpResponse> => {
    const { provider } = req.body;
    if (provider === 'paypal') {
        return paypal.cancelSubscriptionHandler(req);
    }
    return Promise.resolve({
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'This method is not used for canceling Stripe subscriptions.' }),
    });
};


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
