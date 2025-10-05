import express from 'express';
import { createExpressAdapter } from './express-adapter';
import { mainHandler } from './serverless';

// This is the entrypoint for the Express.js server when running locally
// or in a traditional Node.js container environment.

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies.
// We increase the limit to handle potentially large base64 receipt images.
app.use(express.json({ limit: '10mb' }));

// All routes are passed to the framework-agnostic main handler.
// The adapter converts the Express request/response objects into a generic format.
// Use app.use() without a path to catch all requests. This is a more robust
// pattern than app.all('/*') which can cause issues with path-to-regexp.
app.use(createExpressAdapter(mainHandler));

app.listen(port, () => {
  console.log(`[server]: Express server is running at http://localhost:${port}`);
});