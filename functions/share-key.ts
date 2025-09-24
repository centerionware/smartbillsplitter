import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import redisClient from '../services/redisClient.ts';

const EXPIRATION_SECONDS = 24 * 60 * 60; // 24 hours

export const shareKeyHandler = async (req: Request, res: Response) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  // --- STORE A KEY (POST) ---
  if (req.method === "POST") {
    try {
      const { key, shareId } = req.body;
      if (!key || typeof key !== 'object' || !shareId || typeof shareId !== 'string') {
        return res.status(400).json({ error: "Invalid payload. 'key' (JsonWebKey object) and 'shareId' (string) are required." });
      }

      const keyId = randomUUID();
      const redisKey = `share-key:${keyId}`;
      const dataToStore = JSON.stringify({ key, shareId });

      await redisClient.set(redisKey, dataToStore, 'EX', EXPIRATION_SECONDS);

      console.log(`Stored share key for shareId ${shareId} with keyId ${keyId}.`);
      return res.status(201).json({ keyId });

    } catch (e) {
      console.error('Share-key POST error:', e);
      return res.status(400).json({ error: "Invalid JSON body or Redis error." });
    }
  }

  // --- RETRIEVE A KEY (GET) ---
  if (req.method === "GET") {
    const { keyId } = req.params;
    if (!keyId) {
      return res.status(400).json({ error: "Missing 'keyId' in path." });
    }
    
    const redisKey = `share-key:${keyId}`;
    const storedData = await redisClient.get(redisKey);

    if (!storedData) {
      return res.status(404).json({ error: "Invalid or expired key ID." });
    }

    // Key is one-time use. Delete it immediately.
    await redisClient.del(redisKey);
    console.log(`Share key ${keyId} retrieved and deleted.`);

    return res.status(200).json(JSON.parse(storedData));
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: "Method Not Allowed" });
};