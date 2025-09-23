import express from 'express';
// FIX: Rename 'Request' to 'ExpressRequest' to avoid conflict with the global Fetch API 'Request'.
import type { Request as ExpressRequest, Response, NextFunction } from 'express';
import { handler as scanReceiptHandler } from './functions/scan-receipt';
import syncHandler from './functions/sync';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' })); // Increase limit for receipt images

// Middleware to adapt Netlify's handler signature to Express
const adaptNetlifyHandler = (handler: Function) => {
  return async (req: ExpressRequest, res: Response, next: NextFunction) => {
    try {
      const netlifyEvent = {
        httpMethod: req.method,
        headers: req.headers,
        body: JSON.stringify(req.body),
        queryStringParameters: req.query,
      };
      // @ts-ignore
      const result = await handler(netlifyEvent, {});
      res.status(result.statusCode).set(result.headers).send(result.body);
    } catch (error) {
      next(error);
    }
  };
};

const adaptNetlifySyncHandler = (handler: Function) => {
    return async (req: ExpressRequest, res: Response, next: NextFunction) => {
        try {
            // Reconstruct the full URL for the handler
            const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
            const request = new Request(fullUrl, {
                method: req.method,
                headers: req.headers as HeadersInit,
                body: req.method !== 'GET' ? JSON.stringify(req.body) : null,
            });
            const response: globalThis.Response = await handler(request, {});
            
            // Pipe the response from the handler to the Express response
            response.headers.forEach((value, name) => {
                res.setHeader(name, value);
            });
            res.status(response.status);
            res.send(await response.text());

        } catch (error) {
            next(error);
        }
    }
}

// API routes
app.post('/api/scan-receipt', adaptNetlifyHandler(scanReceiptHandler));
app.all('/api/sync', adaptNetlifySyncHandler(syncHandler));


// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
