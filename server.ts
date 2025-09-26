import express from 'express';
import { createExpressAdapter } from './express-adapter';
import { mainHandler } from './serverless';

const app = express();
const port = process.env.PORT || 3000;

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
