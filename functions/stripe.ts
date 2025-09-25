import { Request, Response } from 'express';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID_MONTHLY = process.env.STRIPE_PRICE_ID_MONTHLY;
const STRIPE_PRICE_ID_YEARLY = process.env.STRIPE_PRICE_ID_YEARLY;

if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID_MONTHLY || !STRIPE_PRICE_ID_YEARLY) {
  console.error("Stripe environment variables are not set. Payment functionality will be disabled.");
}

// Initialize Stripe only if the secret key is available.
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Helper function to check for Stripe configuration at runtime.
const checkStripeConfig = (res: Response): boolean => {
    if (!stripe || !STRIPE_PRICE_ID_MONTHLY || !STRIPE_PRICE_ID_YEARLY) {
        res.status(500).json({ error: "Stripe integration is not configured on the server." });
        return false;
    }
    return true;
}

export const createCheckoutSessionHandler = async (req: Request, res: Response) => {
    if (!checkStripeConfig(res)) return;

    const { plan, origin } = req.body;
    if (!plan || (plan !== 'monthly' && plan !== 'yearly') || !origin) {
        return res.status(400).json({ error: "Invalid request. 'plan' (monthly/yearly) and 'origin' are required." });
    }

    const priceId = plan === 'monthly' ? STRIPE_PRICE_ID_MONTHLY : STRIPE_PRICE_ID_YEARLY;
    
    try {
        // Create a checkout session with Stripe
        const session = await stripe!.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'subscription',
            // Define the redirect URLs. Stripe will append the session_id automatically.
            success_url: `${origin}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}`,
        });
        
        return res.status(200).json({ url: session.url });

    } catch (error: any) {
        console.error("Stripe checkout session creation failed:", error);
        return res.status(500).json({ error: "Failed to create checkout session.", details: error.message });
    }
};

export const verifySessionHandler = async (req: Request, res: Response) => {
    if (!checkStripeConfig(res)) return;

    const { sessionId } = req.body;
    if (!sessionId) {
        return res.status(400).json({ error: "Missing 'sessionId' in request body." });
    }

    try {
        // Retrieve the session from Stripe to verify its status
        const session = await stripe!.checkout.sessions.retrieve(sessionId, {
            expand: ['subscription', 'line_items']
        });

        if (session.payment_status === 'paid' && session.subscription && session.customer) {
            const subscription = session.subscription as Stripe.Subscription;
            
            const priceId = session.line_items?.data[0]?.price?.id;
            let duration: 'monthly' | 'yearly' | null = null;
            
            if (priceId === STRIPE_PRICE_ID_MONTHLY) duration = 'monthly';
            else if (priceId === STRIPE_PRICE_ID_YEARLY) duration = 'yearly';
            

            if (duration) {
                return res.status(200).json({ 
                    status: 'success', 
                    duration,
                    subscriptionId: subscription.id,
                    customerId: session.customer,
                 });
            } else {
                 return res.status(400).json({ error: 'Could not determine subscription duration from checkout session.' });
            }
        } else {
            return res.status(402).json({ error: 'Payment not completed successfully or subscription not found.' });
        }
    } catch (error: any) {
        console.error("Stripe session verification failed:", error);
        return res.status(500).json({ error: 'Failed to verify checkout session.', details: error.message });
    }
};

export const createCustomerPortalSessionHandler = async (req: Request, res: Response) => {
    if (!checkStripeConfig(res)) return;

    const { customerId, origin } = req.body;
    if (!customerId) {
        return res.status(400).json({ error: "Missing 'customerId' in request body." });
    }

    try {
        const portalSession = await stripe!.billingPortal.sessions.create({
            customer: customerId,
            return_url: origin,
        });

        return res.status(200).json({ url: portalSession.url });

    } catch (error: any) {
        console.error("Stripe customer portal session creation failed:", error);
        return res.status(500).json({ error: "Failed to create customer portal session.", details: error.message });
    }
};
