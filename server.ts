// FIX: Explicitly import 'Express' type and apply it to the app instance to ensure correct type resolution for middleware and handlers.
import express, { Express, Request, Response } from 'express';
import { scanReceiptHandler } from './functions/scan-receipt';
import { syncHandler } from './functions/sync';

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' })); // Increase limit for receipt images

// API routes
app.post('/scan-receipt', scanReceiptHandler);
app.all('/sync', syncHandler);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
