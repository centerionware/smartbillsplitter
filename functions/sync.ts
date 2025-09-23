// FIX: Changed from 'import type' to a direct import to ensure Express types are resolved correctly, avoiding conflicts with global DOM types.
// FIX: Import the full express module to use express.Request and express.Response, avoiding type conflicts with global DOM types.
import express from 'express';

// In-memory store for sync sessions. This is suitable for the ephemeral nature
// of serverless functions for short-lived data.
const sessions = new Map<string, { data: string; expires: number }>();
const EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

// Generates a unique 6-digit code for a session.
const generateCode = (): string => {
  let code: string;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (sessions.has(code)); // Ensure code is unique in the current instance
  return code;
};

// Periodically clean up expired sessions to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [code, session] of sessions.entries()) {
    if (now > session.expires) {
      sessions.delete(code);
      console.log(`Expired session ${code} cleaned up.`);
    }
  }
}, 60 * 1000); // Run cleanup every minute

export const syncHandler = async (req: express.Request, res: express.Response) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send();
  }

  // Set standard headers for actual requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  // --- UPLOAD DATA (POST) ---
  if (req.method === "POST") {
    try {
      const { encryptedData } = req.body;
      if (!encryptedData || typeof encryptedData !== 'string') {
        return res.status(400).json({ error: "Invalid payload. 'encryptedData' string is required." });
      }

      const code = generateCode();
      sessions.set(code, {
        data: encryptedData,
        expires: Date.now() + EXPIRATION_MS,
      });

      console.log(`Created session ${code}. Total sessions: ${sessions.size}`);
      return res.status(201).json({ code });

    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body." });
    }
  }

  // --- DOWNLOAD DATA (GET) ---
  if (req.method === "GET") {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).json({ error: "Missing 'code' query parameter." });
    }

    const session = sessions.get(code);

    if (!session || Date.now() > session.expires) {
      if (session) sessions.delete(code); // Clean up expired session on access
      return res.status(404).json({ error: "Invalid or expired code." });
    }

    // Critical security step: data is for one-time use only.
    sessions.delete(code);
    console.log(`Session ${code} retrieved and deleted. Total sessions: ${sessions.size}`);
    
    return res.status(200).json({ encryptedData: session.data });
  }

  // --- Fallback for other HTTP methods ---
  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: "Method Not Allowed" });
};