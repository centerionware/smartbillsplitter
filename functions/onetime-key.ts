// FIX: Changed import to use Request and Response for robust Express handler typing.
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import redisClient from '../services/redisClient.ts';

// Keys are short-lived, for the initial share only.
const EXPIRATION_SECONDS = 24 * 60 * 60; // 24 hours

// FIX: Explicitly typed the handler function with Request and Response types.
export const onetimeKeyHandler = async (req: Request, res: Response) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  // --- STORE ENCRYPTED KEY (POST) ---
  if (req.method === "POST") {
    try {
      const { encryptedBillKey } = req.body;
      if (!encryptedBillKey || typeof encryptedBillKey !== 'string') {
        return res.status(400).json({ error: "Invalid payload. 'encryptedBillKey' string is required." });
      }

      const keyId = randomUUID();
      const redisKey = `onetimekey:${keyId}`;
      await redisClient.set(redisKey, encryptedBillKey, 'EX', EXPIRATION_SECONDS);

      console.log(`Created one-time key with ID ${keyId}.`);
      return res.status(201).json({ keyId });

    } catch (e) {
      console.error('One-time key POST error:', e);
      return res.status(400).json({ error: "Invalid JSON body or Redis error." });
    }
  }

  // --- RETRIEVE AND DELETE ENCRYPTED KEY (GET) ---
  if (req.method === "GET") {
    const { keyId } = req.params;
    if (!keyId) {
      return res.status(400).json({ error: "Missing 'keyId' in path." });
    }

    const redisKey = `onetimekey:${keyId}`;
    
    // Use a MULTI/EXEC transaction to atomically get and delete the key.
    const transaction = redisClient.multi();
    transaction.get(redisKey);
    transaction.del(redisKey);
    
    const [encryptedBillKeyResult] = await transaction.exec() as [[null | Error, string | null]];

    if (encryptedBillKeyResult[1]) {
        console.log(`One-time key ${keyId} retrieved and deleted.`);
        return res.status(200).json({ encryptedBillKey: encryptedBillKeyResult[1] });
    } else {
        return res.status(404).json({ error: "Invalid or expired key ID." });
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: "Method Not Allowed" });
};