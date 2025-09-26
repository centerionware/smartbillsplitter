import express from 'express';
import { createExpressAdapter } from './express-adapter';
import { mainHandler } from './serverless';

const app = express();
const port = process.env.PORT || 3000;

// --- CORS Middleware ---
const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN;
if (allowedOrigin) {
  console.log(`CORS is configured to allow origin: ${allowedOrigin}`);
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Respond to preflight requests immediately
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  });
} else {
    console.warn("CORS_ALLOWED_ORIGIN is not set. The backend may not be accessible from a different frontend domain.");
}


// Increase body limit for receipt image uploads
app.use(express.json({ limit: '10mb' }));

// A dedicated health check endpoint for Kubernetes liveness probes
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// All API requests are passed to the generic mainHandler via the adapter.
// The mainHandler will perform the routing based on the request path.
app.use(createExpressAdapter(mainHandler));

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});