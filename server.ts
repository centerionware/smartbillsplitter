// The default `import express from 'express'` is correct for creating the application instance.
// Type errors that may have appeared in this file were resolved by fixing the adapter.
// FIX: Updated to use `import = require()` syntax for Express.
// This is the correct way to import CommonJS modules like Express in some TypeScript
// configurations to ensure proper type resolution.
import express = require('express');
import { createExpressAdapter } from './express-adapter';

// Import the framework-agnostic handlers
import { scanReceiptHandler } from './functions/scan-receipt';
import { syncHandler } from './functions/sync';
import { createCheckoutSessionHandler, verifySessionHandler, createCustomerPortalSessionHandler } from './functions/stripe';
import { shareHandler } from './functions/share';
import { onetimeKeyHandler } from './functions/onetime-key';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' })); // Increase limit for receipt images

// API routes using the adapter
app.post('/scan-receipt', createExpressAdapter(scanReceiptHandler));
app.all('/sync', createExpressAdapter(syncHandler));

// Share routes using the adapter
app.all('/share/:shareId?', createExpressAdapter(shareHandler));
app.all('/onetime-key/:keyId?/:action(status)?', createExpressAdapter(onetimeKeyHandler));

// Stripe routes using the adapter
app.post('/create-checkout-session', createExpressAdapter(createCheckoutSessionHandler));
app.post('/verify-session', createExpressAdapter(verifySessionHandler));
app.post('/create-customer-portal-session', createExpressAdapter(createCustomerPortalSessionHandler));


// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});