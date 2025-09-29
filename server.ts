import express from 'express';
import { createExpressAdapter } from './express-adapter.ts';
import { mainHandler } from './serverless.ts';

// This is the entrypoint for the Express.js server when running locally
// or in a traditional Node.js container environment.

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies.
// We increase the limit to handle potentially large base64 receipt images.
app.use(express.json({ limit: '10mb' }));

// All routes are passed to the framework-agnostic main handler.
// The adapter converts the Express request/response objects into a generic format.
app.all('*', createExpressAdapter(mainHandler));

app.listen(port, () => {
  console.log(`[server]: Express server is running at http://localhost:${port}`);
});
