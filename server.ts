

// FIX: Changed `import * as express` to `import express` to use the default export,
// which is the express function needed to create the app instance.
import express from 'express';
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
app.all('/onetime-key/:keyId?', createExpressAdapter(onetimeKeyHandler));

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
