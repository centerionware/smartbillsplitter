// FIX: Changed express import to use the default export and explicitly reference express.Request and express.Response types. This resolves type inference issues where methods like .status() were not found on the response object.
import express, { Express } from 'express';
import { scanReceiptHandler } from './functions/scan-receipt';
import { syncHandler } from './functions/sync';
import { createCheckoutSessionHandler, verifySessionHandler, createCustomerPortalSessionHandler } from './functions/stripe';

const app: Express = express();
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