import express from 'express';
import { scanReceiptHandler } from './functions/scan-receipt';
import { syncHandler } from './functions/sync';
import { createCheckoutSessionHandler, verifySessionHandler, createCustomerPortalSessionHandler } from './functions/stripe';
import { shareHandler } from './functions/share';
import { onetimeKeyHandler } from './functions/onetime-key';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' })); // Increase limit for receipt images

// API routes
app.post('/scan-receipt', scanReceiptHandler);
app.all('/sync', syncHandler);

// Share routes
app.all('/share/:shareId?', shareHandler);
app.all('/onetime-key/:keyId?', onetimeKeyHandler);

// Stripe routes
app.post('/create-checkout-session', createCheckoutSessionHandler);
app.post('/verify-session', verifySessionHandler);
app.post('/create-customer-portal-session', createCustomerPortalSessionHandler);


// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});