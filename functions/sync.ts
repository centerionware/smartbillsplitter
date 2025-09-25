// FIX: Changed import to use RequestHandler for robust Express handler typing.
import { RequestHandler } from 'express';
import redisClient from '../services/redisClient.ts';

const EXPIRATION_SECONDS = 5 * 60; // 5 minutes

/**
 * Generates a unique 6-digit code, ensuring it doesn't already exist in Redis.
 */
const generateCode = async (): Promise<string> => {
  let code: string;
  let exists: number;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    exists = await redisClient.exists(`sync:${code}`);
  } while (exists);
  return code;
};

// FIX: Explicitly typed the handler with RequestHandler to ensure correct types for req and res.
export const syncHandler: RequestHandler = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  // --- UPLOAD DATA (POST) ---
  if (req.method === "POST") {
    try {
      const { encryptedData } = req.body;
      if (!encryptedData || typeof encryptedData !== 'string') {
        return res.status(400).json({ error: "Invalid payload. 'encryptedData' string is required." });
      }

      const code = await generateCode();
      // Store the data in Redis with a 5-minute expiration
      await redisClient.set(`sync:${code}`, encryptedData, 'EX', EXPIRATION_SECONDS);

      console.log(`Created sync session ${code}.`);
      return res.status(201).json({ code });

    } catch (e) {
      console.error('Sync POST error:', e);
      return res.status(400).json({ error: "Invalid JSON body or Redis error." });
    }
  }

  // --- DOWNLOAD DATA (GET) ---
  if (req.method === "GET") {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).json({ error: "Missing 'code' query parameter." });
    }

    const key = `sync:${code}`;
    const encryptedData = await redisClient.get(key);

    if (!encryptedData) {
      return res.status(404).json({ error: "Invalid or expired code." });
    }

    // Data is for one-time use. Delete it immediately after retrieval.
    await redisClient.del(key);
    console.log(`Sync session ${code} retrieved and deleted.`);
    
    return res.status(200).json({ encryptedData });
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: "Method Not Allowed" });
};