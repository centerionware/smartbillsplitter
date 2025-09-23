// FIX: Explicitly import 'Express' type and apply it to the app instance to ensure correct type resolution for middleware and handlers.
// FIX: Use express namespace to get types and avoid conflicts with global DOM types.
import express from 'express';
import { scanReceiptHandler } from './functions/scan-receipt';
import { syncHandler } from './functions/sync';
import { createCheckoutSessionHandler, verifySessionHandler, createCustomerPortalSessionHandler } from './functions/stripe';

const app: express.Express = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' })); // Increase limit for receipt images

// API routes
app.post('/scan-receipt', scanReceiptHandler);
app.all('/sync', syncHandler);

// Stripe routes
app.post('/create-checkout-session', createCheckoutSessionHandler);
app.post('/verify-session', verifySessionHandler);
app.post('/create-customer-portal-session', createCustomerPortalSessionHandler);


// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});